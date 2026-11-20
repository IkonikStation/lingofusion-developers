# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM python:3.12-slim-bookworm AS voices
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && find /var/lib/apt/lists -type f -delete
COPY shared/piper-voices.json /build/voices.json
COPY deploy/piper/fetch-voices.py /build/fetch-voices.py
RUN python /build/fetch-voices.py /build/voices.json /build/voices

FROM debian:bookworm-slim AS ffmpeg
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gcc libc6-dev libmp3lame-dev make pkg-config xz-utils
WORKDIR /build
RUN curl -fsSL --retry 3 https://ffmpeg.org/releases/ffmpeg-8.1.3.tar.xz -o ffmpeg.tar.xz \
    && echo '7138d28c96d9d3e3af4ee3d8cad72741f8ffb40da90c1112235dea3ecd3178a3  ffmpeg.tar.xz' | sha256sum -c - \
    && tar -xf ffmpeg.tar.xz --strip-components=1 \
    && ./configure --disable-everything --disable-autodetect --disable-network --disable-doc \
        --disable-debug --disable-ffprobe --disable-ffplay --disable-x86asm \
        --enable-libmp3lame --enable-encoder=libmp3lame,pcm_s16le --enable-decoder=pcm_s16le \
        --enable-demuxer=pcm_s16le --enable-muxer=mp3,wav --enable-protocol=file,pipe \
        --enable-filter=abuffer,abuffersink,aformat,anull,aresample \
    && make -j2 ffmpeg && strip ffmpeg

FROM python:3.12-slim-bookworm
ENV PIPER_BIND=0.0.0.0 \
    PIPER_PORT=8080 \
    PIPER_VOICE_DIR=/app/voices \
    PIPER_VOICE_CATALOG=/app/voices.json \
    PIPER_VOICE_CACHE=2 \
    OPENBLAS_NUM_THREADS=1 \
    OMP_NUM_THREADS=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends libmp3lame0 \
    && find /var/lib/apt/lists -type f -delete
COPY --from=ffmpeg /build/ffmpeg /usr/local/bin/ffmpeg
COPY deploy/piper/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --only-binary=:all: -r /app/requirements.txt
COPY --from=voices /build/voices.json /app/voices.json
COPY --from=voices /build/voices /app/voices
COPY deploy/piper/service.py /app/service.py
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["python", "/app/service.py"]
