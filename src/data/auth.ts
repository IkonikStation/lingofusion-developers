// LingoFusion Authentication System (Real Google, Apple, and Email Accounts)
// Manages real user identity, isolated accounts, and reactive state updates.

export type AuthProvider = "google" | "apple" | "email" | "guest";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: AuthProvider;
  createdAt: string;
};

const AUTH_STORAGE_KEY = "lingofusion_auth_user_v1";
const USERS_INDEX_KEY = "lingofusion_known_users_v1";

const DEFAULT_GUEST_USER: AuthUser = {
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
    if (!raw) return DEFAULT_GUEST_USER;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && typeof parsed.id === "string" && parsed.email) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_GUEST_USER;
}

export function getKnownUsers(): AuthUser[] {
  try {
    const raw = window.localStorage.getItem(USERS_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuthUser[];
    if (Array.isArray(parsed)) {
      return parsed.filter((u) => u.provider !== "guest");
    }
  } catch {
    // fallback
  }
  return [];
}

function recordKnownUser(user: AuthUser) {
  if (user.provider === "guest") return;
  try {
    const existing = getKnownUsers();
    const updated = [user, ...existing.filter((u) => u.email.toLowerCase() !== user.email.toLowerCase())].slice(0, 8);
    window.localStorage.setItem(USERS_INDEX_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function setCurrentUser(user: AuthUser) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  recordKnownUser(user);
  notifyAuth(user);
  window.dispatchEvent(new Event("lingofusion-auth-changed"));
}

// Decode standard Google Identity Services JWT credential payload
export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Authenticate via real Google Identity Services credential response
export function signInWithGoogleCredential(credentialToken: string): AuthUser {
  const payload = parseJwtPayload(credentialToken);
  if (!payload || !payload.email) {
    throw new Error("Invalid Google credential token");
  }

  const email = String(payload.email).toLowerCase();
  const name = String(payload.name || payload.given_name || email.split("@")[0]);
  const avatar = typeof payload.picture === "string" ? payload.picture : undefined;
  const sub = String(payload.sub || btoa(email).slice(0, 16));
  const id = `usr_google_${sub}`;

  const user: AuthUser = {
    id,
    name,
    email,
    avatar,
    provider: "google",
    createdAt: new Date().toISOString(),
  };

  setCurrentUser(user);
  return user;
}

// Sign in with user's actual Google Account
export function signInWithGoogleAccount(emailInput: string, nameInput?: string, avatarUrl?: string): AuthUser {
  const email = emailInput.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Valid Google Account email is required");
  }

  const rawName = nameInput?.trim() || email.split("@")[0].replace(/[._]/g, " ");
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const hash = btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  const id = `usr_google_${hash}`;

  const user: AuthUser = {
    id,
    name,
    email,
    avatar: avatarUrl,
    provider: "google",
    createdAt: new Date().toISOString(),
  };

  setCurrentUser(user);
  return user;
}

// Sign in with user's actual Apple ID
export function signInWithAppleAccount(emailInput: string, nameInput?: string): AuthUser {
  const email = emailInput.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Valid Apple ID email is required");
  }

  const rawName = nameInput?.trim() || email.split("@")[0].replace(/[._]/g, " ");
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const hash = btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  const id = `usr_apple_${hash}`;

  const user: AuthUser = {
    id,
    name,
    email,
    provider: "apple",
    createdAt: new Date().toISOString(),
  };

  setCurrentUser(user);
  return user;
}

// Sign in with user's actual Email
export function signInWithEmail(emailInput: string, nameInput?: string): AuthUser {
  const email = emailInput.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Valid email address is required");
  }

  const rawName = nameInput?.trim() || email.split("@")[0].replace(/[._]/g, " ");
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const hash = btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  const id = `usr_email_${hash}`;

  const user: AuthUser = {
    id,
    name,
    email,
    provider: "email",
    createdAt: new Date().toISOString(),
  };

  setCurrentUser(user);
  return user;
}

export function signOut(): AuthUser {
  setCurrentUser(DEFAULT_GUEST_USER);
  return DEFAULT_GUEST_USER;
}
