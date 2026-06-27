import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DB, type Certificate, type Match, type Tournament, type Team } from "./mockdb";
import { logout } from "./auth";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  playerId?: string;
  teamId?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  icon?: "trophy" | "user" | "calendar" | "award";
}

export interface FeedItem {
  id: string;
  type: "match" | "achievement" | "milestone" | "news";
  title: string;
  body: string;
  time: string;
  meta?: string;
}

interface ScoringState {
  matchId: string | null;
  strikerId?: string;
  nonStrikerId?: string;
  bowlerId?: string;
  battingTeamId?: string;
  bowlingTeamId?: string;
  runs: number;
  wickets: number;
  ballsInOver: number;
  totalBalls: number;
  inningsIndex: number;
  target?: number;
  ballLog: Array<{ over: string; outcome: string; runs: number }>;
  finished: boolean;
}

interface AppState {
  user: CurrentUser | null;
  onboarded: boolean;
  tournaments: Tournament[];
  teams: Team[];
  matches: Match[];
  certificates: Certificate[];
  notifications: Notification[];
  feed: FeedItem[];
  scoring: ScoringState;

  // Modal States
  authModalOpen: boolean;
  createModalOpen: boolean;
  notificationsModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  setCreateModalOpen: (open: boolean) => void;
  setNotificationsModalOpen: (open: boolean) => void;

  // Auth
  signInMockGoogle: () => void;
  signOut: () => void;
  completeOnboarding: () => void;
  setUser: (user: CurrentUser | null) => void;

  // Mutations
  createTournament: (data: Partial<Tournament>) => string;
  createTeam: (data: Partial<Team>) => string;
  joinTournament: (code: string) => Tournament | undefined;
  joinTeam: (code: string) => Team | undefined;
  createMatch: (data: {
    tournamentId: string;
    teamAId: string;
    teamBId: string;
    overs: number;
    venue: string;
  }) => string;
  setToss: (matchId: string, winnerId: string, decision: "bat" | "bowl") => void;

  // Scoring
  startScoring: (matchId: string, striker: string, nonStriker: string, bowler: string) => void;
  applyBall: (outcome: BallOutcome) => void;
  endInnings: () => void;
  finishMatch: () => void;
  resetScoring: () => void;

  // Notifications
  markAllRead: () => void;
}

export type BallOutcome =
  | { kind: "runs"; runs: 0 | 1 | 2 | 3 | 4 | 5 | 6 }
  | { kind: "wide" }
  | { kind: "noball" }
  | { kind: "bye"; runs: number }
  | { kind: "legbye"; runs: number }
  | { kind: "wicket" }
  | { kind: "dead" }
  | { kind: "undo" };

const initialFeed: FeedItem[] = [
  {
    id: "f1",
    type: "match",
    title: "Chennai Chargers beat Mumbai Mavericks",
    body: "Won by 24 runs in a thrilling chase at Wankhede.",
    time: "2h ago",
    meta: "Summer Smash",
  },
  {
    id: "f2",
    type: "milestone",
    title: "Virat Kohli hits 50th T20 fifty",
    body: "Anchored the innings with a sublime 67(41).",
    time: "5h ago",
    meta: "Career milestone",
  },
  {
    id: "f3",
    type: "achievement",
    title: "Jasprit Bumrah — Purple Cap",
    body: "18 wickets in 10 matches at 6.12 economy.",
    time: "Yesterday",
    meta: "Premier Cup",
  },
  {
    id: "f4",
    type: "news",
    title: "Independence Cup fixtures announced",
    body: "8 teams, 28 matches across 12 venues.",
    time: "2d ago",
    meta: "Upcoming",
  },
  {
    id: "f5",
    type: "match",
    title: "Bangalore Blitz seal playoff spot",
    body: "5-wicket win over Delhi Dynamos to make it 7 wins.",
    time: "3d ago",
    meta: "Metro Masters",
  },
];

const initialNotifs: Notification[] = [
  {
    id: "n1",
    title: "Match reminder",
    body: "Bangalore vs Delhi starts in 1 hour.",
    time: "30m ago",
    read: false,
    icon: "calendar",
  },
  {
    id: "n2",
    title: "Certificate ready",
    body: "Your Champion certificate is available.",
    time: "2h ago",
    read: false,
    icon: "award",
  },
  {
    id: "n3",
    title: "New player joined",
    body: "Aryan Singh joined Mumbai Mavericks.",
    time: "5h ago",
    read: true,
    icon: "user",
  },
  {
    id: "n4",
    title: "Tournament invite",
    body: "You've been invited to Winter Clash 2026.",
    time: "1d ago",
    read: true,
    icon: "trophy",
  },
];

