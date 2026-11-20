import { readFile } from "node:fs/promises";
import { flashLiteProvider, synthesizeFlashLite } from "../../shared/voiceFlashLite.mjs";

const [configPath, mode] = process.argv.slice(2);
const config = JSON.parse(await readFile(configPath, "utf8"));
const provider = flashLiteProvider(config);
const url = new URL("/healthz", provider.url);
const unauthenticated = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
if (![401, 403].includes(unauthenticated.status)) throw new Error("Cloud Run did not reject an unauthenticated request.");
await unauthenticated.body?.cancel();
const headers = await provider.headers();
const noAppToken = await fetch(url, {
  headers: { "X-Serverless-Authorization": headers["X-Serverless-Authorization"] },
  redirect: "error", signal: AbortSignal.timeout(55_000),
});
if (noAppToken.status !== 401) throw new Error("Piper did not reject a request without its bearer token.");
await noAppToken.body?.cancel();
const ready = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(55_000) });
if (!ready.ok || (await ready.json()).status !== "ok") throw new Error("Cloud Run authenticated health check failed.");
if (mode === "--synthesize") {
  for (const format of ["mp3", "wav"]) {
    const audio = await synthesizeFlashLite(provider, { input: "Ready.", voice: "en_US-joe-medium", format });
    console.log(`Authenticated Cloud Run ${format} check passed (${audio.length} bytes).`);
  }
}
console.log("Cloud Run IAM, Piper authentication, and readiness checks passed.");
