// LingoFusion Authentication (Google OAuth / Sign in with Apple)
// The browser only ever holds a session token minted by the gateway after it
// has verified the provider's ID token server-side.

const DEFAULT_EDGE_GATEWAY_URL = String(
  import.meta.env.VITE_LINGOFUSION_GATEWAY_URL ||
    import.meta.env.VITE_LINGOFUSION_API_URL ||
    "https://lingofusion-gateway.lingofusion-api.workers.dev",
).replace(/\/$/, "");

export type AuthProvider = "google" | "apple" | "guest";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: AuthProvider;
  createdAt: string;
  sessionToken?: string;
  expiresAt?: number;
};

export type AuthConfig = { googleClientId: string; appleClientId: string };

const AUTH_STORAGE_KEY = "lingofusion_auth_user_v2";

const GUEST_USER: AuthUser = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Developer",
  email: "developer@lingofusion.dev",
  provider: "guest",
  createdAt: new Date().toISOString(),
};

type AuthListener = (user: AuthUser) => void;
const listeners = new Set<AuthListener>();

export function subscribeAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyAuth(user: AuthUser) {
  listeners.forEach((listener) => {
    try {
      listener(user);
    } catch (err) {
      console.error("Auth listener error:", err);
    }
  });
}

export function getCurrentUser(): AuthUser {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return GUEST_USER;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.id || !parsed.email || !parsed.sessionToken) return GUEST_USER;
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) return GUEST_USER;
    return parsed;
  } catch {
    return GUEST_USER;
  }
}

function setCurrentUser(user: AuthUser) {
  if (user.provider === "guest") {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } else {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  }
  notifyAuth(user);
}

let configPromise: Promise<AuthConfig> | null = null;

export function loadAuthConfig(): Promise<AuthConfig> {
  if (!configPromise) {
    configPromise = fetch(`${DEFAULT_EDGE_GATEWAY_URL}/api/auth/config`)
      .then((res) => (res.ok ? res.json() : { googleClientId: "", appleClientId: "" }))
      .then((cfg) => ({
        googleClientId: String(cfg.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || ""),
        appleClientId: String(cfg.appleClientId || import.meta.env.VITE_APPLE_CLIENT_ID || ""),
      }))
      .catch(() => {
        configPromise = null;
        return {
          googleClientId: String(import.meta.env.VITE_GOOGLE_CLIENT_ID || ""),
          appleClientId: String(import.meta.env.VITE_APPLE_CLIENT_ID || ""),
        };
      });
  }
  return configPromise;
}

type SessionResponse = {
  user: { id: string; name: string; email: string; avatar?: string | null; provider: "google" | "apple" };
  sessionToken: string;
  expiresAt: number;
  message?: string;
};

async function exchange(path: string, body: Record<string, unknown>): Promise<AuthUser> {
  const res = await fetch(`${DEFAULT_EDGE_GATEWAY_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as SessionResponse;
  if (!res.ok) throw new Error(data.message || "Sign-in failed. Please try again.");

  const user: AuthUser = {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    avatar: data.user.avatar || undefined,
    provider: data.user.provider,
    createdAt: new Date().toISOString(),
    sessionToken: data.sessionToken,
    expiresAt: data.expiresAt,
  };
  setCurrentUser(user);
  return user;
}

/** Called with the ID token (credential) from Google Identity Services. */
export function signInWithGoogleCredential(credential: string) {
  return exchange("/api/auth/google", { credential });
}

type AppleSignInResponse = {
  authorization: { id_token: string };
  user?: { name?: { firstName?: string; lastName?: string } };
};

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: Record<string, unknown>) => void;
        signIn: () => Promise<AppleSignInResponse>;
      };
    };
  }
}

function loadAppleSdk(): Promise<void> {
  if (window.AppleID) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Sign in with Apple."));
    document.head.appendChild(script);
  });
}

/** Opens Apple's official sign-in popup and exchanges the result for a session. */
export async function signInWithApple(clientId: string): Promise<AuthUser> {
  await loadAppleSdk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  window.AppleID!.auth.init({
    clientId,
    scope: "name email",
    redirectURI: `${window.location.origin}${basePath}/`,
    usePopup: true,
  });
  const result = await window.AppleID!.auth.signIn();
  const first = result.user?.name?.firstName || "";
  const last = result.user?.name?.lastName || "";
  const name = `${first} ${last}`.trim();
  return exchange("/api/auth/apple", { id_token: result.authorization.id_token, name });
}

export function signOut(): AuthUser {
  setCurrentUser(GUEST_USER);
  return GUEST_USER;
}
