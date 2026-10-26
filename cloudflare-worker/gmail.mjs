const SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const validEmail = (value) => /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(value);
function base64(bytes) { return btoa(Array.from(bytes, (value) => String.fromCharCode(value)).join("")); }
function fromBase64(value) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`gmail-gift-token:${secret}`));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptGmailToken(token, email, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(email) }, await encryptionKey(secret), new TextEncoder().encode(token));
  return { iv: base64(iv), data: base64(new Uint8Array(encrypted)) };
}
export async function decryptGmailToken(record, email, secret) {
  const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(record.iv), additionalData: new TextEncoder().encode(email) }, await encryptionKey(secret), fromBase64(record.data));
  return new TextDecoder().decode(raw);
}
export function gmailConfigured(env) { return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET && env.GIFTS); }
export async function gmailStatus(env, user) {
  return { configured: gmailConfigured(env), connected: Boolean(user?.provider === "google" && await env.GIFTS?.get(`gmail:${user.email.toLowerCase()}`)), senderEmail: user?.email || null, paymentNotificationsReady: Boolean(env.STRIPE_GIFT_WEBHOOK_SECRET) };
}
export async function connectGmail(request, env, user) {
  if (user.provider !== "google") return Response.json({ message: "Sign in with Google to send gifts from your Gmail account." }, { status: 403 });
  if (!gmailConfigured(env)) return Response.json({ message: "Gmail gift sending is not configured yet. You can still preview the recipient experience." }, { status: 503 });
  const state = crypto.randomUUID();
  const verifier = base64(crypto.getRandomValues(new Uint8Array(48))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const challenge = base64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await env.GIFTS.put(`gmail_oauth:${state}`, JSON.stringify({ email: user.email.toLowerCase(), verifier }), { expirationTtl: 600 });
  const redirect = new URL("/api/gifts/gmail/callback", request.url).toString();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirect, response_type: "code", scope: `openid email ${SEND_SCOPE}`, state, access_type: "offline", prompt: "consent", login_hint: user.email, code_challenge: challenge, code_challenge_method: "S256" }).toString();
  return Response.json({ url: url.toString() });
}
export async function gmailCallback(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const stored = state && await env.GIFTS?.get(`gmail_oauth:${state}`);
  const destination = new URL(env.APP_URL || "https://ikonikstation.github.io/lingofusion-developers/playground/");
  const finish = (value) => { destination.searchParams.set("gmail", value); return Response.redirect(destination.toString(), 302); };
  if (!stored) return finish("invalid_state");
  await env.GIFTS.delete(`gmail_oauth:${state}`);
  if (url.searchParams.get("error") || !url.searchParams.get("code")) return finish("cancelled");
  const expected = JSON.parse(stored);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, code: url.searchParams.get("code"), code_verifier: expected.verifier, redirect_uri: new URL("/api/gifts/gmail/callback", request.url).toString(), grant_type: "authorization_code" }),
  });
  if (!response.ok) return finish("connection_failed");
  const tokens = await response.json();
  if (!tokens.refresh_token || !String(tokens.scope || "").split(" ").includes(SEND_SCOPE)) return finish("permission_required");
  const identityResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  if (!identityResponse.ok) return finish("connection_failed");
  const identity = await identityResponse.json();
  if (!identity.email_verified || String(identity.email || "").toLowerCase() !== expected.email) return finish("wrong_account");
  await env.GIFTS.put(`gmail:${expected.email}`, JSON.stringify(await encryptGmailToken(tokens.refresh_token, expected.email, env.SESSION_SECRET)));
  return finish("connected");
}
export function gmailRawMessage({ senderEmail, recipientEmail, subject, html, text, code }) {
  if (!validEmail(senderEmail) || !validEmail(recipientEmail)) throw new Error("Invalid gift email address.");
  const boundary = `lf_${String(code).replace(/[^a-z0-9_]/gi, "")}`;
  const encode = (value) => base64(new TextEncoder().encode(value));
  const encodedBody = (value) => encode(value).match(/.{1,76}/g)?.join("\r\n") || "";
  const mime = [`From: ${senderEmail}`, `To: ${recipientEmail}`, `Subject: =?UTF-8?B?${encode(subject)}?=`, `Message-ID: <${boundary}@gifts.lingofusion.dev>`, "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`, "", `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", encodedBody(text), `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", encodedBody(html), `--${boundary}--`, ""].join("\r\n");
  return encode(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function sendGiftFromGmail(gift, email, env) {
  const raw = await env.GIFTS.get(`gmail:${gift.senderEmail}`);
  if (!raw || !gmailConfigured(env)) throw new Error("The sender must connect Gmail before sending this gift.");
  const refreshToken = await decryptGmailToken(JSON.parse(raw), gift.senderEmail, env.SESSION_SECRET);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!tokenResponse.ok) throw new Error("Gmail permission needs to be reconnected before gift delivery can continue.");
  const token = await tokenResponse.json();
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: gmailRawMessage({ ...gift, ...email }) }) });
  if (!response.ok) throw new Error("Gmail did not accept the gift email. Delivery will be retried.");
  return response.json();
}
