import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import { connectToDatabase } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, "../frontend/.env");
if (fs.existsSync(envPath)) {
  const envResult = dotenv.config({ path: envPath });
  if (envResult.error) {
    console.error("Dotenv load error:", envResult.error);
  } else {
    console.log("Successfully loaded .env file from path:", envPath);
    console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "Found" : "NOT FOUND");
    console.log("GOOGLE_REDIRECT_URI:", process.env.GOOGLE_REDIRECT_URI ? "Found" : "NOT FOUND");
  }
} else {
  console.log("No local .env file found; using host environment variables.");
}

// Configure Cloudinary explicitly by parsing the CLOUDINARY_URL
if (process.env.CLOUDINARY_URL) {
  const match = process.env.CLOUDINARY_URL.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  if (match) {
    cloudinary.config({
      api_key: match[1],
      api_secret: match[2],
      cloud_name: match[3],
      secure: true
    });
  } else {
    console.error("Cloudinary Error: CLOUDINARY_URL pattern did not match.");
  }
} else {
  console.error("Cloudinary Error: CLOUDINARY_URL is not set.");
}

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:8080",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith(".vercel.app") || origin.includes("localhost")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

// Helper to get currently authenticated user from session cookie
async function getUserFromRequest(req) {
  const sessionId = req.cookies.sn_session;
  if (!sessionId) return null;

  try {
    const { db } = await connectToDatabase();
    const session = await db.collection("sessions").findOne({ _id: sessionId });
    if (!session || new Date() > new Date(session.expiresAt)) {
      if (session) {
        await db.collection("sessions").deleteOne({ _id: sessionId });
      }
      return null;
    }

    const user = await db.collection("users").findOne({ id: session.userId });
    return user;
  } catch (e) {
    console.error("Error in getUserFromRequest:", e);
    return null;
  }
}

// Get initials from name helper
function getInitials(name) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// --- SSE REAL-TIME NOTIFICATIONS ---
// ponytail: in-memory map, no Redis needed for single-server
const sseClients = new Map(); // Map<playerId, Set<Response>>

function broadcastToPlayer(playerId, event) {
  const clients = sseClients.get(playerId);
  if (!clients || clients.size === 0) return;
  const data = JSON.stringify(event);
  for (const res of clients) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch {
      clients.delete(res);
    }
  }
}

// ponytail: helper to store a notification in DB and broadcast via SSE
async function createAndBroadcastNotification(db, { recipientId, title, body, type, icon, actionData }) {
  const notif = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    recipientId,
    title,
    body,
    type: type || "info",
    icon: icon || "user",
    actionData: actionData || null,
    read: false,
    time: new Date().toISOString(),
  };
  await db.collection("notifications").insertOne(notif);
  broadcastToPlayer(recipientId, { type: notif.type, notification: notif });
}

app.get("/api/notifications/stream", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user || !user.playerId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // ponytail: disable nginx buffering
  });
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  // Register this connection
  if (!sseClients.has(user.playerId)) {
    sseClients.set(user.playerId, new Set());
  }
  sseClients.get(user.playerId).add(res);

  // Heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(user.playerId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) sseClients.delete(user.playerId);
    }
  });
});

// --- AUTH ENDPOINTS ---

app.get("/auth/me", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.json(null);
  }
  
  const { db } = await connectToDatabase();
  const dbUser = await db.collection("users").findOne({ id: user.id });
  let playerCode = dbUser?.playerCode;
  
  if (!playerCode) {
    playerCode = Math.floor(10000000 + Math.random() * 90000000).toString();
    await db.collection("users").updateOne({ id: user.id }, { $set: { playerCode } });
  }

  if (user.playerId) {
    const playerDoc = await db.collection("players").findOne({ id: user.playerId });
    if (playerDoc && !playerDoc.playerCode) {
      await db.collection("players").updateOne({ id: user.playerId }, { $set: { playerCode } });
    }
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    picture: user.picture || null,
    playerId: user.playerId,
    teamId: user.teamId,
    playerCode,
    onboardedProfile: dbUser?.onboardedProfile || false,
  });
});

app.post("/auth/logout", async (req, res) => {
  const sessionId = req.cookies.sn_session;
  if (sessionId) {
    try {
      const { db } = await connectToDatabase();
      await db.collection("sessions").deleteOne({ _id: sessionId });
    } catch (e) {
      console.error("Error deleting session:", e);
    }
  }
  res.clearCookie("sn_session", {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
  });
  res.json({ success: true });
});

