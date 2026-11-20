"""Authenticated inference service for LingoFusion Voice Flash Lite."""
import asyncio
from collections import OrderedDict
import hmac
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time

from aiohttp import web
import onnxruntime
from piper.config import PiperConfig
from piper.voice import PiperVoice


MAX_CHARS = 1500
MAX_PCM_BYTES = 7_500_000
MAX_JOB_SECONDS = 40
AUDIO_TYPES = {"mp3": "audio/mpeg", "wav": "audio/wav"}
ENCODERS = {"mp3": ["-c:a", "libmp3lame", "-b:a", "48k"], "wav": ["-c:a", "pcm_s16le"]}


class AudioLimit(Exception):
    """Synthesis exceeded the request's audio or time budget."""


class Synthesizer:
    def __init__(self, voice_dir, voice_ids, cache_size):
        self.paths = {voice: voice_dir / voice / f"{voice}.onnx" for voice in voice_ids}
        self.cache_size = cache_size
        self.cache = OrderedDict()
        self.ffmpeg = shutil.which("ffmpeg")
        if not self.ffmpeg or any(
            not model.is_file() or not model.with_suffix(".onnx.json").is_file()
            for model in self.paths.values()
        ):
            raise RuntimeError("FFmpeg or installed Piper voices are missing")

    def voice(self, voice_id):
        if voice_id in self.cache:
            self.cache.move_to_end(voice_id)
            return self.cache[voice_id]
        if len(self.cache) == self.cache_size:
            self.cache.popitem(last=False)
        model = self.paths[voice_id]
        config = PiperConfig.from_dict(json.loads(model.with_suffix(".onnx.json").read_text()))
        options = onnxruntime.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.add_session_config_entry("session.intra_op.allow_spinning", "0")
        session = onnxruntime.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
        voice = PiperVoice(session=session, config=config)
        self.cache[voice_id] = voice
        return voice

    def synthesize(self, text, voice_id, audio_format):
        deadline = time.monotonic() + MAX_JOB_SECONDS
        voice = self.voice(voice_id)
        pcm = bytearray()
        for chunk in voice.synthesize(text):
            audio = chunk.audio_int16_bytes
            if len(pcm) + len(audio) > MAX_PCM_BYTES or time.monotonic() >= deadline:
                raise AudioLimit
            pcm.extend(audio)
        if not pcm or time.monotonic() >= deadline:
            raise AudioLimit
        # A seekable file lets FFmpeg finalize the WAV container lengths.
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / f"speech.{audio_format}"
            subprocess.run([
                self.ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error",
                "-filter_threads", "1",
                "-threads", "1", "-f", "s16le", "-ar", str(voice.config.sample_rate),
                "-ac", "1", "-i", "pipe:0", "-map_metadata", "-1", "-threads", "1",
                *ENCODERS[audio_format], "-f", audio_format, str(output),
            ], input=pcm, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                timeout=min(12, max(0.1, deadline - time.monotonic())), check=True)
            return output.read_bytes()


def create_app(synthesizer, voice_ids, token_digest):
    active = None
    started_at = 0.0

    @web.middleware
    async def require_token(request, handler):
        supplied = request.headers.get("Authorization", "")
        if not re.fullmatch(r"Bearer [a-f0-9]{64}", supplied) or not hmac.compare_digest(
            hashlib.sha256(supplied[7:].encode("ascii")).digest(), token_digest
        ):
            return web.json_response({"error": "unauthorized"}, status=401)
        return await handler(request)

    async def warm_up(_app):
        await asyncio.to_thread(synthesizer.synthesize, "Ready.", voice_ids[0], "mp3")

    async def health(_request):
        if active and not active.done() and time.monotonic() - started_at > 50:
            return web.json_response({"status": "unhealthy"}, status=503)
        return web.json_response({"status": "ok", "voices": voice_ids, "formats": list(AUDIO_TYPES)},
                                 headers={"Cache-Control": "no-store"})

    async def synthesize(request):
        nonlocal active, started_at
        if request.content_type != "application/json" or request.headers.get("Content-Encoding", "identity") != "identity":
            return web.json_response({"error": "unsupported_media_type"}, status=415)
        try:
            data = await asyncio.wait_for(request.json(), timeout=5)
        except (TimeoutError, UnicodeError, ValueError):
            return web.json_response({"error": "invalid_json"}, status=400)
        if not isinstance(data, dict):
            return web.json_response({"error": "invalid_json"}, status=400)
        text, voice, audio_format = data.get("input"), data.get("voice"), data.get("format", "mp3")
        if not isinstance(text, str) or not 1 <= len(text) <= MAX_CHARS or not text.strip() or re.search(r"[\x00\ud800-\udfff]", text):
            return web.json_response({"error": "invalid_input"}, status=400)
        if voice not in voice_ids or not isinstance(audio_format, str) or audio_format not in AUDIO_TYPES:
            return web.json_response({"error": "unsupported_voice_or_format"}, status=400)
        if active and not active.done():
            return web.json_response({"error": "busy"}, status=429, headers={"Retry-After": "2"})
        started_at = time.monotonic()
        active = asyncio.create_task(asyncio.to_thread(synthesizer.synthesize, text, voice, audio_format))
        # A disconnected client must not free the slot while the CPU job is still running.
        try:
            audio = await asyncio.shield(active)
        except AudioLimit:
            return web.json_response({"error": "audio_limit"}, status=422)
        except subprocess.TimeoutExpired:
            return web.json_response({"error": "encoding_timeout"}, status=503)
        except Exception as error:
            logging.error("Synthesis failed (%s)", type(error).__name__)
            return web.json_response({"error": "synthesis_failed"}, status=500)
        return web.Response(body=audio, content_type=AUDIO_TYPES[audio_format],
                            headers={"Cache-Control": "no-store, no-transform"})

    app = web.Application(middlewares=[require_token], client_max_size=32 * 1024)
    app.on_startup.append(warm_up)
    app.router.add_get("/healthz", health)
    app.router.add_post("/synthesize", synthesize)
    return app


def main():
    digest = os.environ.get("PIPER_API_TOKEN_SHA256", "")
    if not digest:
        token = os.environ.get("PIPER_API_TOKEN", "")
        if not re.fullmatch(r"[a-f0-9]{64}", token):
            raise SystemExit("Set PIPER_API_TOKEN to 32 random bytes in lowercase hexadecimal.")
        digest = hashlib.sha256(token.encode("ascii")).hexdigest()
    if not re.fullmatch(r"[a-f0-9]{64}", digest):
        raise SystemExit("PIPER_API_TOKEN_SHA256 must be a lowercase SHA-256 digest.")
    catalog = json.loads(Path(os.environ["PIPER_VOICE_CATALOG"]).read_text())
    voice_ids = [voice["id"] for voice in catalog["voices"]]
    cache_size = int(os.environ.get("PIPER_VOICE_CACHE", "2"))
    if not 1 <= cache_size <= len(voice_ids):
        raise SystemExit("PIPER_VOICE_CACHE must be between 1 and the number of installed voices.")
    synthesizer = Synthesizer(Path(os.environ["PIPER_VOICE_DIR"]), voice_ids, cache_size)
    web.run_app(create_app(synthesizer, voice_ids, bytes.fromhex(digest)),
                host=os.environ.get("PIPER_BIND", "127.0.0.1"),
                port=int(os.environ.get("PORT", os.environ.get("PIPER_PORT", "8788"))),
                access_log=None, shutdown_timeout=8, max_headers=32)


if __name__ == "__main__":
    main()
