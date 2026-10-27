// Shared Dubbing v2 transport for the edge gateway and local API.
const base = "https://api.elevenlabs.io/v1/dubbing/project";

export async function dubbingRequest(method, body, voiceKey, fetcher = fetch) {
  if (!voiceKey) throw new Error("Dubbing is not configured. Add the voice API key to the gateway.");
  const headers = { "xi-api-key": voiceKey };
  const call = async (url, init = {}) => {
    const response = await fetcher(url, { ...init, headers: { ...headers, ...init.headers } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail?.message || data.message || "ElevenLabs could not process the dubbing request.");
    return data;
  };
  if (method === "GET") {
    const { project_id: projectId, language_id: languageId } = body;
    if (!/^proj_[a-zA-Z0-9_-]+$/.test(projectId || "") || !/^lang_[a-zA-Z0-9_-]+$/.test(languageId || "")) {
      throw new Error("Invalid dubbing job reference.");
    }
    const data = await call(`${base}/${projectId}/language/${languageId}`);
    if (data.status === "failed") throw new Error(data.error?.message || "Dubbing failed. Please check the source media.");
    return {
      project_id: projectId, language_id: languageId, status: data.status,
      media_url: data.status === "completed" ? data.outputs?.lossless_audio : undefined,
      media_type: "audio/flac",
    };
  }
  const strength = body.voice_settings?.cloning_strength ?? 7;
  if (typeof strength !== "number" || !Number.isFinite(strength) || strength < 0 || strength > 10) {
    throw new Error("Speaker similarity must be between 0 and 10.");
  }
  const form = new FormData();
  if (body.file_base64) {
    const encoded = String(body.file_base64).split(",").pop();
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    if (!bytes.length) throw new Error("The media file is empty.");
    form.append("file", new Blob([bytes], { type: body.media_type || "application/octet-stream" }), body.file_name || "media.mp4");
  } else if (body.source_url) {
    form.append("source_url", body.source_url);
  } else {
    throw new Error("Upload a supported media file before starting a dub.");
  }
  const sourceLanguage = body.source_lang || body.source_language;
  if (sourceLanguage && !["auto", "Auto-detect"].includes(sourceLanguage)) form.append("source_language", sourceLanguage);
  form.append("model_id", "dubbing_v2");
  const project = await call(base, { method: "POST", body: form });
  const language = await call(`${base}/${project.project_id}/language`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_language: body.target_lang || body.target_language, voice_settings: { cloning_strength: strength } }),
  });
  return { id: project.project_id, project_id: project.project_id, language_id: language.language_id, status: language.status || "queued", media_type: "audio/flac" };
}
