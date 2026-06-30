export async function getGoogleAuthUrl() {
  const res = await fetch("/auth/google-url");
  if (!res.ok) throw new Error("Failed to get Google Auth URL");
  return res.json();
}

export async function logout() {
  const res = await fetch("/auth/logout", { method: "POST" });
  if (!res.ok) throw new Error("Failed to log out");
  return res.json();
}

export async function getCurrentUser() {
  try {
    const res = await fetch("/auth/me");
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.error("Error fetching current user:", e);
    return null;
  }
}

export async function completeGoogleAuth(args: { data: string } | string) {
  const code = typeof args === "object" ? args.data : args;
  const res = await fetch(`/auth/google-callback?code=${encodeURIComponent(code)}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || "Failed to complete Google authentication");
  }
  return res.json();
}

export async function signInDev() {
  const res = await fetch("/auth/dev-login", { method: "POST" });
  if (!res.ok) throw new Error("Dev login failed");
  return res.json();
}
