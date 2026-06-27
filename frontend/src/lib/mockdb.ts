// Deterministic seeded mock data for the entire app.
// Generates 300+ players, 9 tournaments, 100+ matches with full scorecards.

export type PlayerRole = "Batter" | "Bowler" | "All-rounder" | "Wicket-keeper";

export interface Player {
  id: string;
  name: string;
  initials: string;
  role: PlayerRole;
  battingStyle: "Right-hand" | "Left-hand";
  bowlingStyle: string;
  teamId: string;
  age: number;
  country: string;
  city: string;
  jersey: number;
  stats: PlayerStats;
  achievements: string[];
  joinedAt: string;
}

export interface PlayerStats {
  matches: number;
  innings: number;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  highScore: number;
  notOuts: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  bestBowling: string;
  catches: number;
  stumpings: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  code: string;
  color: string;
  captainId: string;
  city: string;
  founded: number;
  trophies: number;
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  nrr: number;
  playerIds: string[];
}

export type TournamentStatus = "upcoming" | "live" | "completed";
export type TournamentFormat = "T20" | "T10" | "ODI";

export interface Tournament {
  id: string;
  name: string;
  code: string;
  format: TournamentFormat;
  status: TournamentStatus;
  startDate: string;
  endDate: string;
  city: string;
  venue: string;
  teamIds: string[];
  prizePool: string;
  winnerId?: string;
  runnerUpId?: string;
  orangeCapId?: string;
  purpleCapId?: string;
  mvpId?: string;
  description: string;
  organizer: string;
}

export type MatchStatus = "upcoming" | "live" | "completed";

export interface InningsLine {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  overs: number; // decimal overs e.g. 18.4
  batters: Array<{
    playerId: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    out: boolean;
    dismissal?: string;
    sr: number;
  }>;
  bowlers: Array<{
    playerId: string;
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
    economy: number;
  }>;
  fallOfWickets: Array<{ score: number; over: number; playerId: string }>;
}

export interface Match {
  id: string;
  tournamentId: string;
  teamAId: string;
  teamBId: string;
  status: MatchStatus;
  date: string;
  venue: string;
  overs: number;
  tossWinnerId?: string;
  tossDecision?: "bat" | "bowl";
  innings: InningsLine[];
  winnerId?: string;
  resultText?: string;
  motmId?: string;
  commentary: Array<{ over: string; text: string; runs?: number; wicket?: boolean }>;
}

export interface Certificate {
  id: string;
  type:
    | "Champion"
    | "Runner Up"
    | "Participation"
    | "MVP"
    | "Orange Cap"
    | "Purple Cap"
    | "Best Batter"
    | "Best Bowler"
    | "Best Fielder";
  tournamentId: string;
  playerId?: string;
  teamId?: string;
  issuedOn: string;
}