const emptyScoring: ScoringState = {
  matchId: null,
  runs: 0,
  wickets: 0,
  ballsInOver: 0,
  totalBalls: 0,
  inningsIndex: 0,
  ballLog: [],
  finished: false,
};

function code() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      onboarded: false,
      tournaments: DB.tournaments,
      teams: DB.teams,
      matches: DB.matches,
      certificates: DB.certificates,
      notifications: initialNotifs,
      feed: initialFeed,
      scoring: emptyScoring,

      // Modal States
      authModalOpen: false,
      createModalOpen: false,
      notificationsModalOpen: false,
      setAuthModalOpen: (open) => set({ authModalOpen: open }),
      setCreateModalOpen: (open) => set({ createModalOpen: open }),
      setNotificationsModalOpen: (open) => set({ notificationsModalOpen: open }),

      signInMockGoogle: () => {
        const captainPlayer = DB.players[0];
        set({
          user: {
            id: "u_self",
            name: "Aarav Sharma",
            email: "aarav.sharma@gmail.com",
            avatar: "AS",
            playerId: captainPlayer.id,
            teamId: captainPlayer.teamId,
          },
        });
      },
      signOut: async () => {
        set({ user: null });
        try {
          await logout();
        } catch (e) {
          console.error("Failed to sign out on server:", e);
        }
      },
      completeOnboarding: () => set({ onboarded: true }),
      setUser: (user) => set({ user }),

      createTournament: (data) => {
        const id = `tr_user_${Date.now()}`;
        const t: Tournament = {
          id,
          name: data.name || "My Tournament",
          code: code(),
          format: data.format || "T20",
          status: "upcoming",
          startDate: data.startDate || new Date().toISOString().slice(0, 10),
          endDate: data.endDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
          city: data.city || "Mumbai",
          venue: data.venue || "Local Ground",
          teamIds: [],
          prizePool: data.prizePool || "₹1 Lakh",
          description: data.description || "Community tournament",
          organizer: get().user?.name || "Organizer",
        };
        set((s) => ({ tournaments: [t, ...s.tournaments] }));
        return id;
      },

      createTeam: (data) => {
        const id = `t_user_${Date.now()}`;
        const team: Team = {
          id,
          name: data.name || "My Team",
          shortName: (data.name || "MYT").slice(0, 3).toUpperCase(),
          code: code(),
          color: "oklch(0.92 0.21 125)",
          captainId: get().user?.playerId || DB.players[0].id,
          city: data.city || "Mumbai",
          founded: new Date().getFullYear(),
          trophies: 0,
          matches: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          nrr: 0,
          playerIds: [],
        };
        set((s) => ({ teams: [team, ...s.teams] }));
        return id;
      },

      joinTournament: (joinCode) => {
        const t = get().tournaments.find((x) => x.code.toUpperCase() === joinCode.toUpperCase());
        if (t && get().user?.teamId && !t.teamIds.includes(get().user!.teamId!)) {
          set((s) => ({
            tournaments: s.tournaments.map((x) =>
              x.id === t.id ? { ...x, teamIds: [...x.teamIds, get().user!.teamId!] } : x,
            ),
          }));
        }
        return t;
      },

      joinTeam: (joinCode) => {
        const team = get().teams.find((x) => x.code.toUpperCase() === joinCode.toUpperCase());
        if (team && get().user?.playerId && !team.playerIds.includes(get().user!.playerId!)) {
          set((s) => ({
            teams: s.teams.map((x) =>
              x.id === team.id ? { ...x, playerIds: [...x.playerIds, get().user!.playerId!] } : x,
            ),
            user: s.user ? { ...s.user, teamId: team.id } : s.user,
          }));
        }
        return team;
      },

      createMatch: ({ tournamentId, teamAId, teamBId, overs, venue }) => {
        const id = `m_user_${Date.now()}`;
        const m: Match = {
          id,
          tournamentId,
          teamAId,
          teamBId,
          status: "upcoming",
          date: new Date().toISOString().slice(0, 10),
          venue,
          overs,
          innings: [],
          commentary: [],
          resultText: "Match yet to begin",
        };
        set((s) => ({ matches: [m, ...s.matches] }));
        return id;
      },

      setToss: (matchId, winnerId, decision) => {
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId
              ? { ...m, tossWinnerId: winnerId, tossDecision: decision, status: "live" as const }
              : m,
          ),
        }));
      },

      startScoring: (matchId, striker, nonStriker, bowler) => {
        const m = get().matches.find((x) => x.id === matchId);
        if (!m) return;
        const battingTeamId =
          m.tossWinnerId && m.tossDecision === "bat"
            ? m.tossWinnerId
            : m.tossWinnerId === m.teamAId
              ? m.teamBId
              : m.teamAId;
        const bowlingTeamId = battingTeamId === m.teamAId ? m.teamBId : m.teamAId;
        set({
          scoring: {
            ...emptyScoring,
            matchId,
            strikerId: striker,
            nonStrikerId: nonStriker,
            bowlerId: bowler,
            battingTeamId,
            bowlingTeamId,
          },
        });
      },

      applyBall: (outcome) => {
        const s = get().scoring;
        if (!s.matchId || s.finished) return;
        const log = [...s.ballLog];
        let runs = s.runs,
          wickets = s.wickets,
          balls = s.ballsInOver,
          total = s.totalBalls;
        const overStr = `${Math.floor(total / 6)}.${(total % 6) + 1}`;
        const append = (outcomeStr: string, r: number, countBall = true) => {
          log.push({ over: overStr, outcome: outcomeStr, runs: r });
          runs += r;
          if (countBall) {
            balls += 1;
            total += 1;
            if (balls === 6) balls = 0;
          }
        };
        switch (outcome.kind) {
          case "runs":
            append(`${outcome.runs}`, outcome.runs);
            break;
          case "wide":
            append("Wd", 1, false);
            break;
          case "noball":
            append("Nb", 1, false);
            break;
          case "bye":
            append(`${outcome.runs}b`, outcome.runs);
            break;
          case "legbye":
            append(`${outcome.runs}lb`, outcome.runs);
            break;
          case "wicket":
            wickets += 1;
            append("W", 0);
            break;
          case "dead":
            append("Dead", 0, false);
            break;
          case "undo":
            if (log.length) {
              const last = log.pop()!;
              runs = Math.max(0, runs - last.runs);
              if (last.outcome === "W") wickets = Math.max(0, wickets - 1);
              if (!["Wd", "Nb", "Dead"].includes(last.outcome)) {
                total = Math.max(0, total - 1);
                balls = total % 6;
              }
            }
            break;
        }
        set({
          scoring: {
            ...s,
            runs,
            wickets,
            ballsInOver: balls,
            totalBalls: total,
            ballLog: log,
          },
        });
      },

      endInnings: () => {
        const s = get().scoring;
        set({
          scoring: {
            ...s,
            inningsIndex: 1,
            target: s.runs + 1,
            runs: 0,
            wickets: 0,
            ballsInOver: 0,
            totalBalls: 0,
            ballLog: [],
            battingTeamId: s.bowlingTeamId,
            bowlingTeamId: s.battingTeamId,
          },
        });
      },

      finishMatch: () => {
        const s = get().scoring;
        if (!s.matchId) return;
        set((state) => ({
          scoring: { ...s, finished: true },
          matches: state.matches.map((m) =>
            m.id === s.matchId
              ? {
                  ...m,
                  status: "completed" as const,
                  winnerId: s.target && s.runs >= s.target ? s.battingTeamId : s.bowlingTeamId,
                  resultText:
                    s.target && s.runs >= s.target
                      ? `Chase complete — won by ${10 - s.wickets} wickets`
                      : `Defended — won by ${(s.target ?? s.runs) - s.runs - 1} runs`,
                }
              : m,
          ),
        }));
      },

      resetScoring: () => set({ scoring: emptyScoring }),

      markAllRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
    }),
    {
      name: "stadium-night-app",
      partialize: (s) => ({
        user: s.user,
        onboarded: s.onboarded,
        tournaments: s.tournaments,
        teams: s.teams,
        matches: s.matches,
        certificates: s.certificates,
        notifications: s.notifications,
      }),
    },
  ),
);
