import { create } from "zustand";
import { persist } from "zustand/middleware";
import { logout, signInDev } from "./auth";
import {
  createTournament as createTournamentApi,
  createTeamForTournament as createTeamApi,
  joinTournamentByCode as joinTournamentApi,
  joinTeamByCode as joinTeamApi,
  createMatch as createMatchApi,
  setToss as setTossApi,
  saveScoring,
  resetScoringDb,
} from "./api";
import { toast } from "sonner";
import { clearQueryCache } from "../hooks/useApi";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  picture?: string | null;
  playerId?: string;
  teamId?: string;
  playerCode?: string;
  onboardedProfile?: boolean;
  role?: "admin" | "user" | string;
  verified?: boolean;
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

export interface ScoringState {
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
  ballLog: Array<{ 
    over: string; 
    outcome: string; 
    runs: number;
    strikerId?: string;
    nonStrikerId?: string;
    bowlerId?: string;
    dismissedBatterId?: string;
    dismissalType?: string;
    fielderId?: string;
  }>;
  finished: boolean;
  dismissedPlayerIds?: string[];
  needsNewBowler?: boolean;
  previousBowlerId?: string;
}

interface AppState {
  user: CurrentUser | null;
  onboarded: boolean;
  scoring: ScoringState;

  // Modal States
  authModalOpen: boolean;
  createModalOpen: boolean;
  notificationsModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  setCreateModalOpen: (open: boolean) => void;
  setNotificationsModalOpen: (open: boolean) => void;

  // Auth
  signInMockGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => void;
  setUser: (user: CurrentUser | null) => void;

  // Mutations (Database backed)
  createTournament: (data: { name: string; format?: string; startDate?: string; endDate?: string; city?: string; venue?: string; prizePool?: string; description?: string; detailed?: boolean }) => Promise<string>;
  createTeam: (data: { name: string; city?: string; tournamentId: string }) => Promise<string>;
  joinTournament: (code: string) => Promise<any>;
  joinTeam: (code: string) => Promise<any>;
  createMatch: (data: {
    tournamentId: string;
    teamAId: string;
    teamBId: string;
    overs: number;
    venue: string;
    umpireIds?: string[];
    nodeId?: string;
  }) => Promise<string>;
  setToss: (matchId: string, winnerId: string, decision: "bat" | "bowl") => Promise<void>;

  // Scoring (DB-Synchronized)
  setScoringState: (scoring: ScoringState) => void;
  startScoring: (
    matchId: string,
    striker: string,
    nonStriker: string,
    bowler: string,
    battingTeamId: string,
    bowlingTeamId: string,
  ) => Promise<void>;
  setInningsLineup: (
    striker: string,
    nonStriker: string,
    bowler: string,
  ) => Promise<void>;
  applyBall: (outcome: BallOutcome) => Promise<void>;
  editBall: (index: number, outcomeStr: string, newRuns: number, dismissedId?: string) => Promise<void>;
  endInnings: () => Promise<void>;
  finishMatch: () => Promise<void>;
  resetScoring: () => Promise<void>;
}

export type BallOutcome =
  | { kind: "runs"; runs: number }
  | { kind: "wide"; runs?: number }
  | { kind: "noball"; runs?: number }
  | { kind: "bye"; runs: number }
  | { kind: "legbye"; runs: number }
  | {
      kind: "wicket";
      dismissalType: "bowled" | "caught" | "lbw" | "stumped" | "runout" | "retired" | "timedout";
      dismissedBatterId: string;
      fielderId?: string;
      newBatterId: string;
      runs?: number;
      isNoBall?: boolean;
    }
  | { kind: "dead" }
  | { kind: "undo" }
  | { kind: "swap_strike" }
  | { kind: "set_bowler"; bowlerId: string }
  | { kind: "rare"; type: string; runs?: number; dismissedBatterId?: string; newBatterId?: string };