// ---------- Seeded RNG ----------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260612);
const r = () => rng();
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
const rint = (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;

// ---------- Source data ----------
const FIRST = [
  "Arjun",
  "Rohit",
  "Virat",
  "Sachin",
  "Yuvraj",
  "Hardik",
  "Rishabh",
  "KL",
  "Shubman",
  "Jasprit",
  "Mohammed",
  "Ravindra",
  "Ravichandran",
  "Suryakumar",
  "Ishan",
  "Shreyas",
  "Cheteshwar",
  "Ajinkya",
  "Bhuvneshwar",
  "Mayank",
  "Prithvi",
  "Sanju",
  "Shikhar",
  "Dinesh",
  "Manish",
  "Kedar",
  "Axar",
  "Kuldeep",
  "Yuzvendra",
  "Washington",
  "Tilak",
  "Ruturaj",
  "Devdutt",
  "Sarfaraz",
  "Yashasvi",
  "Abhishek",
  "Tushar",
  "Riyan",
  "Akash",
  "Mukesh",
  "Avesh",
  "Khaleel",
  "Arshdeep",
  "Umran",
  "Shivam",
  "Venkatesh",
  "Rinku",
  "Nitish",
  "Harshit",
  "Dhruv",
  "Aryan",
  "Kabir",
  "Vihaan",
  "Aditya",
  "Reyansh",
  "Ayaan",
  "Krishna",
  "Ishaan",
  "Atharv",
  "Rudra",
  "Pranav",
  "Yash",
  "Shaurya",
  "Aarav",
  "Vivaan",
  "Ansh",
  "Dev",
  "Raghav",
  "Karan",
  "Aakash",
  "Nikhil",
  "Sahil",
  "Rahul",
  "Saurabh",
  "Kunal",
  "Harsh",
  "Vikas",
  "Tarun",
  "Rohan",
  "Anuj",
];
const LAST = [
  "Sharma",
  "Kohli",
  "Tendulkar",
  "Singh",
  "Pandya",
  "Pant",
  "Rahul",
  "Gill",
  "Bumrah",
  "Shami",
  "Jadeja",
  "Ashwin",
  "Yadav",
  "Kishan",
  "Iyer",
  "Pujara",
  "Rahane",
  "Kumar",
  "Agarwal",
  "Shaw",
  "Samson",
  "Dhawan",
  "Karthik",
  "Pandey",
  "Patel",
  "Chahal",
  "Sundar",
  "Verma",
  "Gaikwad",
  "Padikkal",
  "Khan",
  "Jaiswal",
  "Deshpande",
  "Parag",
  "Singh",
  "Mukesh",
  "Khan",
  "Malik",
  "Reddy",
  "Rana",
  "Saxena",
  "Mehta",
  "Joshi",
  "Kapoor",
  "Gupta",
  "Bansal",
  "Tiwari",
  "Mishra",
  "Goyal",
  "Sinha",
  "Bose",
  "Das",
  "Ghosh",
  "Roy",
  "Sen",
  "Banerjee",
  "Chatterjee",
  "Mukherjee",
  "Dutta",
  "Pal",
];
const CITIES = [
  "Mumbai",
  "Delhi",
  "Bangalore",
  "Chennai",
  "Kolkata",
  "Hyderabad",
  "Pune",
  "Jaipur",
  "Ahmedabad",
  "Lucknow",
  "Indore",
  "Nagpur",
  "Bhopal",
  "Surat",
  "Kanpur",
  "Patna",
  "Visakhapatnam",
  "Vadodara",
  "Coimbatore",
  "Mysuru",
];
const COUNTRIES = [
  "India",
  "Australia",
  "England",
  "Pakistan",
  "South Africa",
  "New Zealand",
  "Sri Lanka",
  "West Indies",
];
const ROLES: PlayerRole[] = ["Batter", "Bowler", "All-rounder", "Wicket-keeper"];
const BOWLING = [
  "Right-arm fast",
  "Right-arm medium",
  "Right-arm offbreak",
  "Left-arm orthodox",
  "Leg break googly",
  "Left-arm fast",
];

const TEAM_NAMES: Array<[string, string, string]> = [
  ["Mumbai Mavericks", "MMV", "oklch(0.7 0.18 30)"],
  ["Delhi Dynamos", "DDY", "oklch(0.65 0.18 250)"],
  ["Bangalore Blitz", "BBZ", "oklch(0.68 0.2 20)"],
  ["Chennai Chargers", "CCH", "oklch(0.85 0.18 75)"],
  ["Kolkata Kings", "KKG", "oklch(0.55 0.18 290)"],
  ["Hyderabad Hawks", "HHK", "oklch(0.7 0.2 50)"],
  ["Pune Panthers", "PPT", "oklch(0.65 0.15 180)"],
  ["Jaipur Jaguars", "JJG", "oklch(0.7 0.2 350)"],
  ["Lucknow Lions", "LLN", "oklch(0.78 0.18 70)"],
  ["Ahmedabad Aces", "AAC", "oklch(0.6 0.18 200)"],
  ["Goa Guardians", "GGD", "oklch(0.7 0.2 150)"],
  ["Kerala Kites", "KKT", "oklch(0.62 0.18 140)"],
  ["Indore Invincibles", "IDV", "oklch(0.66 0.2 320)"],
  ["Nagpur Nawabs", "NPN", "oklch(0.7 0.18 100)"],
  ["Bhopal Boars", "BPB", "oklch(0.55 0.15 220)"],
];

const TOURNAMENT_TEMPLATES: Array<{
  name: string;
  status: TournamentStatus;
  format: TournamentFormat;
}> = [
  { name: "Premier Cup 2024", status: "completed", format: "T20" },
  { name: "Champions Trophy 2024", status: "completed", format: "T20" },
  { name: "Monsoon Slam 2024", status: "completed", format: "T10" },
  { name: "Heritage League 2024", status: "completed", format: "ODI" },
  { name: "Diwali Showdown 2024", status: "completed", format: "T20" },
  { name: "Summer Smash 2026", status: "live", format: "T20" },
  { name: "Metro Masters 2026", status: "live", format: "T10" },
  { name: "Independence Cup 2026", status: "upcoming", format: "T20" },
  { name: "Winter Clash 2026", status: "upcoming", format: "T20" },
];

// ---------- Generation ----------
function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function genPlayers(teamId: string, count: number, startIdx: number): Player[] {
  const players: Player[] = [];
  for (let i = 0; i < count; i++) {
    const fn = pick(FIRST);
    const ln = pick(LAST);
    const name = `${fn} ${ln}`;
    const role = i === 0 ? "All-rounder" : ROLES[(i + startIdx) % ROLES.length];
    const matches = rint(12, 95);
    const innings = Math.max(1, matches - rint(0, 4));
    const runs = role === "Bowler" ? rint(40, 380) : rint(280, 2400);
    const balls = Math.max(runs, role === "Bowler" ? rint(70, 500) : rint(280, 1900));
    const fours = Math.floor(runs / rint(10, 16));
    const sixes = Math.floor(runs / rint(22, 40));
    const fifties = Math.floor(runs / 350);
    const hundreds = Math.floor(runs / 1100);
    const wickets = role === "Batter" ? rint(0, 8) : rint(15, 120);
    const ballsBowled = role === "Batter" ? wickets * 18 : rint(600, 2400);
    const runsConceded = Math.floor((ballsBowled / 6) * (5 + r() * 4));
    players.push({
      id: `p_${startIdx + i}`,
      name,
      initials: initials(name),
      role,
      battingStyle: r() > 0.25 ? "Right-hand" : "Left-hand",
      bowlingStyle: pick(BOWLING),
      teamId,
      age: rint(18, 36),
      country: r() > 0.85 ? pick(COUNTRIES) : "India",
      city: pick(CITIES),
      jersey: rint(1, 99),
      stats: {
        matches,
        innings,
        runs,
        ballsFaced: balls,
        fours,
        sixes,
        fifties,
        hundreds,
        highScore: Math.min(187, Math.floor(runs / Math.max(1, innings)) + rint(20, 70)),
        notOuts: rint(0, Math.max(1, Math.floor(innings / 6))),
        wickets,
        ballsBowled,
        runsConceded,
        bestBowling: `${rint(2, 5)}/${rint(8, 40)}`,
        catches: rint(2, 45),
        stumpings: role === "Wicket-keeper" ? rint(4, 30) : 0,
      },
      achievements: [
        ...(hundreds > 0 ? [`${hundreds} century${hundreds > 1 ? "ies" : ""}`] : []),
        ...(fifties > 2 ? [`${fifties} fifties`] : []),
        ...(wickets > 50 ? [`${wickets}+ wickets`] : []),
        ...(sixes > 30 ? ["Six-hitting machine"] : []),
      ],
      joinedAt: `202${rint(2, 5)}-${String(rint(1, 12)).padStart(2, "0")}-${String(rint(1, 28)).padStart(2, "0")}`,
    });
  }
  return players;
}

function genTeams(): { teams: Team[]; players: Player[] } {
  const teams: Team[] = [];
  const allPlayers: Player[] = [];
  let pIdx = 0;
  TEAM_NAMES.forEach(([name, short, color], i) => {
    const id = `t_${i}`;
    const squad = genPlayers(id, 20, pIdx);
    pIdx += 20;
    const matches = rint(40, 140);
    const wins = Math.floor(matches * (0.4 + r() * 0.3));
    const losses = Math.floor(matches * (0.3 + r() * 0.2));
    teams.push({
      id,
      name,
      shortName: short,
      color,
      code: short + rint(100, 999),
      captainId: squad[0].id,
      city: pick(CITIES),
      founded: rint(2008, 2022),
      trophies: rint(0, 6),
      matches,
      wins,
      losses,
      ties: matches - wins - losses,
      nrr: +(r() * 2 - 0.5).toFixed(3),
      playerIds: squad.map((p) => p.id),
    });
    allPlayers.push(...squad);
  });
  return { teams, players: allPlayers };
}

function genInnings(
  battingTeam: Team,
  bowlingTeam: Team,
  players: Player[],
  overs: number,
): InningsLine {
  const batters = battingTeam.playerIds.slice(0, 11).map((pid) => {
    const out = r() > 0.25;
    const balls = out ? rint(3, 38) : rint(8, 50);
    const runs = Math.max(0, Math.floor(balls * (0.7 + r() * 1.6)));
    return {
      playerId: pid,
      runs,
      balls,
      fours: Math.floor(runs / rint(8, 14)),
      sixes: Math.floor(runs / rint(18, 30)),
      out,
      dismissal: out ? `b ${pick(bowlingTeam.playerIds.slice(0, 6))}` : undefined,
      sr: balls > 0 ? +((runs / balls) * 100).toFixed(2) : 0,
    };
  });
  const totalRuns = batters.reduce((s, b) => s + b.runs, 0) + rint(2, 18);
  const wickets = Math.min(10, batters.filter((b) => b.out).length);
  const bowlers = bowlingTeam.playerIds.slice(0, 6).map((pid) => {
    const ov = +(overs / 6 + r() * 0.4).toFixed(1);
    const runs = Math.floor(ov * (5 + r() * 4));
    const wkts = rint(0, 3);
    return {
      playerId: pid,
      overs: ov,
      maidens: rint(0, 1),
      runs,
      wickets: wkts,
      economy: +(runs / Math.max(0.1, ov)).toFixed(2),
    };
  });
  const fow = batters
    .filter((b) => b.out)
    .map((b, idx) => ({
      score: Math.floor((totalRuns * (idx + 1)) / (wickets + 1)),
      over: +((overs * (idx + 1)) / (wickets + 1)).toFixed(1),
      playerId: b.playerId,
    }));
  return {
    battingTeamId: battingTeam.id,
    bowlingTeamId: bowlingTeam.id,
    runs: totalRuns,
    wickets,
    overs: Math.min(overs, +(overs - r() * 0.4).toFixed(1)),
    batters,
    bowlers,
    fallOfWickets: fow,
  };
}

function genCommentary(inns: InningsLine[]): Match["commentary"] {
  const lines: Match["commentary"] = [];
  const phrases = [
    "Driven beautifully through the covers",
    "Yorker on the toes, well dug out",
    "Tossed up, defended back",
    "SIX! Launched over long-on",
    "FOUR! Pierced through point",
    "Edge and gone! Easy take",
    "Dot ball, building pressure",
    "Single tapped to mid-wicket",
    "Bouncer, ducked under",
    "Sweep shot, just a single",
  ];
  for (let i = 0; i < 12; i++) {
    const wicket = r() > 0.85;
    lines.push({
      over: `${rint(0, 19)}.${rint(1, 6)}`,
      text: wicket ? "OUT! The bowler strikes!" : pick(phrases),
      runs: wicket ? 0 : pick([0, 1, 1, 2, 4, 6]),
      wicket,
    });
  }
  return lines;
}

export interface MockDB {
  teams: Team[];
  players: Player[];
  tournaments: Tournament[];
  matches: Match[];
  certificates: Certificate[];
}

function build(): MockDB {
  const { teams, players } = genTeams();
  const tournaments: Tournament[] = [];
  const matches: Match[] = [];
  const certificates: Certificate[] = [];

  TOURNAMENT_TEMPLATES.forEach((tpl, ti) => {
    const teamIds = teams.slice(0, 6 + (ti % 4)).map((t) => t.id);
    const id = `tr_${ti}`;
    const overs = tpl.format === "T10" ? 10 : tpl.format === "T20" ? 20 : 50;
    const tourMatches: Match[] = [];

    if (tpl.status !== "upcoming") {
      const matchCount = tpl.status === "completed" ? rint(14, 22) : rint(6, 10);
      for (let m = 0; m < matchCount; m++) {
        const tA = teams.find((t) => t.id === teamIds[m % teamIds.length])!;
        const tB = teams.find((t) => t.id === teamIds[(m + 1 + (m % 3)) % teamIds.length])!;
        if (tA.id === tB.id) continue;
        const isLive = tpl.status === "live" && m >= matchCount - 2;
        const isUpcoming = tpl.status === "live" && m === matchCount - 1;
        const status: MatchStatus = isUpcoming ? "upcoming" : isLive ? "live" : "completed";
        const inns: InningsLine[] = [];
        if (status !== "upcoming") {
          inns.push(genInnings(tA, tB, players, overs));
          if (status === "completed") inns.push(genInnings(tB, tA, players, overs));
          else
            inns.push({ ...genInnings(tB, tA, players, overs), overs: +(overs * 0.45).toFixed(1) });
        }
        const winnerId =
          status === "completed" ? (inns[0].runs > inns[1].runs ? tA.id : tB.id) : undefined;
        tourMatches.push({
          id: `m_${ti}_${m}`,
          tournamentId: id,
          teamAId: tA.id,
          teamBId: tB.id,
          status,
          date: `2026-0${rint(1, 9)}-${String(rint(1, 28)).padStart(2, "0")}`,
          venue: `${pick(CITIES)} Stadium`,
          overs,
          tossWinnerId: status !== "upcoming" ? (r() > 0.5 ? tA.id : tB.id) : undefined,
          tossDecision: r() > 0.5 ? "bat" : "bowl",
          innings: inns,
          winnerId,
          resultText: winnerId
            ? `${teams.find((t) => t.id === winnerId)!.name} won by ${rint(5, 65)} runs`
            : status === "live"
              ? "Match in progress"
              : "Match yet to begin",
          motmId: winnerId
            ? teams.find((t) => t.id === winnerId)!.playerIds[rint(0, 10)]
            : undefined,
          commentary: status !== "upcoming" ? genCommentary(inns) : [],
        });
      }
    }

    // Upcoming-only fixture set
    if (tpl.status === "upcoming") {
      for (let m = 0; m < 6; m++) {
        const tA = teams.find((t) => t.id === teamIds[m % teamIds.length])!;
        const tB = teams.find((t) => t.id === teamIds[(m + 2) % teamIds.length])!;
        if (tA.id === tB.id) continue;
        tourMatches.push({
          id: `m_${ti}_${m}`,
          tournamentId: id,
          teamAId: tA.id,
          teamBId: tB.id,
          status: "upcoming",
          date: `2026-1${rint(0, 2)}-${String(rint(1, 28)).padStart(2, "0")}`,
          venue: `${pick(CITIES)} Stadium`,
          overs,
          innings: [],
          commentary: [],
          resultText: "Match yet to begin",
        });
      }
    }

    matches.push(...tourMatches);

    let winnerId: string | undefined,
      runnerUpId: string | undefined,
      orangeCapId: string | undefined,
      purpleCapId: string | undefined,
      mvpId: string | undefined;
    if (tpl.status === "completed") {
      winnerId = teamIds[0];
      runnerUpId = teamIds[1];
      orangeCapId = teams.find((t) => t.id === winnerId)!.playerIds[1];
      purpleCapId = teams.find((t) => t.id === runnerUpId)!.playerIds[3];
      mvpId = teams.find((t) => t.id === winnerId)!.playerIds[0];
      certificates.push(
        {
          id: `c_${ti}_w`,
          type: "Champion",
          tournamentId: id,
          teamId: winnerId,
          issuedOn: "2024-12-01",
        },
        {
          id: `c_${ti}_r`,
          type: "Runner Up",
          tournamentId: id,
          teamId: runnerUpId,
          issuedOn: "2024-12-01",
        },
        {
          id: `c_${ti}_o`,
          type: "Orange Cap",
          tournamentId: id,
          playerId: orangeCapId,
          issuedOn: "2024-12-01",
        },
        {
          id: `c_${ti}_p`,
          type: "Purple Cap",
          tournamentId: id,
          playerId: purpleCapId,
          issuedOn: "2024-12-01",
        },
        { id: `c_${ti}_m`, type: "MVP", tournamentId: id, playerId: mvpId, issuedOn: "2024-12-01" },
      );
    }

    tournaments.push({
      id,
      name: tpl.name,
      code: `TRN${1000 + ti}`,
      format: tpl.format,
      status: tpl.status,
      startDate: `2026-0${rint(1, 9)}-01`,
      endDate: `2026-1${rint(0, 2)}-30`,
      city: pick(CITIES),
      venue: `${pick(CITIES)} Cricket Ground`,
      teamIds,
      prizePool: `₹${rint(2, 25)} Lakh`,
      winnerId,
      runnerUpId,
      orangeCapId,
      purpleCapId,
      mvpId,
      description: `A premier ${tpl.format} cricket tournament featuring the region's top clubs competing for glory.`,
      organizer: "Stadium Sports League",
    });
  });

  return { teams, players, tournaments, matches, certificates };
}

export const DB: MockDB = build();

// Helpers
export const findTeam = (id?: string) => DB.teams.find((t) => t.id === id);
export const findPlayer = (id?: string) => DB.players.find((p) => p.id === id);
export const findTournament = (id?: string) => DB.tournaments.find((t) => t.id === id);
export const findMatch = (id?: string) => DB.matches.find((m) => m.id === id);
export const teamPlayers = (teamId: string) => DB.players.filter((p) => p.teamId === teamId);
export const tournamentMatches = (tid: string) => DB.matches.filter((m) => m.tournamentId === tid);

export function pointsTable(tournamentId: string) {
  const t = findTournament(tournamentId);
  if (!t) return [];
  return t.teamIds
    .map((tid) => {
      const team = findTeam(tid)!;
      const ms = DB.matches.filter(
        (m) =>
          m.tournamentId === tournamentId &&
          (m.teamAId === tid || m.teamBId === tid) &&
          m.status === "completed",
      );
      const w = ms.filter((m) => m.winnerId === tid).length;
      const l = ms.length - w;
      return {
        team,
        played: ms.length,
        wins: w,
        losses: l,
        nrr: team.nrr,
        points: w * 2,
      };
    })
    .sort((a, b) => b.points - a.points || b.nrr - a.nrr);
}

export function topRunScorers(tournamentId?: string, limit = 10) {
  return [...DB.players].sort((a, b) => b.stats.runs - a.stats.runs).slice(0, limit);
}

export function topWicketTakers(tournamentId?: string, limit = 10) {
  return [...DB.players].sort((a, b) => b.stats.wickets - a.stats.wickets).slice(0, limit);
}
