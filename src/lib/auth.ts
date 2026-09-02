import type { LoginResult } from "@/types";

export function saveAuth(result: LoginResult) {
  if (!result.token || result.token === "undefined" || result.token === "null") {
    throw new Error("The server returned an invalid login token.");
  }
  localStorage.setItem("token", result.token);
  localStorage.removeItem("interview_token");
  document.cookie = `token=${encodeURIComponent(result.token)}; path=/; max-age=604800; SameSite=Lax`;
  localStorage.setItem("user", JSON.stringify(result.user));
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  document.cookie = "token=; Max-Age=0; path=/";
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem("user");
  if (!value || value === "undefined" || value === "null") return null;

  try {
    return JSON.parse(value);
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}