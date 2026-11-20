import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, verify } from "node:crypto";
import test from "node:test";
import { billing } from "../cloudflare-worker/billing.mjs";
import { FLASH_LITE_CLOUD_BYTES_PER_MONTH, FLASH_LITE_CLOUD_CALLS_PER_MONTH, FLASH_LITE_RATE_LIMIT, VOICE_FLASH_LITE_MODEL } from "../shared/voiceFlashLite.mjs";
import { harness } from "./billing-test-harness.mjs";
import { PIPER_WIF_ISSUER, PIPER_WIF_SUBJECT } from "../shared/piperCloudRun.mjs";

const owner = "flash-lite@example.com";
const path = "/v1/audio/speech";
const origin = "https://ikonikstation.github.io";
const providerUrl = "https://piper-123.us-central1.run.app";
const token = "a".repeat(64);
const apiKey = "sk_live_flash_lite_test";
const apiHeaders = { Authorization: `Bearer ${apiKey}` };

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
let projectNumber = 123;
const signer = JSON.stringify({ kid: "local-key", privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64") });
const account = "piper-gateway@lf-test.iam.gserviceaccount.com";
const encode = (data) => Buffer.from(JSON.stringify(data)).toString("base64url");
const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString());

function interceptCloud(t, provider, handleSynthesis) {
  const calls = [];
  const idToken = `${encode({ alg: "RS256" })}.${encode({ aud: providerUrl, exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const target = String(url);
    calls.push(target);
    assert.equal(options.redirect, "error");
    if (target === "https://sts.googleapis.com/v1/token") {
      const resource = `//iam.googleapis.com/${provider}`;
      assert.equal(options.body.get("audience"), resource);
      const [header, claims, signature] = options.body.get("subject_token").split(".");
      assert.equal(decode(header).kid, "local-key");
      assert.equal(decode(claims).aud, `https:${resource}`);
      assert.equal(decode(claims).iss, PIPER_WIF_ISSUER);
      assert.equal(decode(claims).sub, PIPER_WIF_SUBJECT);
      assert.equal(decode(claims).exp - decode(claims).iat, 300);
      assert.ok(verify("sha256", Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, "base64url")));
      return Response.json({ access_token: "test-access-token" });
    }
    if (target === `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(account)}:generateIdToken`) {
      assert.deepEqual(JSON.parse(options.body), { audience: providerUrl });
      assert.equal(options.headers.Authorization, "Bearer test-access-token");
      return Response.json({ token: idToken });
    }
    assert.equal(target, `${providerUrl}/synthesize`);
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.headers["X-Serverless-Authorization"], `Bearer ${idToken}`);
    return handleSynthesis(url, options);
  });
  return calls;
}

function setup(funds = 1) {
  const h = harness();
  Object.assign(h.env, {
    PIPER_ORIGIN: providerUrl,
    PIPER_API_TOKEN: token,
    PIPER_WIF_PROVIDER: `projects/${++projectNumber}/locations/global/workloadIdentityPools/piper/providers/gateway`,
    PIPER_INVOKER_SERVICE_ACCOUNT: account,
    PIPER_WIF_SIGNER: signer,
  });
  h.records.set(`user_balance:${owner}`, String(funds));
  h.records.set(`api_key_hash:${createHash("sha256").update(apiKey).digest("hex")}`, JSON.stringify({
    id: "key-test", email: owner, isActive: true,
  }));
  return {
    ...h,
    request: (body = {}, headers = {}) => h.api(path, {
      model: VOICE_FLASH_LITE_MODEL, input: "Hello", ...body,
    }, undefined, { ...apiHeaders, ...headers }),
    balance: async () => (await billing(h.env, { action: "balance", email: owner })).balance_usd,
  };
}