const emptyScoring: ScoringState = {
  matchId: null,
  runs: 0,
  wickets: 0,
  ballsInOver: 0,
  totalBalls: 0,
  inningsIndex: 0,
  ballLog: [],
  finished: false,
  dismissedPlayerIds: [],
  needsNewBowler: false,
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      onboarded: false,
      scoring: emptyScoring,

      // Modal States
      authModalOpen: false,
      createModalOpen: false,
      notificationsModalOpen: false,
      setAuthModalOpen: (open) => set({ authModalOpen: open }),
      setCreateModalOpen: (open) => set({ createModalOpen: open }),
      setNotificationsModalOpen: (open) => set({ notificationsModalOpen: open }),

      signInMockGoogle: async () => {
        try {
          const user = await signInDev();
          if (user && user.token) {
            localStorage.setItem("sn_token", user.token);
          }
          set({ user });
          toast.success(`Dev Login Bypass: Signed in as ${user.name}`);
        } catch (e) {
          console.error("Dev login bypass failed:", e);
          toast.error("Dev sign in failed.");
        }
      },
      signOut: async () => {
        localStorage.removeItem("sn_token");
        clearQueryCache();
        set({ user: null });
        try {
          await logout();
        } catch (e) {
          console.error("Failed to sign out on server:", e);
        }
      },
      completeOnboarding: () => set({ onboarded: true }),
      setUser: (user) => set({ user }),

      createTournament: async (data) => {
        const id = await createTournamentApi({ data });
        return id;
      },

      createTeam: async (data) => {
        const id = await createTeamApi({ data });
        // Update user state teamId dynamically
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, teamId: id } });
        }
        return id;
      },

      joinTournament: async (joinCode) => {
        const t = await joinTournamentApi({ data: joinCode });
        return t;
      },

      joinTeam: async (joinCode) => {
        const team = await joinTeamApi({ data: joinCode });
        const currentUser = get().user;
        if (currentUser && team) {
          set({ user: { ...currentUser, teamId: team.id } });
        }
        return team;
      },

      createMatch: async ({ tournamentId, teamAId, teamBId, overs, venue, umpireIds, nodeId }) => {
        const id = await createMatchApi({
          data: { tournamentId, teamAId, teamBId, overs, venue, umpireIds, nodeId },
        });
        return id;
      },

      setToss: async (matchId, winnerId, decision) => {
        await setTossApi({ data: { matchId, winnerId, decision } });
      },

      setScoringState: (scoring) => set({ scoring }),

      startScoring: async (matchId, striker, nonStriker, bowler, battingTeamId, bowlingTeamId) => {
        const currentScoring: ScoringState = {
          ...emptyScoring,
          matchId,
          strikerId: striker,
          nonStrikerId: nonStriker,
          bowlerId: bowler,
          battingTeamId,
          bowlingTeamId,
          dismissedPlayerIds: [],
          needsNewBowler: false,
        };

        set({ scoring: currentScoring });
        await saveScoring({ data: currentScoring });
      },

      setInningsLineup: async (striker, nonStriker, bowler) => {
        const s = get().scoring;
        const updatedScoring: ScoringState = {
          ...s,
          strikerId: striker,
          nonStrikerId: nonStriker,
          bowlerId: bowler,
          needsNewBowler: false,
        };
        set({ scoring: updatedScoring });
        await saveScoring({ data: updatedScoring });
      },

      applyBall: async (outcome) => {
        const s = get().scoring;
        if (!s.matchId || s.finished) return;
        const log = [...s.ballLog];
        let runs = s.runs,
          wickets = s.wickets,
          balls = s.ballsInOver,
          total = s.totalBalls;

        let strikerId = s.strikerId;
        let nonStrikerId = s.nonStrikerId;
        let bowlerId = s.bowlerId;
        let dismissedPlayerIds = s.dismissedPlayerIds ? [...s.dismissedPlayerIds] : [];
        let needsNewBowler = s.needsNewBowler || false;
        let previousBowlerId = s.previousBowlerId;

        const rotateStrike = () => {
          const temp = strikerId;
          strikerId = nonStrikerId;
          nonStrikerId = temp;
        };

        const overStr = `${Math.floor(total / 6)}.${(total % 6) + 1}`;
        const append = (
          outcomeStr: string,
          r: number,
          countBall = true,
          dismissedId?: string,
          dismissalType?: string,
          fielderId?: string
        ) => {
          log.push({
            over: overStr,
            outcome: outcomeStr,
            runs: r,
            strikerId: s.strikerId,
            nonStrikerId: s.nonStrikerId,
            bowlerId: s.bowlerId,
            dismissedBatterId: dismissedId,
            dismissalType,
            fielderId,
          });
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
            if (outcome.runs % 2 === 1) {
              rotateStrike();
            }
            break;
          case "wide": {
            const wRuns = outcome.runs !== undefined ? outcome.runs : 1;
            const runsTaken = wRuns - 1;
            const suffix = runsTaken > 0 ? `+${runsTaken}` : "";
            append(`Wd${suffix}`, wRuns, false);
            if (runsTaken % 2 === 1) {
              rotateStrike();
            }
            break;
          }
          case "noball": {
            const nbRuns = outcome.runs !== undefined ? outcome.runs : 1;
            const runsTaken = nbRuns - 1;
            const suffix = runsTaken > 0 ? `+${runsTaken}` : "";
            append(`Nb${suffix}`, nbRuns, false);
            if (runsTaken % 2 === 1) {
              rotateStrike();
            }
            break;
          }
          case "bye":
            append(`B${outcome.runs}`, outcome.runs);
            if (outcome.runs % 2 === 1) {
              rotateStrike();
            }
            break;
          case "legbye":
            append(`LB${outcome.runs}`, outcome.runs);
            if (outcome.runs % 2 === 1) {
              rotateStrike();
            }
            break;
          case "wicket": {
            const wktRuns = outcome.runs || 0;
            const isNoBall = !!outcome.isNoBall;
            wickets += 1;
            dismissedPlayerIds.push(outcome.dismissedBatterId);
            
            let label = "W";
            if (isNoBall) {
              label = wktRuns > 0 ? `NB+W+${wktRuns}` : "NB+W";
            } else {
              label = wktRuns > 0 ? `W+${wktRuns}` : "W";
            }

            append(
              label,
              wktRuns + (isNoBall ? 1 : 0),
              !isNoBall,
              outcome.dismissedBatterId,
              outcome.dismissalType,
              outcome.fielderId
            );

            if (strikerId === outcome.dismissedBatterId) {
              strikerId = outcome.newBatterId;
            } else if (nonStrikerId === outcome.dismissedBatterId) {
              nonStrikerId = outcome.newBatterId;
            }
            if (wktRuns % 2 === 1) {
              rotateStrike();
            }
            break;
          }
          case "dead":
            append("Dead", 0, false);
            break;
          case "swap_strike":
            rotateStrike();
            break;
          case "set_bowler":
            bowlerId = outcome.bowlerId;
            needsNewBowler = false;
            balls = 0;
            break;
          case "undo":
            if (log.length) {
              const last = log.pop()!;
              runs = Math.max(0, runs - last.runs);
              if (last.dismissedBatterId) {
                wickets = Math.max(0, wickets - 1);
                dismissedPlayerIds = dismissedPlayerIds.filter((id) => id !== last.dismissedBatterId);
              } else if (last.outcome === "W") {
                wickets = Math.max(0, wickets - 1);
              }
              strikerId = last.strikerId;
              nonStrikerId = last.nonStrikerId;
              bowlerId = last.bowlerId;
              needsNewBowler = false;
              if (last.outcome !== "Wd" && last.outcome !== "Nb" && last.outcome !== "Dead") {
                total = Math.max(0, total - 1);
                balls = total % 6;
              }
            }
            break;
          case "rare": {
            const label = outcome.type;
            const rRuns = outcome.runs || 0;
            if (label === "5 Penalty Runs") {
              append("5Pen", 5, false);
            } else if (label === "Dead Ball") {
              append("Dead", 0, false);
            } else if (label === "Retired Hurt") {
              append("RetHurt", 0, false, outcome.dismissedBatterId);
              if (outcome.dismissedBatterId && outcome.newBatterId) {
                if (strikerId === outcome.dismissedBatterId) {
                  strikerId = outcome.newBatterId;
                } else if (nonStrikerId === outcome.dismissedBatterId) {
                  nonStrikerId = outcome.newBatterId;
                }
              }
            } else if (label === "Retired Out") {
              wickets += 1;
              if (outcome.dismissedBatterId) {
                dismissedPlayerIds.push(outcome.dismissedBatterId);
              }
              append("RetOut", 0, true, outcome.dismissedBatterId, "retired");
              if (outcome.dismissedBatterId && outcome.newBatterId) {
                if (strikerId === outcome.dismissedBatterId) {
                  strikerId = outcome.newBatterId;
                } else if (nonStrikerId === outcome.dismissedBatterId) {
                  nonStrikerId = outcome.newBatterId;
                }
              }
            } else if (label === "Timed Out") {
              wickets += 1;
              if (outcome.dismissedBatterId) {
                dismissedPlayerIds.push(outcome.dismissedBatterId);
              }
              append("TimedOut", 0, false, outcome.dismissedBatterId, "timedout");
              if (outcome.dismissedBatterId && outcome.newBatterId) {
                if (strikerId === outcome.dismissedBatterId) {
                  strikerId = outcome.newBatterId;
                } else if (nonStrikerId === outcome.dismissedBatterId) {
                  nonStrikerId = outcome.newBatterId;
                }
              }
            } else if (label === "5 Runs") {
              append("5", 5, true);
              rotateStrike();
            }
            break;
          }
        }

        // Auto-check for end of over (6 legal balls completed)
        if (
          outcome.kind !== "undo" &&
          outcome.kind !== "set_bowler" &&
          outcome.kind !== "swap_strike" &&
          total > 0 &&
          total % 6 === 0 &&
          balls === 0
        ) {
          rotateStrike();
          needsNewBowler = true;
          previousBowlerId = bowlerId;
        }

        const updatedScoring: ScoringState = {
          ...s,
          runs,
          wickets,
          ballsInOver: balls,
          totalBalls: total,
          ballLog: log,
          strikerId,
          nonStrikerId,
          bowlerId,
          dismissedPlayerIds,
          needsNewBowler,
          previousBowlerId,
        };

        set({ scoring: updatedScoring });
        await saveScoring({ data: updatedScoring });
      },

      editBall: async (index: number, outcomeStr: string, newRuns: number, dismissedId?: string) => {
        const s = get().scoring;
        if (!s.matchId) return;
        const log = [...s.ballLog];
        if (index < 0 || index >= log.length) return;

        const oldBall = log[index];

        log[index] = {
          ...oldBall,
          outcome: outcomeStr,
          runs: newRuns,
          dismissedBatterId: dismissedId || undefined,
        };

        let runs = 0;
        let wickets = 0;
        const dismissedPlayerIds: string[] = [];
        let total = 0;
        let balls = 0;

        log.forEach((item) => {
          runs += item.runs;
          if (item.dismissedBatterId) {
            wickets += 1;
            dismissedPlayerIds.push(item.dismissedBatterId);
          } else if (item.outcome.includes("W") && !item.outcome.includes("Wd")) {
            wickets += 1;
          }

          const isExtra = item.outcome.startsWith("Wd") || item.outcome.startsWith("Nb") || item.outcome === "Dead";
          if (!isExtra) {
            balls += 1;
            total += 1;
            if (balls === 6) balls = 0;
          }
        });

        let needsNewBowler = false;
        let previousBowlerId = s.previousBowlerId;
        if (total > 0 && total % 6 === 0 && balls === 0 && log.length > 0) {
          needsNewBowler = true;
          previousBowlerId = log[log.length - 1].bowlerId || s.bowlerId;
        }

        const updatedScoring: ScoringState = {
          ...s,
          runs,
          wickets,
          ballsInOver: balls,
          totalBalls: total,
          ballLog: log,
          dismissedPlayerIds,
          needsNewBowler,
          previousBowlerId,
        };

        set({ scoring: updatedScoring });
        await saveScoring({ data: updatedScoring });
      },

      endInnings: async () => {
        const s = get().scoring;
        const updatedScoring: ScoringState = {
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
          strikerId: undefined,
          nonStrikerId: undefined,
          bowlerId: undefined,
          dismissedPlayerIds: [],
          needsNewBowler: false,
          previousBowlerId: undefined,
        };
        set({ scoring: updatedScoring });
        await saveScoring({ data: updatedScoring });
      },

      finishMatch: async () => {
        const s = get().scoring;
        if (!s.matchId) return;
        const updatedScoring: ScoringState = {
          ...s,
          finished: true,
        };
        set({ scoring: updatedScoring });
        await saveScoring({ data: updatedScoring });
      },

      resetScoring: async () => {
        const matchId = get().scoring.matchId;
        set({ scoring: emptyScoring });
        if (matchId) {
          await resetScoringDb({ data: matchId });
        }
      },
    }),
    {
      name: "crease-live-app-v2",
      partialize: (s) => ({
        user: s.user,
        onboarded: s.onboarded,
      }),
    },
  ),
);
