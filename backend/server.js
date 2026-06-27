import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectToDatabase } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../frontend/.env") });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:8080",
  credentials: true
}));
app.use(express.json());
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

// --- AUTH ENDPOINTS ---

app.get("/auth/me", async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.json(null);
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    playerId: user.playerId,
    teamId: user.teamId,
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
  res.clearCookie("sn_session", { path: "/" });
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
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000, 
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      playerId: user.playerId,
      teamId: user.teamId,
    });
  } catch (e) {
    console.error("Dev login error:", e);
    res.status(500).json({ error: "Internal server error" });
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
        playerId,
        createdAt: new Date(),
      };

      await db.collection("users").insertOne(user);
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
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
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
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/players/:id", async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const item = await db.collection("players").findOne({ id: req.params.id });
    res.json(item);
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

    const { city, country, role, battingStyle, bowlingStyle } = req.body;

    const updateFields = {};
    if (city !== undefined) updateFields.city = city;
    if (country !== undefined) updateFields.country = country;
    if (role !== undefined) updateFields.role = role;
    if (battingStyle !== undefined) updateFields.battingStyle = battingStyle;
    if (bowlingStyle !== undefined) updateFields.bowlingStyle = bowlingStyle;

    await db.collection("players").updateOne(
      { id: playerId },
      { $set: updateFields }
    );

    const updatedPlayer = await db.collection("players").findOne({ id: playerId });
    res.json(updatedPlayer);
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
    const { db } = await connectToDatabase();
    const list = await db.collection("notifications").find().toArray();
    res.json(list);
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
    const feed = allFeed.filter(f => {
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
        return true;
      }
      return false;
    }).slice(0, 10);

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
      feed,
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
      const captain = await db.collection("players").findOne({ id: team.captainId });
      const players = await db.collection("players").find({ id: { $in: team.playerIds || [] } }).toArray();
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
    };
    await db.collection("matches").insertOne(m);
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
        },
      }
    );
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
    const data = req.body;

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
          battingTeamId: innings.length === 0 ? battingTeamId : bowlingTeamId,
          bowlingTeamId: innings.length === 0 ? bowlingTeamId : battingTeamId,
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

      let commentary = [...(match.commentary || [])];
      if (data.ballLog && data.ballLog.length > 0) {
        const lastBall = data.ballLog[data.ballLog.length - 1];
        const overStr = lastBall.over;
        const exists = commentary.some((c) => c.over === overStr);
        if (!exists) {
          let outcomeStr = "";
          let runsVal = lastBall.runs;
          let isWicket = false;

          if (lastBall.outcome === "W") {
            outcomeStr = "OUT! The bowler strikes!";
            isWicket = true;
          } else if (lastBall.outcome === "6") {
            outcomeStr = "SIX! Launched over the boundary!";
          } else if (lastBall.outcome === "4") {
            outcomeStr = "FOUR! Pierced through the gap!";
          } else {
            outcomeStr = `Runs scored: ${runsVal}`;
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
      let resultText = match.resultText;

      if (data.finished) {
        status = "completed";
        winnerId = data.target && data.runs >= data.target ? data.battingTeamId : data.bowlingTeamId;
        const winnerName = (await db.collection("teams").findOne({ id: winnerId }))?.name || "Team";
        resultText =
          data.target && data.runs >= data.target
            ? `${winnerName} won by ${10 - data.wickets} wickets`
            : `${winnerName} won by ${(data.target ?? data.runs) - data.runs - 1} runs`;

        const batTeam = await db.collection("teams").findOne({ id: data.battingTeamId });
        if (batTeam) {
          await db.collection("players").updateMany(
            { id: { $in: batTeam.playerIds } },
            { $inc: { "stats.matches": 1 } }
          );
        }
        const bowlTeam = await db.collection("teams").findOne({ id: data.bowlingTeamId });
        if (bowlTeam) {
          await db.collection("players").updateMany(
            { id: { $in: bowlTeam.playerIds } },
            { $inc: { "stats.matches": 1 } }
          );
        }

        const tournamentId = match.tournamentId;
        const certExists = await db.collection("certificates").findOne({ tournamentId });
        if (!certExists) {
          await db.collection("certificates").insertMany([
            {
              id: `c_${Date.now()}_w`,
              type: "Champion",
              tournamentId,
              teamId: winnerId,
              issuedOn: new Date().toISOString().slice(0, 10),
            },
            {
              id: `c_${Date.now()}_m`,
              type: "MVP",
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
      // Delete all players belonging to teams in this tournament
      await db.collection("players").deleteMany({ teamId: { $in: teamIds } });
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
    const { db } = await connectToDatabase();
    await db.collection("notifications").updateMany({}, { $set: { read: true } });
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
    await db.collection("players").deleteMany({ teamId: teamId });
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
    await connectToDatabase();
    console.log("Connected to MongoDB database successfully.");
  } catch (err) {
    console.error("Failed to connect to MongoDB on start:", err);
  }
});