function mockAudio(format = "mp3") {
  const audio = new Uint8Array(format === "mp3" ? 128 : 46);
  if (format === "mp3") {
    audio.set([255, 243, 112, 192]);
  } else {
    audio.set(new TextEncoder().encode("RIFF"));
    audio.set(new TextEncoder().encode("WAVEfmt "), 8);
    const wav = new DataView(audio.buffer);
    wav.setUint32(4, 38, true);
    wav.setUint32(16, 16, true);
    wav.setUint16(20, 1, true);
    wav.setUint16(22, 1, true);
    wav.setUint32(24, 22050, true);
    wav.setUint32(28, 44100, true);
    wav.setUint16(32, 2, true);
    wav.setUint16(34, 16, true);
    audio.set(new TextEncoder().encode("data"), 36);
    wav.setUint32(40, 2, true);
  }
  return new Response(audio, { headers: {
    "Content-Type": format === "mp3" ? "audio/mpeg" : "audio/wav",
    "Content-Length": String(audio.length),
  } });
}

test("API and Playground use Piper, exact character billing and a durable usage receipt", async (t) => {
  const h = setup();
  const calls = [];
  const remoteCalls = interceptCloud(t, h.env.PIPER_WIF_PROVIDER, async (_url, options) => {
    const payload = JSON.parse(options.body);
    calls.push(payload);
    const response = mockAudio(payload.format);
    if (payload.format === "mp3") response.headers.delete("Content-Length");
    return response;
  });

  const models = await (await h.api("/v1/models")).json();
  assert.ok(models.data.some((model) => model.id === VOICE_FLASH_LITE_MODEL));
  const binary = await h.request({ input: " Hola😀 ", language: "es", response_format: "wav" });
  assert.equal(binary.status, 200);
  assert.equal(binary.headers.get("Content-Type"), "audio/wav");
  assert.equal(binary.headers.get("X-LingoFusion-Chars"), "5");
  assert.equal(binary.headers.get("X-LingoFusion-Cost-Usd"), "0.0001");
  assert.equal(await h.balance(), 0.9999);
  assert.deepEqual(calls[0], { input: "Hola😀", voice: "es_ES-davefx-medium", format: "wav" });
  assert.equal((await binary.arrayBuffer()).byteLength, 46);

  const operationId = binary.headers.get("X-LingoFusion-Request-Id");
  const usage = await (await h.api(`/api/usage/${operationId}`, undefined, undefined, apiHeaders)).json();
  assert.equal(usage.status, "settled");
  assert.equal(usage.result.chars, 5);
  assert.equal(usage.billed_usd, 0.0001);
  assert.equal((await h.api(`/api/usage/${operationId}`, undefined, "other@example.com")).status, 404);

  const result = await h.api("/api/playground/speech", { model: "LingoFusion Voice Flash Lite", input: "Hallo", language: "de-DE" }, owner, { Origin: origin });
  assert.equal(result.status, 200);
  assert.match((await result.json()).audio_url, /^data:audio\/mpeg;base64,/);
  assert.deepEqual(calls[1], { input: "Hallo", voice: "de_DE-thorsten-medium", format: "mp3" });
  assert.equal(await h.balance(), 0.9998);
  assert.equal(remoteCalls.length, 4); // Two identity exchanges, then two syntheses with one cached ID token.
  const storage = h.objects.get("billing:ledger-v1").data;
  assert.equal(storage.get("flashLiteCloudBudget").calls, 2);
  assert.equal(storage.get("flashLiteCloudBudget").bytes, 46 + 128);
});

test("invalid input, bad credentials, unavailable Piper and invalid audio do not charge", async (t) => {
  const h = setup();
  const remoteCalls = interceptCloud(t, h.env.PIPER_WIF_PROVIDER, async () => new Response("invalid audio", {
    headers: { "Content-Type": "audio/mpeg", "Content-Length": "13" },
  }));
  assert.equal((await h.request({}, { Authorization: "Bearer sk_live_invalid" })).status, 401);
  for (const payload of [
    { input: "a".repeat(1501) }, { input: 12 }, { input: "\ud800" }, { voice: "../anything" },
    { voice: "pt_BR-cadu-medium", language: "en" }, { response_format: "flac" },
  ]) assert.equal((await h.request(payload)).status, 400);

  delete h.env.PIPER_WIF_SIGNER;
  assert.equal((await h.request()).status, 503);
  h.env.PIPER_WIF_SIGNER = signer;
  h.env.PIPER_ORIGIN = "http://127.0.0.1";
  assert.equal((await h.request()).status, 503);
  assert.equal(remoteCalls.length, 0);
  h.env.PIPER_ORIGIN = providerUrl;
  assert.equal((await h.request()).status, 502);
  assert.equal(await h.balance(), 1);
});

