// LingoFusion Authentication System (Google, Apple, Email)
// Manages user session, persistent accounts, and reactive state updates.

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
    if (!raw) return [DEFAULT_GUEST_USER];
    const parsed = JSON.parse(raw) as AuthUser[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // fallback
  }
  return [DEFAULT_GUEST_USER];
}

function recordKnownUser(user: AuthUser) {
  try {
    const existing = getKnownUsers();
    const updated = [user, ...existing.filter((u) => u.id !== user.id)].slice(0, 10);
    window.localStorage.setItem(USERS_INDEX_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function setCurrentUser(user: AuthUser) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  recordKnownUser(user);
  notifyAuth(user);
  // Dispatch custom storage event for multi-tab synchronization
  window.dispatchEvent(new Event("lingofusion-auth-changed"));
}

export function signInWithGoogle(customEmail?: string, customName?: string): AuthUser {
  const email = (customEmail?.trim() || "alex.chen.developer@gmail.com").toLowerCase();
  const rawName = customName?.trim() || email.split("@")[0].replace(/[._]/g, " ");
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const id = `usr_g_${btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;

  const user: AuthUser = {
    id,
    name,
    email,
    provider: "google",
    createdAt: new Date().toISOString(),
  };

  setCurrentUser(user);
  return user;
}

export function signInWithApple(customEmail?: string, customName?: string): AuthUser {
  const email = (customEmail?.trim() || "sarah.lingo@privaterelay.appleid.com").toLowerCase();
  const rawName = customName?.trim() || email.split("@")[0].replace(/[._]/g, " ");
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const id = `usr_ap_${btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;

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

export function signInWithEmail(emailInput: string, nameInput?: string): AuthUser {
  const email = emailInput.trim().toLowerCase();
  const rawName = nameInput?.trim() || email.split("@")[0].replace(/[._]/g, " ");
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const id = `usr_em_${btoa(email).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;

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
