import { createServerFn } from "@tanstack/react-start";
import { ObjectId } from "mongodb";

interface UserDoc {
  _id?: ObjectId;
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatar: string;
  picture?: string;
  playerId: string;
  teamId?: string;
  createdAt: Date;
}

interface SessionDoc {
  _id: string;
  userId: string;
  expiresAt: Date;
}

// Helper to get initials from a name
function getInitials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// 1. Get Google OAuth URL
export const getGoogleAuthUrl = createServerFn({ method: "GET" }).handler(async () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Missing Google OAuth credentials in environment configuration.");
  }

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=openid%20profile%20email&prompt=select_account`;

  return { url };
});

// 2. Clear Session (Log Out)
export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { getCookie, deleteCookie } = await import("@tanstack/react-start/server");

  const sessionId = getCookie("sn_session");

  if (sessionId) {
    try {
      const { connectToDatabase } = await import("./db");
      const { db } = await connectToDatabase();
      await db.collection<SessionDoc>("sessions").deleteOne({ _id: sessionId });
    } catch (e) {
      console.error("Error deleting session from MongoDB:", e);
    }
  }

  deleteCookie("sn_session", { path: "/" });
  return { success: true };
});

// 3. Get Currently Authenticated User
export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie, deleteCookie } = await import("@tanstack/react-start/server");

  const sessionId = getCookie("sn_session");
  if (!sessionId) return null;

  try {
    const { connectToDatabase } = await import("./db");
    const { db } = await connectToDatabase();

    // Find session
    const session = await db.collection<SessionDoc>("sessions").findOne({ _id: sessionId });
    if (!session || new Date() > new Date(session.expiresAt)) {
      if (session) {
        await db.collection<SessionDoc>("sessions").deleteOne({ _id: sessionId });
      }
      deleteCookie("sn_session", { path: "/" });
      return null;
    }

    // Find user
    const user = await db.collection<UserDoc>("users").findOne({ id: session.userId });
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      playerId: user.playerId,
      teamId: user.teamId,
    };
  } catch (e) {
    console.error("Database error in getCurrentUser:", e);
    return null;
  }
});

// 4. Complete Google Auth (Server Function to exchange code for session)
export const completeGoogleAuth = createServerFn({ method: "GET" })
  .validator((code: unknown) => (typeof code === "string" ? code : ""))
  .handler(async ({ data: code }) => {
    if (!code) throw new Error("Code is required");

    const { setCookie } = await import("@tanstack/react-start/server");
    const { connectToDatabase } = await import("./db");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Google OAuth credentials in environment configuration.");
    }

    // A. Exchange code for access & ID tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Google token exchange failed: ${errText}`);
    }

    const tokens = await tokenResponse.json();

    // B. Get user info using access token
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch Google user profile info.");
    }

    const googleUser = await userInfoResponse.json();
    const { sub, email, name, picture } = googleUser;

    // C. Save or retrieve user from MongoDB
    const { db } = await connectToDatabase();

    let user: UserDoc | null = await db.collection<UserDoc>("users").findOne({ googleId: sub });

    if (!user) {
      const userId = `u_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
      const playerId = `p_user_${Math.random().toString(36).slice(2, 9)}`;

      const newUser: UserDoc = {
        id: userId,
        googleId: sub,
        email,
        name,
        avatar: getInitials(name),
        picture,
        playerId,
        createdAt: new Date(),
      };

      await db.collection<UserDoc>("users").insertOne(newUser);
      user = newUser;
    }

    // D. Create session and set cookie
    const sessionId = `sess_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.collection<SessionDoc>("sessions").insertOne({
      _id: sessionId,
      userId: user.id,
      expiresAt,
    });

    setCookie("sn_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      playerId: user.playerId,
      teamId: user.teamId,
    };
  });