test("concurrent requests cannot overdraw the same balance", async (t) => {
  const h = setup(0.0001);
  let release;
  const bothAdmitted = new Promise((resolve) => { release = resolve; });
  let dispatches = 0;
  interceptCloud(t, h.env.PIPER_WIF_PROVIDER, async () => {
    if (++dispatches === 2) release();
    await bothAdmitted;
    return mockAudio();
  });
  const results = await Promise.all([h.request(), h.request()]);
  assert.deepEqual(results.map(({ status }) => status).sort(), [200, 402]);
  assert.equal(await h.balance(), 0);
  assert.equal((await h.request()).status, 402);
  assert.equal(dispatches, 2);
});

test("gateway caps admissions per account across signed-in and API key paths", async (t) => {
  const h = setup();
  t.mock.method(Date, "now", () => 1_800_000_000_000);
  const remoteCalls = interceptCloud(t, h.env.PIPER_WIF_PROVIDER, async () => new Response(null, { status: 429 }));
  for (let i = 0; i < FLASH_LITE_RATE_LIMIT; i++) assert.equal((await h.request()).status, 503);
  const result = await h.api("/api/playground/speech", { model: VOICE_FLASH_LITE_MODEL, input: "Hello" }, owner, { Origin: origin });
  assert.equal(result.status, 429);
  assert.equal(result.headers.get("Retry-After"), "60");
  assert.equal(remoteCalls.filter((url) => url.endsWith("/synthesize")).length, FLASH_LITE_RATE_LIMIT);
  assert.equal(await h.balance(), 1);
});

test("the monthly Cloud Run cap rejects requests before minting credentials or charging", async (t) => {
  const h = setup();
  const remoteCalls = interceptCloud(t, h.env.PIPER_WIF_PROVIDER, async () => mockAudio());
  h.env.BILLING.get("ledger-v1");
  const storage = h.objects.get("billing:ledger-v1").data;
  const month = new Date().toISOString().slice(0, 7);
  for (const cap of [{ calls: FLASH_LITE_CLOUD_CALLS_PER_MONTH, bytes: 0 }, { calls: 0, bytes: FLASH_LITE_CLOUD_BYTES_PER_MONTH }]) {
    storage.set("flashLiteCloudBudget", { month, ...cap });
    const denied = await h.request();
    assert.equal(denied.status, 503);
    assert.equal((await denied.json()).error.code, "flash_lite_monthly_limit");
  }
  assert.equal(remoteCalls.length, 0);
  assert.equal(await h.balance(), 1);
});

test("legacy Voice and Voice Flash still use their existing routes without Piper configuration", async (t) => {
  const h = setup();
  h.env.VOICE_API_KEY = "legacy-voice-key";
  h.env.VOICE_UPSTREAM_URL = "https://voice.example.test/";
  delete h.env.PIPER_API_TOKEN;
  const upstreamModels = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), "https://voice.example.test/BZgkqPqms7Kj9ulSkVzn");
    assert.equal(options.headers["xi-api-key"], "legacy-voice-key");
    upstreamModels.push(JSON.parse(options.body).model_id);
    return mockAudio();
  });
  for (const model of ["LingoFusion Voice", "LingoFusion Voice Flash"]) assert.equal((await h.request({ model })).status, 200);
  assert.deepEqual(upstreamModels, ["eleven_v4", "eleven_v4_turbo"]);
});