app.post("/auth/dev-login", async (req, res) => {
  try {
    const { db } = await connectToDatabase();

    let user = await db.collection("users").findOne({ id: "u_dev" });
    if (!user) {
      user = {
        id: "u_dev",
        googleId: "dev_google_id_123456",
        email: "aarav.sharma@gmail.com",
        name: "Aarav Sharma",
        avatar: "AS",
        picture: null,
        playerId: "p_0", 
        teamId: "t_0",   
        createdAt: new Date(),
      };
      await db.collection("users").insertOne(user);
    }

    const sessionId = "sess_dev_session_key_999999";
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.collection("sessions").updateOne(
      { _id: sessionId },
      { $set: { userId: user.id, expiresAt } },
      { upsert: true }
    );

    res.cookie("sn_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      picture: user.picture || null,
      playerId: user.playerId,
      teamId: user.teamId,
    });
  } catch (e) {
    console.error("Dev login error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Extract public ID from Cloudinary URL
function getPublicIdFromUrl(url) {
  if (!url || !url.includes("cloudinary.com")) return null;
  const parts = url.split("/upload/");
  if (parts.length < 2) return null;
  const pathSegment = parts[1].replace(/^v\d+\//, "");
  const lastDotIndex = pathSegment.lastIndexOf(".");
  return lastDotIndex === -1 ? pathSegment : pathSegment.substring(0, lastDotIndex);
}

// Helper to delete image from Cloudinary if it is a Cloudinary URL
async function deleteFromCloudinary(url) {
  const publicId = getPublicIdFromUrl(url);
  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.error("Failed to delete old image from Cloudinary:", err);
    }
  }
}

app.post("/api/users/profile-picture", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "You must be logged in to update your profile picture" });
    }

    const { picture, action } = req.body;
    let newPicture = null;

    // Retrieve the user to check and delete their old photo from Cloudinary
    const dbUser = await db.collection("users").findOne({ id: user.id });

    if (action === "remove") {
      if (dbUser?.picture) {
        await deleteFromCloudinary(dbUser.picture);
      }
      newPicture = null;
    } else if (action === "restore_google") {
      if (dbUser?.picture) {
        await deleteFromCloudinary(dbUser.picture);
      }
      newPicture = dbUser?.googlePicture || null;
    } else {
      if (!picture) {
        return res.status(400).json({ error: "Picture data is required" });
      }

      if (dbUser?.picture) {
        await deleteFromCloudinary(dbUser.picture);
      }

      // Upload base64 picture to Cloudinary inside folder Sports/profile with auto optimization
      const uploadRes = await cloudinary.uploader.upload(picture, {
        folder: "Sports/profile",
        quality: "auto",
        fetch_format: "auto",
        transformation: [
          { width: 400, height: 400, crop: "fill" }
        ]
      });

      newPicture = uploadRes.secure_url;
    }

    // Update users collection
    await db.collection("users").updateOne(
      { id: user.id },
      { $set: { picture: newPicture } }
    );

    res.json({ success: true, picture: newPicture });
  } catch (e) {
    console.error("Profile picture upload error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/auth/google-url", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: "Missing Google OAuth credentials" });
  }

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=openid%20profile%20email&prompt=select_account`;

  res.json({ url });
});

app.get("/auth/google-callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("Authorization code is required");
  }

  try {
    const { db } = await connectToDatabase();
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Google OAuth credentials");
    }

    // Exchange code for tokens
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

    // Get user profile
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch Google user profile info");
    }

    const googleUser = await userInfoResponse.json();
    const { sub, email, name, picture } = googleUser;

    let user = await db.collection("users").findOne({ googleId: sub });
    if (!user) {
      const userId = `u_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
      const playerId = `p_user_${Math.random().toString(36).slice(2, 9)}`;

      user = {
        id: userId,
        googleId: sub,
        email,
        name,
        avatar: getInitials(name),
        picture,
        googlePicture: picture,
        playerId,
        createdAt: new Date(),
      };

      await db.collection("users").insertOne(user);
    } else {
      const updateFields = { googlePicture: picture };
      if (!user.picture) {
        updateFields.picture = picture;
        user.picture = picture;
      }
      await db.collection("users").updateOne(
        { googleId: sub },
        { $set: updateFields }
      );
      user.googlePicture = picture;
    }

    const sessionId = `sess_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.collection("sessions").insertOne({
      _id: sessionId,
      userId: user.id,
      expiresAt,
    });

    res.cookie("sn_session", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    // Return success JSON response to fetch
    res.json({ success: true });
  } catch (e) {
    console.error("Google Auth Callback Error:", e);
    res.status(500).send("Authentication failed: " + e.message);
  }
});

// Helper to sanitize tournament details (hides code from non-creators)
function sanitizeTournament(t, currentUser) {
  if (!t) return null;
  const isCreator = currentUser && (t.organizerId === currentUser.id || t.organizer === currentUser.name);
  if (!isCreator) {
    const copy = { ...t };
    delete copy.code;
    return copy;
  }
  return t;
}

// Helper to filter visible tournaments (shows upcoming only to creator or members)
async function filterTournaments(list, currentUser, db) {
  const upcoming = list.filter(t => t.status === "upcoming");
  const other = list.filter(t => t.status !== "upcoming");

  if (upcoming.length === 0) return list;
  if (!currentUser) return other;

  // Find all teams where the current user is a player
  const userTeams = await db.collection("teams").find({ playerIds: currentUser.playerId }).toArray();
  const userTournamentIds = userTeams.map(team => team.tournamentId);

  const visibleUpcoming = upcoming.filter(t => {
    const isCreator = t.organizerId === currentUser.id || t.organizer === currentUser.name;
    const isMember = userTournamentIds.includes(t.id);
    return isCreator || isMember;
  });

  return [...other, ...visibleUpcoming];
}

// --- API ENDPOINTS ---

app.get("/api/tournaments", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    const list = await db.collection("tournaments").find().toArray();
    const filtered = await filterTournaments(list, user, db);
    const sanitized = filtered.map(t => sanitizeTournament(t, user));
    res.json(sanitized);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/tournaments/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    const item = await db.collection("tournaments").findOne({ id: req.params.id });
    if (!item) return res.status(404).json({ error: "Tournament not found" });

    if (item.status === "upcoming") {
      if (!user) {
        return res.status(403).json({ error: "Access denied: You must be logged in to view this upcoming tournament." });
      }
      const isCreator = item.organizerId === user.id || item.organizer === user.name;
      const userTeams = await db.collection("teams").find({ playerIds: user.playerId }).toArray();
      const userTournamentIds = userTeams.map(team => team.tournamentId);
      const isMember = userTournamentIds.includes(item.id);

      if (!isCreator && !isMember) {
        return res.status(403).json({ error: "Access denied: You have not joined this upcoming tournament." });
      }
    }

    res.json(sanitizeTournament(item, user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/teams", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const list = await db.collection("teams").find().toArray();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/teams/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const item = await db.collection("teams").findOne({ id: req.params.id });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/teams/:id/players", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const team = await db.collection("teams").findOne({ id: req.params.id });
    if (!team) return res.json([]);
    
    const list = await db.collection("players").find({ id: { $in: team.playerIds || [] } }).toArray();
    
    // Find corresponding users to get their active profile pictures
    const playerIds = list.map(p => p.id);
    const users = await db.collection("users").find({ playerId: { $in: playerIds } }).toArray();
    
    const userMap = {};
    users.forEach(u => {
      if (u.playerId) {
        userMap[u.playerId] = u.picture;
      }
    });

    const populatedList = list.map(p => ({
      ...p,
      picture: userMap[p.id] || null
    }));

    res.json(populatedList);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/players/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    let item = await db.collection("players").findOne({ id: req.params.id });
    const userDoc = await db.collection("users").findOne({ playerId: req.params.id });

    if (!item) {
      if (!userDoc) {
        return res.json(null);
      }
      
      // Fallback/virtual player doc for users who haven't joined a team/tournament yet
      item = {
        id: req.params.id,
        name: userDoc.name,
        initials: userDoc.avatar || (userDoc.name ? getInitials(userDoc.name) : "P"),
        role: userDoc.role || "All-rounder",
        battingStyle: userDoc.battingStyle || "Right-hand",
        bowlingStyle: userDoc.bowlingStyle || "Right-arm medium",
        age: userDoc.age || 25,
        country: userDoc.country || "India",
        city: userDoc.city || "Mumbai",
        jersey: userDoc.jersey || 7,
        playerCode: userDoc.playerCode,
        stats: { matches: 0, innings: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highScore: 0, notOuts: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, bestBowling: "0/0", catches: 0, stumpings: 0 },
        achievements: [],
        joinedAt: new Date().toISOString().slice(0, 10),
      };
    }
    
    let playerCode = item.playerCode || userDoc?.playerCode;
    if (!playerCode) {
      playerCode = Math.floor(10000000 + Math.random() * 90000000).toString();
      if (userDoc) {
        await db.collection("users").updateOne({ id: userDoc.id }, { $set: { playerCode } });
      }
      item.playerCode = playerCode;
    }
    
    res.json({
      ...item,
      picture: userDoc?.picture || null,
      playerCode
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/players/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "You must be logged in to update your profile" });
    }

    const playerId = req.params.id;
    if (user.playerId !== playerId) {
      return res.status(403).json({ error: "Access denied: You cannot update another player's profile" });
    }

    const { city, country, role, battingStyle, bowlingStyle, jersey, age, onboardedProfile } = req.body;

    const updateFields = {};
    if (city !== undefined) updateFields.city = city;
    if (country !== undefined) updateFields.country = country;
    if (role !== undefined) updateFields.role = role;
    if (battingStyle !== undefined) updateFields.battingStyle = battingStyle;
    if (bowlingStyle !== undefined) updateFields.bowlingStyle = bowlingStyle;
    if (jersey !== undefined) {
      updateFields.jersey = jersey === null || jersey === "" ? null : Number(jersey);
    }
    if (age !== undefined) {
      updateFields.age = age === null || age === "" ? null : Number(age);
    }
    if (onboardedProfile !== undefined) {
      updateFields.onboardedProfile = onboardedProfile;
    }

    // Update users document
    await db.collection("users").updateOne(
      { id: user.id },
      { $set: updateFields }
    );

    // Get user code & initials to form default player object if not exists
    const dbUser = await db.collection("users").findOne({ id: user.id });
    const playerCode = dbUser?.playerCode || Math.floor(10000000 + Math.random() * 90000000).toString();
    const initials = user.name ? user.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() : "P";

    const defaults = {
      id: playerId,
      name: user.name,
      initials,
      playerCode,
      stats: { matches: 0, innings: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highScore: 0, notOuts: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, bestBowling: "0/0", catches: 0, stumpings: 0 },
      achievements: [],
      joinedAt: new Date().toISOString().slice(0, 10),
    };

    if (city === undefined) defaults.city = "Mumbai";
    if (country === undefined) defaults.country = "India";
    if (role === undefined) defaults.role = "All-rounder";
    if (battingStyle === undefined) defaults.battingStyle = "Right-hand";
    if (bowlingStyle === undefined) defaults.bowlingStyle = "Right-arm medium";
    if (jersey === undefined) defaults.jersey = 7;
    if (age === undefined) defaults.age = 25;

    await db.collection("players").updateOne(
      { id: playerId },
      { 
        $set: updateFields,
        $setOnInsert: defaults
      },
      { upsert: true }
    );

    const updatedPlayer = await db.collection("players").findOne({ id: playerId });
    const updatedUser = await db.collection("users").findOne({ id: user.id });
    
    res.json({
      ...updatedPlayer,
      picture: updatedUser?.picture || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/matches", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const list = await db.collection("matches").find().sort({ date: -1 }).toArray();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/matches/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const item = await db.collection("matches").findOne({ id: req.params.id });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/tournaments/:id/matches", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const list = await db.collection("matches").find({ tournamentId: req.params.id }).toArray();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/certificates", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const list = await db.collection("certificates").find().toArray();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/players/:id/certificates", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const list = await db.collection("certificates").find({ playerId: req.params.id }).toArray();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/notifications", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    const { db } = await connectToDatabase();
    // ponytail: filter by recipientId, fallback to all for backwards compat
    const query = user?.playerId ? { recipientId: user.playerId } : {};
    const list = await db.collection("notifications").find(query).sort({ time: -1 }).limit(50).toArray();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- FRIENDS ENDPOINTS ---

app.get("/api/friends", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.playerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { db } = await connectToDatabase();
    
    const rels = await db.collection("friends").find({
      $or: [
        { senderId: user.playerId },
        { receiverId: user.playerId }
      ]
    }).toArray();

    const acceptedIds = [];
    const pendingReceivedIds = [];
    const pendingSentIds = [];

    rels.forEach(r => {
      if (r.status === "accepted") {
        const friendId = r.senderId === user.playerId ? r.receiverId : r.senderId;
        acceptedIds.push(friendId);
      } else if (r.status === "pending") {
        if (r.receiverId === user.playerId) {
          pendingReceivedIds.push(r.senderId);
        } else {
          pendingSentIds.push(r.receiverId);
        }
      }
    });

    const getPlayerSummaries = async (ids) => {
      if (ids.length === 0) return [];
      const users = await db.collection("users").find({ playerId: { $in: ids } }).toArray();
      const players = await db.collection("players").find({ id: { $in: ids } }).toArray();
      
      return users.map(u => {
        const p = players.find(play => play.id === u.playerId);
        return {
          id: u.playerId,
          name: u.name,
          initials: u.avatar || (u.name ? getInitials(u.name) : "P"),
          role: p?.role || "Player",
          picture: u.picture || null,
          playerCode: u.playerCode || p?.playerCode
        };
      });
    };

    const [friends, pendingReceived, pendingSent] = await Promise.all([
      getPlayerSummaries(acceptedIds),
      getPlayerSummaries(pendingReceivedIds),
      getPlayerSummaries(pendingSentIds)
    ]);

    res.json({ friends, pendingReceived, pendingSent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/friends/mutual/:playerId", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.playerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const targetPlayerId = req.params.playerId;
    if (user.playerId === targetPlayerId) {
      return res.json([]);
    }
    const { db } = await connectToDatabase();

    // 1. Get logged-in user's friends
    const userRels = await db.collection("friends").find({
      status: "accepted",
      $or: [
        { senderId: user.playerId },
        { receiverId: user.playerId }
      ]
    }).toArray();
    const userFriendIds = userRels.map(r => r.senderId === user.playerId ? r.receiverId : r.senderId);

    // 2. Get target player's friends
    const targetRels = await db.collection("friends").find({
      status: "accepted",
      $or: [
        { senderId: targetPlayerId },
        { receiverId: targetPlayerId }
      ]
    }).toArray();
    const targetFriendIds = targetRels.map(r => r.senderId === targetPlayerId ? r.receiverId : r.senderId);

    // 3. Intersect
    const mutualIds = userFriendIds.filter(id => targetFriendIds.includes(id));
    if (mutualIds.length === 0) {
      return res.json([]);
    }

    // 4. Get player & user info
    const users = await db.collection("users").find({ playerId: { $in: mutualIds } }).toArray();
    const players = await db.collection("players").find({ id: { $in: mutualIds } }).toArray();

    const result = users.map(u => {
      const p = players.find(play => play.id === u.playerId);
      return {
        id: u.playerId,
        name: u.name,
        initials: u.avatar || (u.name ? getInitials(u.name) : "P"),
        role: p?.role || "Player",
        picture: u.picture || null,
        playerCode: u.playerCode || p?.playerCode
      };
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/players/search-code/:code", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { db } = await connectToDatabase();
    const u = await db.collection("users").findOne({ playerCode: req.params.code });
    if (!u) {
      // fallback to search in players if not found in users
      const player = await db.collection("players").findOne({ playerCode: req.params.code });
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      const linkedUser = await db.collection("users").findOne({ playerId: player.id });
      return res.json({
        id: player.id,
        name: player.name,
        initials: player.initials,
        role: player.role,
        picture: linkedUser?.picture || null,
        playerCode: player.playerCode
      });
    }

    const p = await db.collection("players").findOne({ id: u.playerId });
    res.json({
      id: u.playerId,
      name: u.name,
      initials: u.avatar || (u.name ? getInitials(u.name) : "P"),
      role: p?.role || "Player",
      picture: u.picture || null,
      playerCode: u.playerCode
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/friends/request", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.playerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { friendCode, targetPlayerId } = req.body;
    const { db } = await connectToDatabase();

    let targetPlayer = null;
    if (friendCode) {
      const u = await db.collection("users").findOne({ playerCode: friendCode });
      if (u) {
        const p = await db.collection("players").findOne({ id: u.playerId });
        targetPlayer = {
          id: u.playerId,
          name: u.name,
          role: p?.role || "Player",
        };
      } else {
        const p = await db.collection("players").findOne({ playerCode: friendCode });
        if (p) targetPlayer = p;
      }
    } else if (targetPlayerId) {
      const u = await db.collection("users").findOne({ playerId: targetPlayerId });
      if (u) {
        const p = await db.collection("players").findOne({ id: u.playerId });
        targetPlayer = {
          id: u.playerId,
          name: u.name,
          role: p?.role || "Player",
        };
      } else {
        const p = await db.collection("players").findOne({ id: targetPlayerId });
        if (p) targetPlayer = p;
      }
    }

    if (!targetPlayer) {
      return res.status(404).json({ error: "Player not found" });
    }

    if (targetPlayer.id === user.playerId) {
      return res.status(400).json({ error: "You cannot add yourself as a friend" });
    }

    const existing = await db.collection("friends").findOne({
      $or: [
        { senderId: user.playerId, receiverId: targetPlayer.id },
        { senderId: targetPlayer.id, receiverId: user.playerId }
      ]
    });

    if (existing) {
      if (existing.status === "accepted") {
        return res.status(400).json({ error: "Already friends" });
      }
      if (existing.senderId === user.playerId) {
        return res.status(400).json({ error: "Friend request already sent" });
      }
      if (existing.receiverId === user.playerId) {
        await db.collection("friends").updateOne(
          { _id: existing._id },
          { $set: { status: "accepted", updatedAt: new Date().toISOString() } }
        );
        return res.json({ status: "accepted" });
      }
    }

    const invite = {
      id: `f_rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: user.playerId,
      receiverId: targetPlayer.id,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection("friends").insertOne(invite);

    // ponytail: broadcast real-time notification to receiver
    const senderPlayer = await db.collection("players").findOne({ id: user.playerId });
    await createAndBroadcastNotification(db, {
      recipientId: targetPlayer.id,
      title: "Friend Request",
      body: `${senderPlayer?.name || user.name} sent you a friend request`,
      type: "friend_request",
      icon: "user",
      actionData: { senderId: user.playerId }
    });

    res.json({ status: "pending" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/friends/respond", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.playerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { targetPlayerId, action } = req.body;
    const { db } = await connectToDatabase();

    const query = {
      $or: [
        { senderId: user.playerId, receiverId: targetPlayerId },
        { senderId: targetPlayerId, receiverId: user.playerId }
      ]
    };

    const relation = await db.collection("friends").findOne(query);
    if (!relation) {
      return res.status(404).json({ error: "Friendship relationship not found" });
    }

    if (action === "accept") {
      if (relation.receiverId !== user.playerId) {
        return res.status(403).json({ error: "Only the recipient can accept a friend request" });
      }
      await db.collection("friends").updateOne(
        { _id: relation._id },
        { $set: { status: "accepted", updatedAt: new Date().toISOString() } }
      );

      // ponytail: mark the original friend_request notification as acted on
      await db.collection("notifications").updateOne(
        { recipientId: user.playerId, type: "friend_request", "actionData.senderId": targetPlayerId, acted: { $ne: true } },
        { $set: { acted: true, actedAction: "accepted" } }
      );

      // ponytail: notify the original sender that their request was accepted
      const acceptorPlayer = await db.collection("players").findOne({ id: user.playerId });
      await createAndBroadcastNotification(db, {
        recipientId: relation.senderId,
        title: "Friend Request Accepted",
        body: `${acceptorPlayer?.name || "Someone"} accepted your friend request`,
        type: "friend_accepted",
        icon: "user",
        actionData: { playerId: user.playerId }
      });

      res.json({ success: true, status: "accepted" });
    } else if (action === "decline" || action === "cancel" || action === "unfriend") {
      // ponytail: mark the original friend_request notification as acted on
      await db.collection("notifications").updateOne(
        { recipientId: user.playerId, type: "friend_request", "actionData.senderId": targetPlayerId, acted: { $ne: true } },
        { $set: { acted: true, actedAction: "declined" } }
      );

      await db.collection("friends").deleteOne({ _id: relation._id });
      res.json({ success: true, status: "none" });
    } else {
      res.status(400).json({ error: "Invalid action" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- SQUAD INVITE ENDPOINTS ---

app.post("/api/squad-invites/send", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.playerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { db } = await connectToDatabase();
    const { teamId, targetPlayerId } = req.body;

    const team = await db.collection("teams").findOne({ id: teamId });
    if (!team) return res.status(404).json({ error: "Team not found" });
    if (team.captainId !== user.playerId) {
      return res.status(403).json({ error: "Only the captain can send squad invites" });
    }

    // Check target is a friend
    const friendship = await db.collection("friends").findOne({
      status: "accepted",
      $or: [
        { senderId: user.playerId, receiverId: targetPlayerId },
        { senderId: targetPlayerId, receiverId: user.playerId }
      ]
    });
    if (!friendship) return res.status(400).json({ error: "You can only invite friends" });

    // Check target not already in any team in this tournament
    const tournamentTeams = await db.collection("teams").find({ tournamentId: team.tournamentId }).toArray();
    const alreadyInTournament = tournamentTeams.some(t => t.playerIds.includes(targetPlayerId));
    if (alreadyInTournament) {
      return res.status(400).json({ error: "Player is already in a team in this tournament" });
    }

    // Check no duplicate pending invite
    const existingInvite = await db.collection("squad_invites").findOne({
      teamId, receiverId: targetPlayerId, status: "pending"
    });
    if (existingInvite) return res.status(400).json({ error: "Invite already sent" });

    const tournament = await db.collection("tournaments").findOne({ id: team.tournamentId });
    const invite = {
      id: `si_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      teamId,
      tournamentId: team.tournamentId,
      senderId: user.playerId,
      receiverId: targetPlayerId,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    await db.collection("squad_invites").insertOne(invite);

    // Broadcast notification
    const senderPlayer = await db.collection("players").findOne({ id: user.playerId });
    await createAndBroadcastNotification(db, {
      recipientId: targetPlayerId,
      title: "Squad Invite",
      body: `${senderPlayer?.name || "A captain"} invited you to join ${team.name} in ${tournament?.name || "a tournament"}`,
      type: "squad_invite",
      icon: "trophy",
      actionData: { inviteId: invite.id, teamId, teamName: team.name, tournamentName: tournament?.name }
    });

    res.json({ success: true, invite });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/squad-invites/respond", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.playerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { db } = await connectToDatabase();
    const { inviteId, action } = req.body;

    const invite = await db.collection("squad_invites").findOne({ id: inviteId });
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.receiverId !== user.playerId) {
      return res.status(403).json({ error: "This invite is not for you" });
    }
    if (invite.status !== "pending") {
      return res.status(400).json({ error: "Invite already responded to" });
    }

    if (action === "accept") {
      // Check not already in a team in this tournament
      const tournamentTeams = await db.collection("teams").find({ tournamentId: invite.tournamentId }).toArray();
      const alreadyInTournament = tournamentTeams.some(t => t.playerIds.includes(user.playerId));
      if (alreadyInTournament) {
        await db.collection("squad_invites").updateOne({ id: inviteId }, { $set: { status: "expired" } });
        return res.status(400).json({ error: "You are already in a team in this tournament" });
      }

      const team = await db.collection("teams").findOne({ id: invite.teamId });
      if (!team) return res.status(404).json({ error: "Team no longer exists" });

      // Add player to team
      await db.collection("teams").updateOne(
        { id: invite.teamId },
        { $addToSet: { playerIds: user.playerId } }
      );

      // Ensure player profile exists
      const dbUser = await db.collection("users").findOne({ id: user.id });
      const playerExists = await db.collection("players").findOne({ id: user.playerId });
      if (!playerExists) {
        await db.collection("players").insertOne({
          id: user.playerId,
          name: user.name,
          initials: getInitials(user.name),
          role: "All-rounder",
          battingStyle: "Right-hand",
          bowlingStyle: "Right-arm medium",
          teamId: team.id,
          playerCode: dbUser?.playerCode || Math.floor(10000000 + Math.random() * 90000000).toString(),
          age: 25,
          country: "India",
          city: team.city,
          jersey: 7,
          stats: { matches: 0, innings: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0, highScore: 0, notOuts: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, bestBowling: "0/0", catches: 0, stumpings: 0 },
          achievements: [],
          joinedAt: new Date().toISOString().slice(0, 10),
        });
      } else {
        await db.collection("players").updateOne({ id: user.playerId }, { $set: { teamId: team.id } });
      }
      await db.collection("users").updateOne({ id: user.id }, { $set: { teamId: team.id } });

      await db.collection("squad_invites").updateOne({ id: inviteId }, { $set: { status: "accepted" } });

      // mark the original squad_invite notification as acted on
      await db.collection("notifications").updateOne(
        { recipientId: user.playerId, type: "squad_invite", "actionData.inviteId": inviteId, acted: { $ne: true } },
        { $set: { acted: true, actedAction: "accepted" } }
      );

      // Notify captain
      const acceptorPlayer = await db.collection("players").findOne({ id: user.playerId });
      await createAndBroadcastNotification(db, {
        recipientId: invite.senderId,
        title: "Invite Accepted",
        body: `${acceptorPlayer?.name || "A player"} accepted your squad invite for ${team.name}`,
        type: "squad_invite_accepted",
        icon: "trophy",
        actionData: { teamId: invite.teamId, playerId: user.playerId }
      });

      res.json({ success: true, status: "accepted", team });
    } else if (action === "decline") {
      await db.collection("squad_invites").updateOne({ id: inviteId }, { $set: { status: "declined" } });

      // mark the original squad_invite notification as acted on
      await db.collection("notifications").updateOne(
        { recipientId: user.playerId, type: "squad_invite", "actionData.inviteId": inviteId, acted: { $ne: true } },
        { $set: { acted: true, actedAction: "declined" } }
      );

      // Notify captain
      const declinerPlayer = await db.collection("players").findOne({ id: user.playerId });
      await createAndBroadcastNotification(db, {
        recipientId: invite.senderId,
        title: "Invite Declined",
        body: `${declinerPlayer?.name || "A player"} declined your squad invite`,
        type: "squad_invite_declined",
        icon: "trophy",
        actionData: { teamId: invite.teamId }
      });

      res.json({ success: true, status: "declined" });
    } else {
      res.status(400).json({ error: "Invalid action. Use 'accept' or 'decline'" });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/squad-invites/pending", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.playerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { db } = await connectToDatabase();
    const query = { status: "pending" };
    if (req.query.teamId) {
      query.teamId = req.query.teamId;
    } else {
      query.receiverId = user.playerId;
    }
    const invites = await db.collection("squad_invites").find(query).sort({ createdAt: -1 }).toArray();

    // Enrich with team and sender info
    const enriched = await Promise.all(invites.map(async inv => {
      const team = await db.collection("teams").findOne({ id: inv.teamId });
      const sender = await db.collection("players").findOne({ id: inv.senderId });
      const tournament = await db.collection("tournaments").findOne({ id: inv.tournamentId });
      return {
        ...inv,
        teamName: team?.name,
        senderName: sender?.name,
        tournamentName: tournament?.name,
      };
    }));

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/feed", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const list = await db.collection("feed").find().sort({ _id: -1 }).toArray();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/home-data", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const { playerId } = req.query;
    const user = await getUserFromRequest(req);

    const targetPlayerId = playerId || user?.playerId;
    let joinedTournamentIds = [];
    let joinedTournamentNames = [];
    let joinedTournaments = [];

    if (targetPlayerId) {
      const userTeams = await db.collection("teams").find({ playerIds: targetPlayerId }).toArray();
      const userTeamTournamentIds = userTeams.map(team => team.tournamentId).filter(Boolean);

      // Find tournaments organized by this user
      const queryOr = [{ organizerId: targetPlayerId }];
      if (user?.id) {
        queryOr.push({ organizerId: user.id });
      }
      const organizedTournaments = await db.collection("tournaments").find({
        $or: queryOr
      }).toArray();
      const organizedTournamentIds = organizedTournaments.map(t => t.id);

      // Combine both lists uniquely
      joinedTournamentIds = Array.from(new Set([...userTeamTournamentIds, ...organizedTournamentIds]));
      
      joinedTournaments = await db.collection("tournaments").find({
        id: { $in: joinedTournamentIds }
      }).toArray();
      joinedTournamentNames = joinedTournaments.map(t => t.name);
    }

    const liveMatches = await db.collection("matches").find({ status: "live" }).limit(5).toArray();
    const upcomingMatches = await db.collection("matches").find({ status: "upcoming" }).limit(5).toArray();
    
    // Only show live tournaments that the user has joined
    const liveTournaments = await db.collection("tournaments").find({ 
      status: "live",
      id: { $in: joinedTournamentIds }
    }).toArray();
    const sanitizedLiveTournaments = liveTournaments.map(t => sanitizeTournament(t, user));
    
    const allTournaments = await db.collection("tournaments").find().toArray();
    const filteredTournaments = await filterTournaments(allTournaments, user, db);
    
    // Filter feed items: only show if they belong to joined tournaments
    const allFeed = await db.collection("feed").find().sort({ _id: -1 }).limit(50).toArray();
    const feed = [];
    for (const f of allFeed) {
      let tournament = null;
      if (f.tournamentId) {
        if (joinedTournamentIds.includes(f.tournamentId)) {
          tournament = joinedTournaments.find(t => t.id === f.tournamentId);
        }
      } else {
        // Try to find the matching joined tournament to attach the ID dynamically
        tournament = joinedTournaments.find(t => f.title.includes(t.name) || f.body.includes(t.name));
        if (tournament) {
          f.tournamentId = tournament.id;
        }
      }

      if (tournament) {
        f.organizer = tournament.organizer || "Organizer";

        // Format announcement only as upcoming, hide it once live or finished
        const isAnnouncement = f.type === "news" && (f.title.toLowerCase().includes("announced") || f.body.toLowerCase().includes("announced"));
        if (isAnnouncement) {
          if (tournament.status !== "upcoming") {
            continue;
          }
          f.title = `Upcoming: ${tournament.name}`;
          f.body = `Starting on ${tournament.startDate} at ${tournament.venue || "Local Ground"}.`;
          f.type = "upcoming";
        }

        feed.push(f);
      }
    }
    const slicedFeed = feed.slice(0, 10);

    let playerStats = null;
    if (targetPlayerId) {
      const player = await db.collection("players").findOne({ id: targetPlayerId });
      if (player) {
        playerStats = player.stats;
      }
    }

    res.json({
      liveMatches,
      upcomingMatches,
      liveTournaments: sanitizedLiveTournaments,
      tournamentsCount: filteredTournaments.length,
      feed: slicedFeed,
      playerStats,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/tournaments/:id/points-table", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const tournamentId = req.params.id;
    const tournament = await db.collection("tournaments").findOne({ id: tournamentId });
    if (!tournament) return res.json([]);

    const matches = await db.collection("matches").find({ tournamentId, status: "completed" }).toArray();
    const teamIds = tournament.teamIds || [];

    const table = [];
    for (const tid of teamIds) {
      const team = await db.collection("teams").findOne({ id: tid });
      if (!team) continue;

      const teamMatches = matches.filter((m) => m.teamAId === tid || m.teamBId === tid);
      const wins = teamMatches.filter((m) => m.winnerId === tid).length;
      const losses = teamMatches.length - wins;

      table.push({
        team,
        played: teamMatches.length,
        wins,
        losses,
        nrr: team.nrr || 0,
        points: wins * 2,
      });
    }

    const sorted = table.sort((a, b) => b.points - a.points || b.nrr - a.nrr);
    res.json(sorted);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const topRunScorers = await db.collection("players").find().sort({ "stats.runs": -1 }).limit(10).toArray();
    const topWicketTakers = await db.collection("players").find().sort({ "stats.wickets": -1 }).limit(10).toArray();
    res.json({ topRunScorers, topWicketTakers });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/tournaments/:id/squads", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const tournamentId = req.params.id;
    const tournament = await db.collection("tournaments").findOne({ id: tournamentId });
    if (!tournament) return res.json([]);

    const teams = await db.collection("teams").find({ id: { $in: tournament.teamIds || [] } }).toArray();
    const squads = [];

    for (const team of teams) {
      let captain = await db.collection("players").findOne({ id: team.captainId });
      let players = await db.collection("players").find({ id: { $in: team.playerIds || [] } }).toArray();

      // Find all corresponding users to get active profile pictures
      const playerIds = [];
      if (captain) playerIds.push(captain.id);
      players.forEach(p => playerIds.push(p.id));

      const users = await db.collection("users").find({ playerId: { $in: playerIds } }).toArray();
      const userMap = {};
      users.forEach(u => {
        if (u.playerId) {
          userMap[u.playerId] = u.picture;
        }
      });

      if (captain) {
        captain = {
          ...captain,
          picture: userMap[captain.id] || null
        };
      }

      players = players.map(p => ({
        ...p,
        picture: userMap[p.id] || null
      }));

      squads.push({
        team,
        captain,
        players,
      });
    }

    res.json(squads);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- MUTATIONS ---

app.post("/api/tournaments", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    const data = req.body;

    const id = `tr_user_${Date.now()}`;
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const t = {
      id,
      name: data.name || "My Tournament",
      code,
      format: data.format || "T20",
      status: "upcoming",
      startDate: data.startDate || new Date().toISOString().slice(0, 10),
      endDate: data.endDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      city: data.city || "Mumbai",
      venue: data.venue || "Local Ground",
      teamIds: [],
      prizePool: data.prizePool || "₹1 Lakh",
      description: data.description || "Community tournament",
      organizer: user?.name || "Organizer",
      organizerId: user?.id || null,
      detailed: data.detailed !== false,
    };
    await db.collection("tournaments").insertOne(t);

    await db.collection("feed").insertOne({
      id: `f_feed_${Date.now()}`,
      tournamentId: t.id,
      organizer: t.organizer,
      type: "news",
      title: `${t.name} announced`,
      body: `A new tournament organised by ${t.organizer} starting on ${t.startDate}.`,
      time: "Just now",
      meta: t.format,
    });

    res.json(id);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/teams", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "You must be logged in to create a team" });
    }

    const data = req.body;
    const tournamentId = data.tournamentId;
    const teamName = data.name || `${user.name} XI`;

    const teamId = `t_user_${Date.now()}`;
    const teamCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const initials = teamName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

    const team = {
      id: teamId,
      tournamentId,
      name: teamName,
      shortName: initials,
      code: teamCode,
      color: "oklch(0.85 0.18 75)",
      captainId: user.playerId,
      city: data.city || "Mumbai",
      founded: new Date().getFullYear(),
      trophies: 0,
      matches: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      nrr: 0,
      playerIds: [user.playerId],
    };

    await db.collection("teams").insertOne(team);

    await db.collection("tournaments").updateOne(
      { id: tournamentId },
      { $addToSet: { teamIds: teamId } }
    );

    const playerExists = await db.collection("players").findOne({ id: user.playerId });
    if (!playerExists) {
      await db.collection("players").insertOne({
        id: user.playerId,
        name: user.name,
        initials: user.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase(),
        role: "All-rounder",
        battingStyle: "Right-hand",
        bowlingStyle: "Right-arm medium",
        teamId: teamId,
        age: 25,
        country: "India",
        city: team.city,
        jersey: 7,
        stats: {
          matches: 0,
          innings: 0,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          fifties: 0,
          hundreds: 0,
          highScore: 0,
          notOuts: 0,
          wickets: 0,
          ballsBowled: 0,
          runsConceded: 0,
          bestBowling: "0/0",
          catches: 0,
          stumpings: 0,
        },
        achievements: [],
        joinedAt: new Date().toISOString().slice(0, 10),
      });
    } else {
      await db.collection("players").updateOne({ id: user.playerId }, { $set: { teamId: teamId } });
    }

    await db.collection("users").updateOne({ id: user.id }, { $set: { teamId: teamId } });

    res.json(teamId);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/tournaments/:id/roadmap", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const tournamentId = req.params.id;
    const { roadmap } = req.body;
    await db.collection("tournaments").updateOne(
      { id: tournamentId },
      { $set: { roadmap } }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/tournaments/:id/finish", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const tournamentId = req.params.id;
    const tournament = await db.collection("tournaments").findOne({ id: tournamentId });
    if (!tournament) return res.status(404).json({ error: "Tournament not found" });

    // Compute points table
    const matches = await db.collection("matches").find({ tournamentId, status: "completed" }).toArray();
    const teamIds = tournament.teamIds || [];

    const table = [];
    for (const tid of teamIds) {
      const team = await db.collection("teams").findOne({ id: tid });
      if (!team) continue;

      const teamMatches = matches.filter((m) => m.teamAId === tid || m.teamBId === tid);
      const wins = teamMatches.filter((m) => m.winnerId === tid).length;
      const losses = teamMatches.length - wins;

      table.push({
        team,
        played: teamMatches.length,
        wins,
        losses,
        nrr: team.nrr || 0,
        points: wins * 2,
      });
    }

    const sorted = table.sort((a, b) => b.points - a.points || b.nrr - a.nrr);
    if (sorted.length === 0) {
      return res.status(400).json({ error: "No teams in the tournament points table." });
    }

    const winnerId = sorted[0].team.id;
    const runnerUpId = sorted[1]?.team?.id || null;

    // Calculate player stats specifically for this tournament
    const teams = await db.collection("teams").find({ id: { $in: tournament.teamIds || [] } }).toArray();
    const allPlayerIds = teams.flatMap((t) => [
      ...(t.captainId ? [t.captainId] : []),
      ...(t.playerIds || []),
    ]);

    const playerTournamentStats = {};
    for (const pid of allPlayerIds) {
      playerTournamentStats[pid] = { runs: 0, wickets: 0, sixes: 0 };
    }

    for (const m of matches) {
      if (m.innings) {
        for (const inn of m.innings) {
          if (inn.batters) {
            for (const b of inn.batters) {
              if (playerTournamentStats[b.playerId]) {
                playerTournamentStats[b.playerId].runs += (b.runs || 0);
                playerTournamentStats[b.playerId].sixes += (b.sixes || 0);
              }
            }
          }
          if (inn.bowlers) {
            for (const bw of inn.bowlers) {
              if (playerTournamentStats[bw.playerId]) {
                playerTournamentStats[bw.playerId].wickets += (bw.wickets || 0);
              }
            }
          }
        }
      }
    }

    let orangeCapPlayerId = null;
    let maxRuns = -1;
    let purpleCapPlayerId = null;
    let maxWickets = -1;
    let maximumSixesPlayerId = null;
    let maxSixes = -1;
    let playerOfTournamentId = null;
    let maxAllRoundScore = -1;

    for (const pid of allPlayerIds) {
      const stats = playerTournamentStats[pid];
      const allRoundScore = stats.runs + (stats.wickets * 20);

      if (stats.runs > maxRuns) {
        maxRuns = stats.runs;
        orangeCapPlayerId = pid;
      }
      if (stats.wickets > maxWickets) {
        maxWickets = stats.wickets;
        purpleCapPlayerId = pid;
      }
      if (stats.sixes > maxSixes) {
        maxSixes = stats.sixes;
        maximumSixesPlayerId = pid;
      }
      if (allRoundScore > maxAllRoundScore) {
        maxAllRoundScore = allRoundScore;
        playerOfTournamentId = pid;
      }
    }

    await db.collection("tournaments").updateOne(
      { id: tournamentId },
      {
        $set: {
          status: "completed",
          winnerId,
          runnerUpId,
          mvpId: playerOfTournamentId || "p_0",
        },
      }
    );

    // Delete any existing certificates for this tournament to allow recreation/overwrites
    await db.collection("certificates").deleteMany({ tournamentId });

    const certs = [
      {
        id: `cert_${Date.now()}_champ`,
        type: "Champions Trophy Winners",
        tournamentId,
        teamId: winnerId,
        issuedOn: new Date().toISOString().slice(0, 10),
      },
    ];

    if (runnerUpId) {
      certs.push({
        id: `cert_${Date.now()}_runner`,
        type: "Tournament Runners-Up",
        tournamentId,
        teamId: runnerUpId,
        issuedOn: new Date().toISOString().slice(0, 10),
      });
    }

    if (playerOfTournamentId) {
      certs.push({
        id: `cert_${Date.now()}_pot`,
        type: "Player of the Tournament",
        tournamentId,
        playerId: playerOfTournamentId,
        issuedOn: new Date().toISOString().slice(0, 10),
      });
    }

    if (orangeCapPlayerId && maxRuns > 0) {
      certs.push({
        id: `cert_${Date.now()}_orange`,
        type: "Orange Cap (Highest Run Scorer)",
        tournamentId,
        playerId: orangeCapPlayerId,
        issuedOn: new Date().toISOString().slice(0, 10),
      });
    }

    if (purpleCapPlayerId && maxWickets > 0) {
      certs.push({
        id: `cert_${Date.now()}_purple`,
        type: "Purple Cap (Highest Wicket Taker)",
        tournamentId,
        playerId: purpleCapPlayerId,
        issuedOn: new Date().toISOString().slice(0, 10),
      });
    }

    if (maximumSixesPlayerId && maxSixes > 0) {
      certs.push({
        id: `cert_${Date.now()}_sixes`,
        type: "Maximum Sixes Award",
        tournamentId,
        playerId: maximumSixesPlayerId,
        issuedOn: new Date().toISOString().slice(0, 10),
      });
    }

    await db.collection("certificates").insertMany(certs);

    res.json({ success: true, winnerId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/tournaments/join", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "You must be logged in to join a tournament" });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Tournament code is required" });
    }

    const tournament = await db.collection("tournaments").findOne({ code: code.toUpperCase() });
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    // Check if user is already in any team in this tournament (either as captain or player)
    const tournamentTeams = await db.collection("teams").find({ tournamentId: tournament.id }).toArray();
    const alreadyRegistered = tournamentTeams.some(t => t.playerIds.includes(user.playerId));
    if (alreadyRegistered) {
      return res.status(400).json({ error: "You are already a member of a team in this tournament." });
    }

    // Check if this captain already has a team in this tournament
    let team = await db.collection("teams").findOne({
      tournamentId: tournament.id,
      captainId: user.playerId,
    });

    if (!team) {
      const teamId = `t_user_${Date.now()}`;
      const teamCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      const initials = user.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

      team = {
        id: teamId,
        tournamentId: tournament.id,
        name: `${user.name} XI`,
        shortName: `${initials}XI`,
        code: teamCode,
        color: "oklch(0.85 0.18 75)",
        captainId: user.playerId,
        city: tournament.city || "Mumbai",
        founded: new Date().getFullYear(),
        trophies: 0,
        matches: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        nrr: 0,
        playerIds: [user.playerId],
      };

      await db.collection("teams").insertOne(team);

      await db.collection("tournaments").updateOne(
        { id: tournament.id },
        { $addToSet: { teamIds: teamId } }
      );
    }

    // Check if player profile exists
    const dbUser = await db.collection("users").findOne({ id: user.id });
    const playerExists = await db.collection("players").findOne({ id: user.playerId });
    if (!playerExists) {
      await db.collection("players").insertOne({
        id: user.playerId,
        name: user.name,
        initials: user.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase(),
        role: "All-rounder",
        battingStyle: "Right-hand",
        bowlingStyle: "Right-arm medium",
        teamId: team.id,
        playerCode: dbUser?.playerCode || Math.floor(10000000 + Math.random() * 90000000).toString(),
        age: 25,
        country: "India",
        city: team.city,
        jersey: 7,
        stats: {
          matches: 0,
          innings: 0,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          fifties: 0,
          hundreds: 0,
          highScore: 0,
          notOuts: 0,
          wickets: 0,
          ballsBowled: 0,
          runsConceded: 0,
          bestBowling: "0/0",
          catches: 0,
          stumpings: 0,
        },
        achievements: [],
        joinedAt: new Date().toISOString().slice(0, 10),
      });
    } else {
      await db.collection("players").updateOne({ id: user.playerId }, { $set: { teamId: team.id } });
    }

    await db.collection("users").updateOne({ id: user.id }, { $set: { teamId: team.id } });

    res.json(tournament);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/teams/rename", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "You must be logged in" });
    }

    const { teamId, newName } = req.body;
    const team = await db.collection("teams").findOne({ id: teamId });
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }
    if (team.captainId !== user.playerId) {
      return res.status(403).json({ error: "Only the team captain can edit the team name" });
    }

    const initials = newName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

    await db.collection("teams").updateOne(
      { id: teamId },
      { $set: { name: newName, shortName: initials } }
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/teams/join", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "You must be logged in to join a team" });
    }

    const { code } = req.body;
    const team = await db.collection("teams").findOne({ code: code.toUpperCase() });
    if (!team) {
      return res.status(404).json({ error: "Invalid team code" });
    }

    // Check if user is already in any team in this tournament
    const tournamentTeams = await db.collection("teams").find({ tournamentId: team.tournamentId }).toArray();
    const alreadyRegistered = tournamentTeams.some(t => t.playerIds.includes(user.playerId));
    if (alreadyRegistered) {
      return res.status(400).json({ error: "You are already a member of a team in this tournament." });
    }

    if (!team.playerIds.includes(user.playerId)) {
      await db.collection("teams").updateOne(
        { id: team.id },
        { $addToSet: { playerIds: user.playerId } }
      );
    }

    const dbUser = await db.collection("users").findOne({ id: user.id });
    const playerExists = await db.collection("players").findOne({ id: user.playerId });
    if (!playerExists) {
      await db.collection("players").insertOne({
        id: user.playerId,
        name: user.name,
        initials: user.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase(),
        role: "All-rounder",
        battingStyle: "Right-hand",
        bowlingStyle: "Right-arm medium",
        teamId: team.id,
        playerCode: dbUser?.playerCode || Math.floor(10000000 + Math.random() * 90000000).toString(),
        age: 25,
        country: "India",
        city: team.city,
        jersey: 7,
        stats: {
          matches: 0,
          innings: 0,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          fifties: 0,
          hundreds: 0,
          highScore: 0,
          notOuts: 0,
          wickets: 0,
          ballsBowled: 0,
          runsConceded: 0,
          bestBowling: "0/0",
          catches: 0,
          stumpings: 0,
        },
        achievements: [],
        joinedAt: new Date().toISOString().slice(0, 10),
      });
    } else {
      await db.collection("players").updateOne({ id: user.playerId }, { $set: { teamId: team.id } });
    }

    await db.collection("users").updateOne({ id: user.id }, { $set: { teamId: team.id } });

    res.json(team);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/matches", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const data = req.body;
    const id = `m_user_${Date.now()}`;
    const m = {
      id,
      tournamentId: data.tournamentId,
      teamAId: data.teamAId,
      teamBId: data.teamBId,
      status: "upcoming",
      date: new Date().toISOString().slice(0, 10),
      venue: data.venue || "Local Ground",
      overs: data.overs || 20,
      innings: [],
      commentary: [],
      resultText: "Match yet to begin",
      umpireIds: data.umpireIds || [],
    };
    await db.collection("matches").insertOne(m);

    // Dissociate umpires from any team in this tournament
    if (m.umpireIds && m.umpireIds.length > 0) {
      const teams = await db.collection("teams").find({ tournamentId: data.tournamentId }).toArray();
      const teamIds = teams.map((t) => t.id);
      
      if (teamIds.length > 0) {
        await db.collection("teams").updateMany(
          { id: { $in: teamIds } },
          { $pull: { playerIds: { $in: m.umpireIds } } }
        );
        
        await db.collection("players").updateMany(
          { id: { $in: m.umpireIds } },
          { $set: { teamId: null } }
        );
        
        await db.collection("users").updateMany(
          { playerId: { $in: m.umpireIds } },
          { $set: { teamId: null } }
        );
      }
    }

    // If linked to a roadmap node, update the tournament roadmap
    if (data.nodeId) {
      try {
        const tournament = await db.collection("tournaments").findOne({ id: data.tournamentId });
        if (tournament && tournament.roadmap && tournament.roadmap.nodes) {
          const nodes = tournament.roadmap.nodes.map((node) => {
            if (node.id === data.nodeId) {
              node.matchId = id;
            }
            return node;
          });
          await db.collection("tournaments").updateOne(
            { id: data.tournamentId },
            { $set: { "roadmap.nodes": nodes } }
          );
        }
      } catch (err) {
        console.error("Failed to link match to roadmap node:", err);
      }
    }

    res.json(id);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/matches/:id/toss", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const matchId = req.params.id;
    const { winnerId, decision } = req.body;

    await db.collection("matches").updateOne(
      { id: matchId },
      {
        $set: {
          tossWinnerId: winnerId,
          tossDecision: decision,
          status: "live",
          resultText: "Match in progress",
        },
      }
    );

    const match = await db.collection("matches").findOne({ id: matchId });
    if (match && match.tournamentId) {
      await db.collection("tournaments").updateOne(
        { id: match.tournamentId },
        { $set: { status: "live" } }
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function recalculateTeamCareerStats(db, teamId) {
  const team = await db.collection("teams").findOne({ id: teamId });
  if (!team) return;

  const matches = await db.collection("matches").find({
    $or: [{ teamAId: teamId }, { teamBId: teamId }],
    status: "completed"
  }).toArray();

  let matchesCount = matches.length;
  let winsCount = 0;
  let lossesCount = 0;
  let totalRunsScored = 0;
  let totalOversFaced = 0;
  let totalRunsConceded = 0;
  let totalOversBowled = 0;

  for (const m of matches) {
    if (m.winnerId === teamId) {
      winsCount += 1;
    } else if (m.winnerId && m.winnerId !== "draw" && m.winnerId !== "tied") {
      lossesCount += 1;
    }

    if (m.innings) {
      for (const inn of m.innings) {
        const isBatting = inn.battingTeamId === teamId;
        const runs = inn.runs || 0;
        const [ovVal, ballVal] = String(inn.overs || "0.0").split(".");
        const balls = (parseInt(ovVal, 10) * 6) + parseInt(ballVal || "0", 10);

        if (isBatting) {
          totalRunsScored += runs;
          totalOversFaced += balls;
        } else {
          totalRunsConceded += runs;
          totalOversBowled += balls;
        }
      }
    }
  }

  let nrr = 0.0;
  const oversFacedNum = totalOversFaced / 6;
  const oversBowledNum = totalOversBowled / 6;

  if (oversFacedNum > 0 || oversBowledNum > 0) {
    const runRateScored = oversFacedNum > 0 ? (totalRunsScored / oversFacedNum) : 0;
    const runRateConceded = oversBowledNum > 0 ? (totalRunsConceded / oversBowledNum) : 0;
    nrr = runRateScored - runRateConceded;
  }

  await db.collection("teams").updateOne(
    { id: teamId },
    {
      $set: {
        matches: matchesCount,
        wins: winsCount,
        losses: lossesCount,
        nrr: nrr
      }
    }
  );
}

async function updatePlayerCareerStats(db, playerId, matchBatter, matchBowler, catchesCount, stumpingsCount) {
  const player = await db.collection("players").findOne({ id: playerId });
  if (!player) return;

  const stats = player.stats || {
    matches: 0, innings: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0,
    fifties: 0, hundreds: 0, highScore: 0, notOuts: 0, wickets: 0,
    ballsBowled: 0, runsConceded: 0, bestBowling: "0/0", catches: 0, stumpings: 0
  };

  stats.matches = (stats.matches || 0) + 1;

  if (matchBatter) {
    stats.innings = (stats.innings || 0) + 1;
    stats.runs = (stats.runs || 0) + matchBatter.runs;
    stats.ballsFaced = (stats.ballsFaced || 0) + matchBatter.balls;
    stats.fours = (stats.fours || 0) + matchBatter.fours;
    stats.sixes = (stats.sixes || 0) + matchBatter.sixes;

    if (matchBatter.runs >= 100) {
      stats.hundreds = (stats.hundreds || 0) + 1;
    } else if (matchBatter.runs >= 50) {
      stats.fifties = (stats.fifties || 0) + 1;
    }

    stats.highScore = Math.max(stats.highScore || 0, matchBatter.runs);

    const isOut = matchBatter.dismissal && matchBatter.dismissal !== "batting";
    if (!isOut) {
      stats.notOuts = (stats.notOuts || 0) + 1;
    }
  }

  if (matchBowler) {
    const [ovVal, ballVal] = String(matchBowler.overs || "0.0").split(".");
    const matchBallsBowled = (parseInt(ovVal, 10) * 6) + parseInt(ballVal || "0", 10);

    stats.ballsBowled = (stats.ballsBowled || 0) + matchBallsBowled;
    stats.runsConceded = (stats.runsConceded || 0) + matchBowler.runs;
    stats.wickets = (stats.wickets || 0) + matchBowler.wickets;

    const [bestW, bestR] = (stats.bestBowling || "0/999").split("/");
    if (matchBowler.wickets > parseInt(bestW, 10) || 
        (matchBowler.wickets === parseInt(bestW, 10) && matchBowler.runs < parseInt(bestR, 10))) {
      stats.bestBowling = `${matchBowler.wickets}/${matchBowler.runs}`;
    }
  }

  if (catchesCount > 0) {
    stats.catches = (stats.catches || 0) + catchesCount;
  }
  if (stumpingsCount > 0) {
    stats.stumpings = (stats.stumpings || 0) + stumpingsCount;
  }

  await db.collection("players").updateOne(
    { id: playerId },
    { $set: { stats: stats } }
  );
}

async function recalculateStatsInternal(db) {
  const matches = await db.collection("matches").find({ status: "completed" }).toArray();
  const players = await db.collection("players").find().toArray();

  const playerStatsMap = {};
  for (const p of players) {
    playerStatsMap[p.id] = {
      matches: 0,
      innings: 0,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      fifties: 0,
      hundreds: 0,
      highScore: 0,
      notOuts: 0,
      wickets: 0,
      ballsBowled: 0,
      runsConceded: 0,
      bestBowling: "0/0",
      catches: 0,
      stumpings: 0,
    };
  }

  for (const m of matches) {
    const teamA = await db.collection("teams").findOne({ id: m.teamAId });
    const teamB = await db.collection("teams").findOne({ id: m.teamBId });
    const allPlayersInMatch = Array.from(new Set([
      ...(teamA?.playerIds || []),
      ...(teamA?.captainId ? [teamA.captainId] : []),
      ...(teamB?.playerIds || []),
      ...(teamB?.captainId ? [teamB.captainId] : [])
    ]));

    for (const pid of allPlayersInMatch) {
      if (playerStatsMap[pid]) {
        playerStatsMap[pid].matches += 1;
      }
    }

    if (m.innings) {
      for (const inn of m.innings) {
        if (inn.batters) {
          for (const b of inn.batters) {
            const pid = b.playerId;
            if (playerStatsMap[pid]) {
              const stats = playerStatsMap[pid];
              stats.innings += 1;
              stats.runs += b.runs || 0;
              stats.ballsFaced += b.balls || 0;
              stats.fours += b.fours || 0;
              stats.sixes += b.sixes || 0;

              if (b.runs >= 100) {
                stats.hundreds += 1;
              } else if (b.runs >= 50) {
                stats.fifties += 1;
              }
              stats.highScore = Math.max(stats.highScore, b.runs || 0);

              const isOut = b.dismissal && b.dismissal !== "batting";
              if (!isOut) {
                stats.notOuts += 1;
              }
            }
          }
        }

        if (inn.bowlers) {
          for (const bw of inn.bowlers) {
            const pid = bw.playerId;
            if (playerStatsMap[pid]) {
              const stats = playerStatsMap[pid];
              const [ovVal, ballVal] = String(bw.overs || "0.0").split(".");
              const matchBalls = (parseInt(ovVal, 10) * 6) + parseInt(ballVal || "0", 10);

              stats.ballsBowled += matchBalls;
              stats.runsConceded += bw.runs || 0;
              stats.wickets += bw.wickets || 0;

              const [bestW, bestR] = (stats.bestBowling || "0/999").split("/");
              if (bw.wickets > parseInt(bestW, 10) || 
                  (bw.wickets === parseInt(bestW, 10) && bw.runs < parseInt(bestR, 10))) {
                stats.bestBowling = `${bw.wickets}/${bw.runs}`;
              }
            }
          }
        }
      }
    }

    if (m.commentary) {
      for (const comm of m.commentary) {
        if (comm.wicket && comm.text) {
          for (const p of players) {
            if (comm.text.includes(`caught by ${p.name}`)) {
              if (playerStatsMap[p.id]) {
                playerStatsMap[p.id].catches += 1;
              }
            } else if (comm.text.includes(`throw from ${p.name}`)) {
              if (playerStatsMap[p.id]) {
                playerStatsMap[p.id].catches += 1;
              }
            }
          }
        }
      }
    }
  }

  for (const pid of Object.keys(playerStatsMap)) {
    await db.collection("players").updateOne(
      { id: pid },
      { $set: { stats: playerStatsMap[pid] } }
    );
  }
}

app.post("/api/recalculate-stats", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    await recalculateStatsInternal(db);
    const teams = await db.collection("teams").find().toArray();
    for (const t of teams) {
      await recalculateTeamCareerStats(db, t.id);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/matches/:id/scoring", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const matchId = req.params.id;
    const item = await db.collection("scorings").findOne({ matchId });
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/matches/:id/scoring", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const matchId = req.params.id;
    const data = { ...req.body };
    delete data._id;

    await db.collection("scorings").updateOne(
      { matchId: matchId },
      { $set: data },
      { upsert: true }
    );

    const match = await db.collection("matches").findOne({ id: matchId });
    if (match) {
      const battingTeamId = data.battingTeamId;
      const bowlingTeamId = data.bowlingTeamId;

      let innings = [...(match.innings || [])];
      let activeInnIndex = data.inningsIndex;

      while (innings.length <= activeInnIndex) {
        innings.push({
          battingTeamId: battingTeamId,
          bowlingTeamId: bowlingTeamId,
          runs: 0,
          wickets: 0,
          overs: 0,
          batters: [],
          bowlers: [],
          fallOfWickets: [],
        });
      }

      innings[activeInnIndex].runs = data.runs;
      innings[activeInnIndex].wickets = data.wickets;
      innings[activeInnIndex].overs = +(Math.floor(data.totalBalls / 6) + "." + (data.totalBalls % 6));

      // Compute batters and bowlers lists from ballLog
      const battersMap = new Map();
      const bowlersMap = new Map();

      if (data.ballLog && data.ballLog.length > 0) {
        for (const ball of data.ballLog) {
          const strikerId = ball.strikerId;
          const bowlerId = ball.bowlerId;

          // 1. Batter Stats
          if (strikerId) {
            if (!battersMap.has(strikerId)) {
              battersMap.set(strikerId, {
                playerId: strikerId,
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0,
                dismissal: "",
              });
            }
            const bStats = battersMap.get(strikerId);
            
            const runsVal = ball.runs || 0;
            const isWide = ball.outcome === "Wd";
            const isNoBall = ball.outcome === "Nb";
            const isBye = ball.outcome.endsWith("b") && !ball.outcome.endsWith("lb");
            const isLegBye = ball.outcome.endsWith("lb");

            if (!isWide && !isBye && !isLegBye) {
              bStats.runs += runsVal;
              if (isNoBall) {
                bStats.runs -= 1; // subtract noball penalty
              }
              
              if (ball.runs === 4 || ball.outcome === "4") {
                bStats.fours += 1;
              } else if (ball.runs === 6 || ball.outcome === "6") {
                bStats.sixes += 1;
              }
            }

            if (!isWide) {
              bStats.balls += 1;
            }
          }

          // 2. Bowler Stats
          if (bowlerId) {
            if (!bowlersMap.has(bowlerId)) {
              bowlersMap.set(bowlerId, {
                playerId: bowlerId,
                balls: 0,
                overs: "0.0",
                runs: 0,
                wickets: 0,
                economy: "0.0",
              });
            }
            const bwStats = bowlersMap.get(bowlerId);

            const runsVal = ball.runs || 0;
            const isWide = ball.outcome === "Wd";
            const isNoBall = ball.outcome === "Nb";
            const isBye = ball.outcome.endsWith("b") && !ball.outcome.endsWith("lb");
            const isLegBye = ball.outcome.endsWith("lb");

            if (!isBye && !isLegBye) {
              bwStats.runs += runsVal;
            }

            if (!isWide && !isNoBall) {
              bwStats.balls += 1;
            }

            if (ball.outcome === "W") {
              const dismissalType = ball.dismissalType || "caught";
              if (dismissalType !== "runout") {
                bwStats.wickets += 1;
              }
            }
          }

          // 3. Wicket Dismissals
          if (ball.outcome === "W" && ball.dismissedBatterId) {
            const dismissedId = ball.dismissedBatterId;
            const striker = await db.collection("players").findOne({ id: ball.strikerId });
            const bowler = await db.collection("players").findOne({ id: ball.bowlerId });
            const fielder = ball.fielderId ? await db.collection("players").findOne({ id: ball.fielderId }) : null;

            const strikerName = striker ? striker.name : "Batter";
            const bowlerName = bowler ? bowler.name : "Bowler";
            const fielderName = fielder ? fielder.name : "fielder";

            const wType = ball.dismissalType || "caught";
            let dismissalText = "out";
            if (wType === "caught") {
              dismissalText = `c ${fielderName} b ${bowlerName}`;
            } else if (wType === "bowled") {
              dismissalText = `b ${bowlerName}`;
            } else if (wType === "lbw") {
              dismissalText = `lbw b ${bowlerName}`;
            } else if (wType === "stumped") {
              dismissalText = `st ${fielderName} b ${bowlerName}`;
            } else if (wType === "runout") {
              dismissalText = `run out (${fielderName})`;
            }

            if (battersMap.has(dismissedId)) {
              battersMap.get(dismissedId).dismissal = dismissalText;
            } else {
              battersMap.set(dismissedId, {
                playerId: dismissedId,
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0,
                dismissal: dismissalText,
              });
            }
          }
        }
      }

      // Convert bowler balls to overs string and economy
      for (const [_, bw] of bowlersMap.entries()) {
        const oversCount = Math.floor(bw.balls / 6) + (bw.balls % 6) / 10;
        bw.overs = oversCount.toFixed(1);
        bw.economy = bw.balls > 0 ? ((bw.runs / bw.balls) * 6).toFixed(2) : "0.00";
        delete bw.balls;
      }

      innings[activeInnIndex].batters = Array.from(battersMap.values());
      innings[activeInnIndex].bowlers = Array.from(bowlersMap.values());

      let commentary = [...(match.commentary || [])];
      if (data.ballLog && data.ballLog.length > 0) {
        const lastBall = data.ballLog[data.ballLog.length - 1];
        const overStr = lastBall.over;
        const exists = commentary.some((c) => c.over === overStr);
        if (!exists) {
          let outcomeStr = "";
          let runsVal = lastBall.runs;
          let isWicket = false;

          // Fetch striker and bowler names
          const striker = lastBall.strikerId ? await db.collection("players").findOne({ id: lastBall.strikerId }) : null;
          const bowler = lastBall.bowlerId ? await db.collection("players").findOne({ id: lastBall.bowlerId }) : null;
          const strikerName = striker ? striker.name : "Batter";
          const bowlerName = bowler ? bowler.name : "Bowler";

          if (lastBall.outcome === "W") {
            isWicket = true;
            const wType = lastBall.dismissalType || "caught";
            const fielder = lastBall.fielderId ? await db.collection("players").findOne({ id: lastBall.fielderId }) : null;
            const fielderName = fielder ? fielder.name : "fielder";

            if (wType === "caught") {
              outcomeStr = `OUT! ${strikerName} has been caught by ${fielderName} off the bowling of ${bowlerName}. A well-taken catch!`;
            } else if (wType === "bowled") {
              outcomeStr = `OUT! Clean bowled! ${bowlerName} sneaks it through the defense of ${strikerName} to shatter the stumps!`;
            } else if (wType === "lbw") {
              outcomeStr = `OUT! LBW! ${bowlerName} appeals loudly, and the umpire raises the finger. ${strikerName} is gone!`;
            } else if (wType === "stumped") {
              outcomeStr = `OUT! Stumped! ${strikerName} steps down the track, misses the delivery from ${bowlerName}, and the wicketkeeper does the rest.`;
            } else if (wType === "runout") {
              const outId = lastBall.dismissedBatterId || lastBall.strikerId;
              const outPlayer = await db.collection("players").findOne({ id: outId });
              const outName = outPlayer ? outPlayer.name : "Batter";
              outcomeStr = `OUT! Run out! ${outName} is caught short of the crease by a sharp throw from ${fielderName}. Excellent fielding!`;
            } else {
              outcomeStr = `OUT! ${strikerName} is dismissed off the bowling of ${bowlerName}.`;
            }
          } else if (lastBall.outcome === "6") {
            outcomeStr = `SIX! ${strikerName} smashes it over the ropes off the bowling of ${bowlerName}! High, long, and handsome!`;
          } else if (lastBall.outcome === "4") {
            outcomeStr = `FOUR! Beautiful shot by ${strikerName} off ${bowlerName}! Guided through the gaps and runs away to the boundary.`;
          } else if (lastBall.outcome === "Wd") {
            outcomeStr = `Wide ball. ${bowlerName} strays down the leg side, out of reach for ${strikerName}.`;
          } else if (lastBall.outcome === "Nb") {
            outcomeStr = `No ball. ${bowlerName} oversteps. Free hit or extra run for ${strikerName}.`;
          } else if (runsVal === 0) {
            outcomeStr = `${bowlerName} bowls a dot ball to ${strikerName}. Played defensively back to the bowler.`;
          } else if (runsVal === 1) {
            outcomeStr = `${strikerName} pushes the delivery from ${bowlerName} to long-on for a single.`;
          } else if (runsVal === 2) {
            outcomeStr = `${strikerName} clips this away off ${bowlerName} and runs hard to pick up a couple.`;
          } else if (runsVal === 3) {
            outcomeStr = `${strikerName} drives it through the covers off ${bowlerName}, squad runs hard to complete three.`;
          } else {
            outcomeStr = `${strikerName} scores ${runsVal} runs off the delivery of ${bowlerName}.`;
          }

          commentary.unshift({
            over: overStr,
            text: outcomeStr,
            runs: runsVal,
            wicket: isWicket,
          });
        }
      }

      let status = "live";
      let winnerId = match.winnerId;
      let resultText = "Match in progress";

      if (data.finished) {
        status = "completed";
        winnerId = data.target && data.runs >= data.target ? data.battingTeamId : data.bowlingTeamId;
        const winnerName = (await db.collection("teams").findOne({ id: winnerId }))?.name || "Team";
        resultText =
          data.target && data.runs >= data.target
            ? `${winnerName} won by ${10 - data.wickets} wickets`
            : `${winnerName} won by ${(data.target ?? data.runs) - data.runs - 1} runs`;

        // Roadmap Winner Propagation
        try {
          const tId = match.tournamentId;
          const tournament = await db.collection("tournaments").findOne({ id: tId });
          if (tournament && tournament.roadmap && tournament.roadmap.nodes) {
            let updated = false;
            const nodes = tournament.roadmap.nodes.map((node) => {
              if (node.matchId === matchId) {
                node.winnerId = winnerId;
                updated = true;
              }
              return node;
            });

            if (updated) {
              nodes.forEach((node) => {
                const completedNode = nodes.find(n => n.matchId === matchId);
                if (completedNode) {
                  if (node.teamASource && node.teamASource.type === "node" && node.teamASource.value === completedNode.id) {
                    node.teamAId = winnerId;
                  }
                  if (node.teamBSource && node.teamBSource.type === "node" && node.teamBSource.value === completedNode.id) {
                    node.teamBId = winnerId;
                  }
                }
              });

              await db.collection("tournaments").updateOne(
                { id: tId },
                { $set: { "roadmap.nodes": nodes } }
              );
            }
          }
        } catch (roadmapErr) {
          console.error("Roadmap propagation error:", roadmapErr);
        }

        const batTeam = await db.collection("teams").findOne({ id: data.battingTeamId });
        const bowlTeam = await db.collection("teams").findOne({ id: data.bowlingTeamId });

        const matchBatters = {};
        const matchBowlers = {};
        const catches = {};
        const stumpings = {};

        for (const inn of innings) {
          if (inn.batters) {
            for (const b of inn.batters) {
              matchBatters[b.playerId] = b;
            }
          }
          if (inn.bowlers) {
            for (const bw of inn.bowlers) {
              matchBowlers[bw.playerId] = bw;
            }
          }
        }

        if (data.ballLog) {
          for (const ball of data.ballLog) {
            if (ball.outcome === "W" && ball.fielderId) {
              if (ball.dismissalType === "caught") {
                catches[ball.fielderId] = (catches[ball.fielderId] || 0) + 1;
              } else if (ball.dismissalType === "stumped") {
                stumpings[ball.fielderId] = (stumpings[ball.fielderId] || 0) + 1;
              }
            }
          }
        }

        const allMatchPlayers = Array.from(
          new Set([...(batTeam?.playerIds || []), ...(bowlTeam?.playerIds || [])])
        );

        for (const pid of allMatchPlayers) {
          await updatePlayerCareerStats(
            db,
            pid,
            matchBatters[pid] || null,
            matchBowlers[pid] || null,
            catches[pid] || 0,
            stumpings[pid] || 0
          );
        }

        if (data.battingTeamId) {
          await recalculateTeamCareerStats(db, data.battingTeamId);
        }
        if (data.bowlingTeamId) {
          await recalculateTeamCareerStats(db, data.bowlingTeamId);
        }

        const tournamentId = match.tournamentId;
        const certExists = await db.collection("certificates").findOne({ tournamentId });
        if (!certExists) {
          await db.collection("certificates").insertMany([
            {
              id: `c_${Date.now()}_w`,
              type: "Champions Trophy Winners",
              tournamentId,
              teamId: winnerId,
              issuedOn: new Date().toISOString().slice(0, 10),
            },
            {
              id: `c_${Date.now()}_m`,
              type: "Player of the Tournament",
              tournamentId,
              playerId: data.strikerId || "p_0",
              issuedOn: new Date().toISOString().slice(0, 10),
            },
          ]);
        }
      }

      await db.collection("matches").updateOne(
        { id: matchId },
        {
          $set: {
            innings,
            commentary,
            status,
            winnerId,
            resultText,
          },
        }
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/matches/:id/scoring", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    await db.collection("scorings").deleteOne({ matchId: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/matches/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const matchId = req.params.id;
    const match = await db.collection("matches").findOne({ id: matchId });
    if (match) {
      const tournament = await db.collection("tournaments").findOne({ id: match.tournamentId });
      if (tournament && tournament.roadmap && tournament.roadmap.nodes) {
        const nodes = tournament.roadmap.nodes.map((node) => {
          if (node.matchId === matchId) {
            node.matchId = null;
            node.winnerId = null;
          }
          return node;
        });
        await db.collection("tournaments").updateOne(
          { id: match.tournamentId },
          { $set: { "roadmap.nodes": nodes } }
        );
      }
    }
    await db.collection("matches").deleteOne({ id: matchId });
    await db.collection("scorings").deleteOne({ matchId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/tournaments/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    const tournament = await db.collection("tournaments").findOne({ id: req.params.id });
    if (!tournament) return res.status(404).json({ error: "Tournament not found" });

    // Only the creator can cancel/delete a tournament
    if (tournament.organizerId !== user.id && tournament.organizer !== user.name) {
      return res.status(403).json({ error: "Only the tournament creator can cancel this tournament." });
    }

    // Delete all related data
    const teamIds = tournament.teamIds || [];
    if (teamIds.length > 0) {
      // Dissociate all players belonging to teams in this tournament
      await db.collection("players").updateMany({ teamId: { $in: teamIds } }, { $set: { teamId: null } });
      await db.collection("users").updateMany({ teamId: { $in: teamIds } }, { $set: { teamId: null } });
      // Delete all teams in this tournament
      await db.collection("teams").deleteMany({ id: { $in: teamIds } });
    }
    // Delete all matches for this tournament
    const matches = await db.collection("matches").find({ tournamentId: req.params.id }).toArray();
    const matchIds = matches.map(m => m.id);
    if (matchIds.length > 0) {
      await db.collection("scorings").deleteMany({ matchId: { $in: matchIds } });
    }
    await db.collection("matches").deleteMany({ tournamentId: req.params.id });
    // Delete certificates for this tournament
    await db.collection("certificates").deleteMany({ tournamentId: req.params.id });
    // Delete the tournament itself
    await db.collection("tournaments").deleteOne({ id: req.params.id });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/notifications/read", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    const { db } = await connectToDatabase();
    const filter = user?.playerId ? { recipientId: user.playerId } : {};
    await db.collection("notifications").updateMany(filter, { $set: { read: true } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/notifications", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.playerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { db } = await connectToDatabase();
    await db.collection("notifications").deleteMany({ recipientId: user.playerId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/notifications/:id", async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user || !user.playerId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { db } = await connectToDatabase();
    const notif = await db.collection("notifications").findOne({ id: req.params.id });
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    if (notif.recipientId !== user.playerId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    await db.collection("notifications").deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/certificates/detailed", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const certs = await db.collection("certificates").find().toArray();
    const results = [];
    for (const c of certs) {
      const tournament = await db.collection("tournaments").findOne({ id: c.tournamentId });
      let recipientName = "Unknown";
      if (c.playerId) {
        const p = await db.collection("players").findOne({ id: c.playerId });
        if (p) recipientName = p.name;
      } else if (c.teamId) {
        const t = await db.collection("teams").findOne({ id: c.teamId });
        if (t) recipientName = t.name;
      }
      results.push({
        ...c,
        tournamentName: tournament ? tournament.name : "Unknown Tournament",
        recipientName,
      });
    }
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/tournaments/:tournamentId/remove-team", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    const { tournamentId } = req.params;
    const { teamId } = req.body;

    const tournament = await db.collection("tournaments").findOne({ id: tournamentId });
    if (!tournament) return res.status(404).json({ error: "Tournament not found" });

    // Verify user is organizer of the tournament
    if (tournament.organizerId !== user.id && tournament.organizer !== user.name) {
      return res.status(403).json({ error: "Only the tournament organizer can remove teams." });
    }

    // Remove teamId from tournament
    await db.collection("tournaments").updateOne(
      { id: tournamentId },
      { $pull: { teamIds: teamId } }
    );

    // Dissociate/delete team and players
    await db.collection("teams").deleteOne({ id: teamId });
    await db.collection("players").updateMany({ teamId: teamId }, { $set: { teamId: null } });
    await db.collection("users").updateMany({ teamId: teamId }, { $set: { teamId: null } });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/teams/:teamId/remove-player", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    const { teamId } = req.params;
    const { playerId } = req.body;

    const team = await db.collection("teams").findOne({ id: teamId });
    if (!team) return res.status(404).json({ error: "Team not found" });

    // Verify user is the captain of the team
    if (team.captainId !== user.playerId) {
      return res.status(403).json({ error: "Only the team captain can remove players." });
    }

    if (playerId === team.captainId) {
      return res.status(400).json({ error: "Captains cannot remove themselves from the team." });
    }

    // Remove playerId from team
    await db.collection("teams").updateOne(
      { id: teamId },
      { $pull: { playerIds: playerId } }
    );

    // Dissociate player profile and user settings
    await db.collection("players").updateOne({ id: playerId }, { $set: { teamId: null } });
    await db.collection("users").updateOne({ playerId: playerId }, { $set: { teamId: null } });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start Express Server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    const { db } = await connectToDatabase();
    console.log("Connected to MongoDB database successfully.");
    console.log("Recalculating all player career stats...");
    await recalculateStatsInternal(db);
    console.log("Recalculating all team career stats...");
    const teams = await db.collection("teams").find().toArray();
    for (const t of teams) {
      await recalculateTeamCareerStats(db, t.id);
    }
    console.log("Recalculation complete.");
  } catch (err) {
    console.error("Failed to connect to MongoDB on start:", err);
  }
});
