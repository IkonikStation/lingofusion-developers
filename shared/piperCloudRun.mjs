export const PIPER_WIF_ISSUER = "https://api.lingofusion.dev/identity/voice-flash-lite";
export const PIPER_WIF_SUBJECT = "lingofusion-gateway-piper";
const STS_URL = "https://sts.googleapis.com/v1/token";
const CREDENTIALS_URL = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts";
const encoder = new TextEncoder();

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function cloudRunIdentity(env, audience) {
  const { PIPER_WIF_PROVIDER: provider, PIPER_INVOKER_SERVICE_ACCOUNT: account, PIPER_WIF_SIGNER } = env;
  const signer = JSON.parse(PIPER_WIF_SIGNER ?? "null");
  if (!/^projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(provider ?? "") ||
      !/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(account ?? "") ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(signer?.kid ?? "") ||
      typeof signer?.privateKey !== "string" || signer.privateKey.length > 4096 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(signer.privateKey)) throw new Error("Incomplete Piper workload identity.");
  return { provider, account, signer, audience };
}

async function googlePost(url, body, headers) {
  const response = await fetch(url, { method: "POST", body, headers, redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("Piper workload identity exchange failed.");
  }
  return response.json();
}

async function mintIdentity({ provider, account, signer, audience }) {
  const resource = `//iam.googleapis.com/${provider}`;
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(signer.privateKey), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const fields = [
    { alg: "RS256", typ: "JWT", kid: signer.kid },
    { iss: PIPER_WIF_ISSUER, sub: PIPER_WIF_SUBJECT, aud: `https:${resource}`, iat: now, exp: now + 300 },
  ];
  const unsigned = fields.map((field) => base64url(encoder.encode(JSON.stringify(field)))).join(".");
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned));
  const sts = await googlePost(STS_URL, new URLSearchParams({
    audience: resource,
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    subject_token: `${unsigned}.${base64url(new Uint8Array(signature))}`,
    scope: "https://www.googleapis.com/auth/cloud-platform",
  }), { "Content-Type": "application/x-www-form-urlencoded" });
  if (typeof sts.access_token !== "string" || !sts.access_token) throw new Error("Piper workload identity is unavailable.");
  const result = await googlePost(`${CREDENTIALS_URL}/${encodeURIComponent(account)}:generateIdToken`, JSON.stringify({ audience }), {
    Authorization: `Bearer ${sts.access_token}`, "Content-Type": "application/json",
  });
  const [, payload] = String(result.token ?? "").split(".");
  const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  if (claims.aud !== audience || !Number.isSafeInteger(claims.exp) || claims.exp <= now + 60) {
    throw new Error("Piper identity token has the wrong audience or expiry.");
  }
  return { token: result.token, expires: claims.exp };
}

let cached;
export async function cloudRunIdToken(identity) {
  const cacheKey = JSON.stringify([identity.provider, identity.account, identity.audience, identity.signer.kid]);
  if (cached?.key === cacheKey && cached.expires > Math.floor(Date.now() / 1000) + 60) return cached.token;
  // Workers cannot share pending I/O promises between different request contexts.
  const minted = await mintIdentity(identity);
  cached = { key: cacheKey, ...minted };
  return minted.token;
}
