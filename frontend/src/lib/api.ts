// Client-side API functions calling Express server REST endpoints

async function handleResponse(res: Response) {
  if (!res.ok) {
    const errorText = await res.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      parsedError = { error: errorText };
    }
    throw new Error(parsedError.error || parsedError.message || `Request failed with status ${res.status}`);
  }
  return res.json();
}

function extractPayload(args: any) {
  if (args && typeof args === "object" && "data" in args) {
    return args.data;
  }
  return args;
}

// --- QUERIES ---

export async function getTournaments() {
  const res = await fetch("/api/tournaments");
  return handleResponse(res);
}

export async function getTournament(args: any) {
  const id = extractPayload(args);
  const res = await fetch(`/api/tournaments/${id}`);
  return handleResponse(res);
}

export async function getTeams() {
  const res = await fetch("/api/teams");
  return handleResponse(res);
}

export async function getTeam(args: any) {
  const id = extractPayload(args);
  const res = await fetch(`/api/teams/${id}`);
  return handleResponse(res);
}

export async function getTeamPlayers(args: any) {
  const teamId = extractPayload(args);
  const res = await fetch(`/api/teams/${teamId}/players`);
  return handleResponse(res);
}

export async function getPlayer(args: any) {
  const id = extractPayload(args);
  const res = await fetch(`/api/players/${id}`);
  return handleResponse(res);
}

export async function updatePlayer(args: any) {
  const payload = extractPayload(args);
  const { id, ...data } = payload;
  const res = await fetch(`/api/players/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function getMatches() {
  const res = await fetch("/api/matches");
  return handleResponse(res);
}

export async function getMatch(args: any) {
  const id = extractPayload(args);
  const res = await fetch(`/api/matches/${id}`);
  return handleResponse(res);
}

export async function getTournamentMatches(args: any) {
  const tournamentId = extractPayload(args);
  const res = await fetch(`/api/tournaments/${tournamentId}/matches`);
  return handleResponse(res);
}

export async function getCertificates() {
  const res = await fetch("/api/certificates");
  return handleResponse(res);
}

export async function getPlayerCertificates(args: any) {
  const playerId = extractPayload(args);
  const res = await fetch(`/api/players/${playerId}/certificates`);
  return handleResponse(res);
}

export async function getNotifications() {
  const res = await fetch("/api/notifications");
  return handleResponse(res);
}

export async function getFeed() {
  const res = await fetch("/api/feed");
  return handleResponse(res);
}

export async function getHomeData(args?: any) {
  const playerId = extractPayload(args);
  const url = playerId ? `/api/home-data?playerId=${encodeURIComponent(playerId)}` : "/api/home-data";
  const res = await fetch(url);
  return handleResponse(res);
}

export async function getPointsTable(args: any) {
  const tournamentId = extractPayload(args);
  const res = await fetch(`/api/tournaments/${tournamentId}/points-table`);
  return handleResponse(res);
}

export async function getLeaderboard() {
  const res = await fetch("/api/leaderboard");
  return handleResponse(res);
}

export async function getTournamentSquads(args: any) {
  const tournamentId = extractPayload(args);
  const res = await fetch(`/api/tournaments/${tournamentId}/squads`);
  return handleResponse(res);
}

// --- MUTATIONS ---

export async function createTournament(args: any) {
  const payload = extractPayload(args);
  const res = await fetch("/api/tournaments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function createTeamForTournament(args: any) {
  const payload = extractPayload(args);
  const res = await fetch("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function joinTournamentByCode(args: any) {
  const code = extractPayload(args);
  const res = await fetch("/api/tournaments/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return handleResponse(res);
}

export async function updateTeamName(args: any) {
  const payload = extractPayload(args);
  const res = await fetch("/api/teams/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function joinTeamByCode(args: any) {
  const code = extractPayload(args);
  const res = await fetch("/api/teams/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return handleResponse(res);
}

export async function createMatch(args: any) {
  const payload = extractPayload(args);
  const res = await fetch("/api/matches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function setToss(args: any) {
  const payload = extractPayload(args);
  const res = await fetch(`/api/matches/${payload.matchId}/toss`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function getScoring(args: any) {
  const matchId = extractPayload(args);
  const res = await fetch(`/api/matches/${matchId}/scoring`);
  return handleResponse(res);
}

export async function saveScoring(args: any) {
  const payload = extractPayload(args);
  const res = await fetch(`/api/matches/${payload.matchId}/scoring`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function resetScoringDb(args: any) {
  const matchId = extractPayload(args);
  const res = await fetch(`/api/matches/${matchId}/scoring`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function markNotificationsRead() {
  const res = await fetch("/api/notifications/read", {
    method: "POST",
  });
  return handleResponse(res);
}

export async function getCertificatesWithDetails() {
  const res = await fetch("/api/certificates/detailed");
  return handleResponse(res);
}

export async function deleteTournament(args: any) {
  const id = extractPayload(args);
  const res = await fetch(`/api/tournaments/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function removeTeamFromTournament(args: any) {
  const { tournamentId, teamId } = extractPayload(args);
  const res = await fetch(`/api/tournaments/${tournamentId}/remove-team`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId }),
  });
  return handleResponse(res);
}

export async function removePlayerFromTeam(args: any) {
  const { teamId, playerId } = extractPayload(args);
  const res = await fetch(`/api/teams/${teamId}/remove-player`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId }),
  });
  return handleResponse(res);
}
