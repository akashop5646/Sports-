import { Link, useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getMatch, getTeam, getTeamPlayers, getTournament, deleteMatch, getScoring, getTournamentSquads } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { TossModal } from "@/components/TossModal";
import { useApp } from "@/lib/store";
import { CricketLoading, useLoadingState } from "@/components/CricketLoading";
import { toast } from "sonner";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [tossOpen, setTossOpen] = useState(false);
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [showEndGamePopup, setShowEndGamePopup] = useState(false);
  const [hasShownEndGame, setHasShownEndGame] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<{
    type: "four" | "six" | "noball" | "bowled" | "caught" | "lbw" | "stumped" | "runout" | "wicket";
    outcome: string;
  } | null>(null);

  const user = useApp((s) => s.user);

  const queryClient = useQueryClient();

  const cancelMatchMutation = useMutation({
    mutationFn: () => deleteMatch({ data: matchId }),
    onSuccess: () => {
      toast.success("Match cancelled and removed.");
      queryClient.invalidateQueries({ queryKey: ["tournament-matches", match?.tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["tournament", match?.tournamentId] });
      navigate(`/tournaments/${match?.tournamentId}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel match.");
    },
  });

  // Match Query
  const { data: match, isLoading: loadingMatch, error: matchError } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => getMatch({ data: matchId }),
    refetchInterval: 3000,
  });

  // Live Scoring Query
  const { data: scoring } = useQuery({
    queryKey: ["scoring", matchId],
    queryFn: () => getScoring({ data: matchId }),
    enabled: match?.status === "live",
    refetchInterval: 3000,
  });

  // Tournament Query
  const { data: tournament, isLoading: loadingTournament } = useQuery({
    queryKey: ["tournament", match?.tournamentId],
    queryFn: () => getTournament({ data: match?.tournamentId }),
    enabled: !!match,
  });

  // Tournament Squads Query
  const { data: squads = [] } = useQuery({
    queryKey: ["tournament-squads", match?.tournamentId],
    queryFn: () => getTournamentSquads({ data: match?.tournamentId }),
    enabled: !!match?.tournamentId,
  });

  // Team Queries (enabled when match is fetched)
  const { data: teamA, isLoading: loadingTeamA } = useQuery({
    queryKey: ["team", match?.teamAId],
    queryFn: () => getTeam({ data: match?.teamAId }),
    enabled: !!match,
  });

  const { data: teamB, isLoading: loadingTeamB } = useQuery({
    queryKey: ["team", match?.teamBId],
    queryFn: () => getTeam({ data: match?.teamBId }),
    enabled: !!match,
  });

  // Players Queries (for rosters of both teams)
  const { data: teamAPlayersRaw = [], isLoading: loadingPlayersA } = useQuery({
    queryKey: ["team-players", match?.teamAId],
    queryFn: () => getTeamPlayers({ data: match?.teamAId }),
    enabled: !!match,
  });

  const { data: teamBPlayersRaw = [], isLoading: loadingPlayersB } = useQuery({
    queryKey: ["team-players", match?.teamBId],
    queryFn: () => getTeamPlayers({ data: match?.teamBId }),
    enabled: !!match,
  });

  const getFirstName = (name?: string) => {
    if (!name) return "";
    return name.trim().split(/\s+/)[0];
  };

  const teamAPlayers = teamAPlayersRaw.map((p: any) => ({ ...p, name: getFirstName(p.name) }));
  const teamBPlayers = teamBPlayersRaw.map((p: any) => ({ ...p, name: getFirstName(p.name) }));

  const isPlayingPlayer = (() => {
    if (!user) return false;
    const userId = user.playerId || user.id;
    if (!userId) return false;
    const inTeamA = teamAPlayersRaw.some((p: any) => p.playerId === userId || p.id === userId);
    const inTeamB = teamBPlayersRaw.some((p: any) => p.playerId === userId || p.id === userId);
    return !!(inTeamA || inTeamB);
  })();

  const a = teamA || (match ? { id: match.teamAId, name: "Team A", shortName: "TMA", color: "#666" } : null);
  const b = teamB || (match ? { id: match.teamBId, name: "Team B", shortName: "TMB", color: "#666" } : null);

  useEffect(() => {
    if (match && a && b) {
      document.title = `${a.name} vs ${b.name} — CreaseLive`;
    } else {
      document.title = "Match Details — CreaseLive";
    }
  }, [match, a, b]);

  useEffect(() => {
    if (matchError) {
      toast.error("Match not found or has been deleted.");
      navigate("/home");
    }
  }, [matchError, navigate]);

  // Trigger end game popup when match completes
  useEffect(() => {
    if (match?.status === "completed" && !hasShownEndGame && isPlayingPlayer) {
      setShowEndGamePopup(true);
      setHasShownEndGame(true);
    }
  }, [match?.status, hasShownEndGame, isPlayingPlayer]);

  const lastProcessedBallCount = useRef<number>(-1);
  const lastProcessedInnings = useRef<number>(-1);

  useEffect(() => {
    // Show live-ball animations for all viewers (organizers, umpires, spectators)
    if (!scoring?.ballLog) return;

    if (lastProcessedInnings.current !== scoring.inningsIndex) {
      lastProcessedInnings.current = scoring.inningsIndex;
      lastProcessedBallCount.current = scoring.ballLog.length;
      return;
    }

    if (lastProcessedBallCount.current === -1) {
      lastProcessedBallCount.current = scoring.ballLog.length;
      return;
    }

    if (scoring.ballLog.length > lastProcessedBallCount.current) {
      const newBalls = scoring.ballLog.slice(lastProcessedBallCount.current);
      lastProcessedBallCount.current = scoring.ballLog.length;

      const latestBall = newBalls[newBalls.length - 1];
      if (latestBall) {
        const outcome = latestBall.outcome || "";
        const outcomeUpper = outcome.toUpperCase();
        if (outcomeUpper === "4") {
          setActiveAnimation({ type: "four", outcome });
        } else if (outcomeUpper === "6") {
          setActiveAnimation({ type: "six", outcome });
        } else if (outcomeUpper.includes("NB")) {
          setActiveAnimation({ type: "noball", outcome });
        } else if (outcomeUpper.includes("W") && !outcomeUpper.includes("WD")) {
          const type = latestBall.dismissalType || "wicket";
          const typeLower = type.toLowerCase();
          if (typeLower.includes("bowl")) {
            setActiveAnimation({ type: "bowled", outcome });
          } else if (typeLower.includes("catch") || typeLower.includes("caught")) {
            setActiveAnimation({ type: "caught", outcome });
          } else if (typeLower.includes("lbw")) {
            setActiveAnimation({ type: "lbw", outcome });
          } else if (typeLower.includes("stump")) {
            setActiveAnimation({ type: "stumped", outcome });
          } else if (typeLower.includes("run")) {
            setActiveAnimation({ type: "runout", outcome });
          } else {
            setActiveAnimation({ type: "wicket", outcome });
          }
        }
      }
    }
  }, [scoring?.ballLog, scoring?.inningsIndex]);

  useEffect(() => {
    if (activeAnimation) {
      const timer = setTimeout(() => {
        setActiveAnimation(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeAnimation]);

  const isLoading = useLoadingState(loadingMatch || loadingTeamA || loadingTeamB || loadingPlayersA || loadingPlayersB || loadingTournament);

  if (isLoading) {
    return (
      <AppShell title="Match">
        <CricketLoading />
      </AppShell>
    );
  }

  if (!match || !a || !b) {
    return (
      <AppShell title="Match Not Found">
        <div className="text-center py-24">
          <h2 className="font-display text-2xl text-destructive">Match Not Found</h2>
          <p className="text-muted-foreground text-sm mt-2">The match you are looking for does not exist.</p>
          <Link to="/matches" className="inline-block mt-4 text-primary hover:underline">Back to Matches</Link>
        </div>
      </AppShell>
    );
  }

  const matchPlayers = [...teamAPlayers, ...teamBPlayers];

  // Extract all tournament players (including captains and players)
  const allPlayers = squads.flatMap((s: any) => [
    ...(s.captain ? [s.captain] : []),
    ...(s.players || [])
  ]);
  const uniquePlayers = Array.from(new Map(allPlayers.map((p: any) => [p.id, p])).values());

  const findMatchPlayer = (pid?: string) => {
    if (!pid) return null;
    const found = matchPlayers.find((p: any) => p.id === pid);
    if (found) return found;
    const fromSquads = uniquePlayers.find((p: any) => p.id === pid);
    if (fromSquads) return fromSquads;
    return tournament?.umpires?.find((p: any) => p.id === pid) || null;
  };

  const getTeamName = (tid: string) => {
    if (tid === a.id) return a.name;
    if (tid === b.id) return b.name;
    return "Unknown Team";
  };

  const getTeamColor = (tid: string) => {
    if (tid === a.id) return a.color;
    if (tid === b.id) return b.color;
    return "#666";
  };

  const getTeamShort = (tid: string) => {
    if (tid === a.id) return a.shortName;
    if (tid === b.id) return b.shortName;
    return "UNK";
  };

  const currentBattingTeamId = scoring?.battingTeamId || (match?.tossDecision === "bat" ? match?.tossWinnerId : (match?.tossWinnerId === match?.teamAId ? match?.teamBId : match?.teamAId));
  const currentBowlingTeamId = currentBattingTeamId === a?.id ? b?.id : a?.id;
  
  const currentBattingTeam = currentBattingTeamId === a?.id ? a : b;
  const currentBowlingTeam = currentBowlingTeamId === a?.id ? a : b;

  const batters = currentBattingTeamId === a?.id ? teamAPlayers : teamBPlayers;
  const bowlers = currentBattingTeamId === a?.id ? teamBPlayers : teamAPlayers;

  const isExtraBall = (outcome: string) => {
    if (!outcome) return false;
    const o = outcome.toLowerCase();
    return o.startsWith("wd") || o.startsWith("nb") || o === "dead" || o === "dead ball" || o === "5pen" || o === "rethurt" || o === "timedout";
  };

  const getPartnership = () => {
    if (!scoring) return { runs: 0, balls: 0 };
    const log = scoring.ballLog || [];
    let runs = 0;
    let balls = 0;
    for (let i = log.length - 1; i >= 0; i--) {
      const item = log[i];
      const isWicket = item.outcome.includes("W") && !item.outcome.includes("Wd");
      const isRetiredOut = item.outcome === "RetOut" || item.outcome === "TimedOut";
      if (isWicket || isRetiredOut) {
        break;
      }
      runs += item.runs || 0;
      if (!isExtraBall(item.outcome)) {
        balls += 1;
      }
    }
    return { runs, balls };
  };

  const getLastWicketFull = () => {
    if (!scoring) return null;
    const log = scoring.ballLog || [];
    let wktIndex = -1;
    let legalCount = 0;
    let overNumStr = "0.0";
    
    for (let i = 0; i < log.length; i++) {
      const item = log[i];
      const isExtra = isExtraBall(item.outcome);
      if (!isExtra) {
        legalCount++;
      }
      if (item.dismissedBatterId) {
        wktIndex = i;
        overNumStr = `${Math.floor((legalCount - 1) / 6)}.${(legalCount - 1) % 6}`;
      }
    }

    if (wktIndex === -1) return null;

    const wktBall = log[wktIndex];
    const player = findMatchPlayer(wktBall.dismissedBatterId);
    
    let runsAtWkt = 0;
    let wicketsAtWkt = 0;
    for (let j = 0; j <= wktIndex; j++) {
      runsAtWkt += log[j].runs || 0;
      if (log[j].dismissedBatterId) {
        wicketsAtWkt++;
      } else if (log[j].outcome.includes("W") && !log[j].outcome.includes("Wd")) {
        wicketsAtWkt++;
      }
    }

    const activeInnings = match?.innings?.[scoring.inningsIndex];
    const batterStats = activeInnings?.batters?.find((bat: any) => bat.playerId === wktBall.dismissedBatterId) || { runs: 0, balls: 0 };

    return {
      name: player ? player.name : "Batter",
      runs: batterStats.runs,
      balls: batterStats.balls,
      type: wktBall.dismissalType || "Out",
      runsAtWicket: runsAtWkt,
      wicketsAtWicket: wicketsAtWkt,
      over: overNumStr
    };
  };

  const getWinProbability = () => {
    if (!scoring) return { batting: 50, bowling: 50 };
    if (!scoring.target) return { batting: 50, bowling: 50 };
    const runsNeeded = Math.max(0, scoring.target - scoring.runs);
    const ballsRemaining = Math.max(0, match.overs * 6 - scoring.totalBalls);
    const wicketsLeft = 10 - scoring.wickets;

    if (runsNeeded === 0) return { batting: 100, bowling: 0 };
    if (ballsRemaining === 0 && runsNeeded > 0) return { batting: 0, bowling: 100 };
    if (wicketsLeft === 0) return { batting: 0, bowling: 100 };

    let prob = 50;
    const rrr = (runsNeeded / ballsRemaining) * 6;
    const crr = scoring.totalBalls > 0 ? (scoring.runs / scoring.totalBalls) * 6 : 6;
    
    prob -= (rrr - 6) * 8;
    prob += (wicketsLeft - 5) * 5;
    prob += (crr - rrr) * 4;

    prob = Math.max(1, Math.min(99, Math.round(prob)));
    return { batting: prob, bowling: 100 - prob };
  };

  const getMatchSituation = () => {
    if (!scoring) return null;
    if (!scoring.target) return null;
    const runsNeeded = Math.max(0, scoring.target - scoring.runs);
    const ballsRemaining = Math.max(0, match.overs * 6 - scoring.totalBalls);
    const wicketsLeft = 10 - scoring.wickets;

    if (runsNeeded === 0) return { text: "Chasing Team Wins! 🏆", stars: 5, variant: "victory" };
    if (wicketsLeft === 0 || (ballsRemaining === 0 && runsNeeded > 0)) return { text: "Defending Team Wins! 🏆", stars: 5, variant: "victory" };
    if (runsNeeded === 1 && ballsRemaining > 0) return { text: "Scores Level - Need 1 run!", stars: 5, variant: "level" };
    if (runsNeeded <= 5 && ballsRemaining >= 12) return { text: "Almost Won - Comfortably placed", stars: 5, variant: "comfortable" };

    const rrr = (runsNeeded / ballsRemaining) * 6;
    if (rrr <= 6) {
      return { text: `Comfortable: Need ${runsNeeded} from ${ballsRemaining} Balls`, stars: 5, variant: "comfortable" };
    } else if (rrr <= 9) {
      return { text: `Balanced: Need ${runsNeeded} from ${ballsRemaining} Balls`, stars: 3, variant: "balanced" };
    } else {
      return { text: `Pressure: Need ${runsNeeded} from ${ballsRemaining} Balls`, stars: 1, variant: "pressure" };
    }
  };

  const getProjectedScore = () => {
    if (!scoring) return { min: "—", expected: "—", max: "—", minRpo: 5, maxRpo: 8 };
    if (scoring.totalBalls < 6) return { min: "—", expected: "—", max: "—", minRpo: 5, maxRpo: 8 };
    const crr = (scoring.runs / scoring.totalBalls) * 6;
    const remainingBalls = Math.max(0, match.overs * 6 - scoring.totalBalls);
    const remainingOvers = remainingBalls / 6;

    const minRpo = Math.max(2.0, Number((crr - 2.0).toFixed(1)));
    const maxRpo = Number((crr + 2.0).toFixed(1));

    const minProj = Math.round(scoring.runs + (minRpo * remainingOvers));
    const expProj = Math.round(scoring.runs + (crr * remainingOvers));
    const maxProj = Math.round(scoring.runs + (maxRpo * remainingOvers));

    return { min: minProj, expected: expProj, max: maxProj, minRpo, maxRpo };
  };

  const getHistoricalOvers = (ballLog: any[]) => {
    if (!ballLog || ballLog.length === 0) return [];
    const overs: { bowlerId: string; runs: number; balls: any[]; overNum: number }[] = [];
    let currentOver: any[] = [];
    let overRuns = 0;
    let overNumber = 1;

    ballLog.forEach((ball) => {
      currentOver.push(ball);
      overRuns += ball.runs || 0;

      if (!isExtraBall(ball.outcome)) {
        const legalCount = currentOver.filter(b => !isExtraBall(b.outcome)).length;
        if (legalCount === 6) {
          overs.push({
            bowlerId: ball.bowlerId,
            runs: overRuns,
            balls: currentOver,
            overNum: overNumber++,
          });
          currentOver = [];
          overRuns = 0;
        }
      }
    });

    if (currentOver.length > 0) {
      overs.push({
        bowlerId: currentOver[0].bowlerId,
        runs: overRuns,
        balls: currentOver,
        overNum: overNumber,
      });
    }

    return overs;
  };

  const getCurrentOverBalls = (ballLog: any[], ballsInOver: number, needsNewBowler: boolean) => {
    if (!ballLog || ballLog.length === 0) return [];
    const targetLegalBalls = needsNewBowler ? 6 : ballsInOver;
    if (targetLegalBalls === 0) return [];

    const currentOver: { ball: any; absIndex: number }[] = [];
    let legalCount = 0;

    for (let i = ballLog.length - 1; i >= 0; i--) {
      const ball = ballLog[i];
      currentOver.unshift({ ball, absIndex: i });

      if (!isExtraBall(ball.outcome)) {
        legalCount++;
      }

      if (legalCount === targetLegalBalls) {
        break;
      }
    }
    return currentOver;
  };

  const getBallBadgeClass = (outcome: string) => {
    if (!outcome) return "glass-card border border-border/40 text-xs";
    const o = outcome.toUpperCase();
    if (o.includes("W") && !o.includes("WD")) {
      return "bg-destructive text-destructive-foreground font-bold shadow-glow";
    }
    if (o.includes("6")) {
      return "gradient-lime text-primary-foreground font-bold shadow-[0_0_10px_rgba(195,244,0,0.2)]";
    }
    if (o.includes("4")) {
      return "bg-accent text-accent-foreground font-bold shadow-[0_0_10px_rgba(0,209,255,0.1)]";
    }
    return "glass-card border border-border/40 text-xs text-foreground/80 font-medium";
  };

  return (
    <AppShell title="Match">
      <div className="glass-card border border-border/40 rounded-2xl p-5 shadow-card">
        <div className="text-xs text-muted-foreground">
          {match.venue} · {match.date}
        </div>
        {match.innings && match.innings.map((inn: any, i: number) => {
          const tColor = getTeamColor(inn.battingTeamId);
          const tShort = getTeamShort(inn.battingTeamId);
          return (
            <div key={i} className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg grid place-items-center font-display font-bold text-sm"
                  style={{ backgroundColor: tColor || "oklch(0.85 0.18 75)", color: "#0A1628" }}
                >
                  {tShort.slice(0, 2)}
                </div>
                <div>
                  <div className="font-display text-lg">{getTeamName(inn.battingTeamId)}</div>
                  <div className="text-xs text-muted-foreground">Innings {i + 1}</div>
                </div>
              </div>
              <div className="font-display text-3xl">
                {inn.runs}/{inn.wickets}
                <span className="text-sm text-muted-foreground ml-2">({inn.overs})</span>
              </div>
            </div>
          );
        })}
        {(!match.innings || match.innings.length === 0) && (
          <div className="flex items-center justify-between mt-3">
            <div className="font-display text-2xl">
              {a.name} vs {b.name}
            </div>
            <span className="text-xs text-accent uppercase font-bold tracking-wider">Upcoming</span>
          </div>
        )}
        <div className="text-sm text-primary mt-3 font-medium">{match.resultText}</div>
        {match.motmId && (
          <div className="text-xs text-muted-foreground mt-1">
            Player of the Match: {findMatchPlayer(match.motmId)?.name || "N/A"}
          </div>
        )}

        {match.umpireIds && match.umpireIds.length > 0 && (
          <div className="text-xs text-muted-foreground mt-2 border-t border-border/10 pt-2 flex items-center justify-between">
            <span>Umpire(s):</span>
            <span className="font-semibold text-primary">
              {match.umpireIds.map((uid: string) => findMatchPlayer(uid)?.name).filter(Boolean).join(", ") || "Assigned"}
            </span>
          </div>
        )}

        {match.status === "live" && scoring && (() => {
          const oversStr = `${Math.floor(scoring.totalBalls / 6)}.${scoring.totalBalls % 6}`;
          const rr = scoring.totalBalls > 0 ? ((scoring.runs / scoring.totalBalls) * 6).toFixed(2) : "0.00";
          const activeInnings = match?.innings?.[scoring.inningsIndex];
          
          const strikerStats = activeInnings?.batters?.find((b: any) => b.playerId === scoring.strikerId) || {
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
          };
          const nonStrikerStats = activeInnings?.batters?.find((b: any) => b.playerId === scoring.nonStrikerId) || {
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
          };
          const activeBowlerStats = activeInnings?.bowlers?.find((b: any) => b.playerId === scoring.bowlerId) || {
            overs: "0.0",
            runs: 0,
            wickets: 0,
            maidens: 0,
          };

          const strikerSR = strikerStats.balls > 0 ? ((strikerStats.runs / strikerStats.balls) * 100).toFixed(2) : "0.00";
          const nonStrikerSR = nonStrikerStats.balls > 0 ? ((nonStrikerStats.runs / nonStrikerStats.balls) * 100).toFixed(2) : "0.00";
          const partnership = getPartnership();
          const lastWktDetails = getLastWicketFull();
          const currentOverBalls = getCurrentOverBalls(scoring.ballLog || [], scoring.ballsInOver, !!scoring.needsNewBowler);
          const currentOverRuns = currentOverBalls.reduce((sum, item) => sum + (item.ball.runs || 0), 0);

          const getBowlerEconomy = (bStats: any) => {
            const oversParts = String(bStats.overs || "0.0").split(".");
            const oversInt = parseInt(oversParts[0], 10) || 0;
            const ballsInt = parseInt(oversParts[1], 10) || 0;
            const totalBalls = (oversInt * 6) + ballsInt;
            if (totalBalls === 0) return "0.00";
            return ((bStats.runs / totalBalls) * 6).toFixed(2);
          };

          return (
            <div className="mt-4 border-t border-border/10 pt-4 space-y-4 animate-fade-up">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-[10px] uppercase tracking-widest text-destructive font-bold">
                  LIVE SCOREBOARD
                </span>
              </div>

              {/* Innings 1 vs Innings 2 Main Headers */}
              {scoring.inningsIndex === 0 ? (
                <div className="space-y-4">
                  <div className="glass-card border border-border/40 rounded-2xl p-4 shadow-card text-center neon-glow-primary">
                    <div className="text-[10px] uppercase tracking-widest text-destructive font-bold flex items-center justify-center gap-1.5">
                      🔴 LIVE • INNINGS 1
                    </div>
                    <div className="font-display text-4xl mt-1.5 font-black tracking-tight">
                      {scoring.runs}
                      <span className="text-xl text-muted-foreground font-normal">/{scoring.wickets}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 font-semibold flex justify-center gap-3">
                      <span>{oversStr} Overs</span>
                      <span>•</span>
                      <span>CRR {rr}</span>
                    </div>
                  </div>

                  {/* Projected Score Panel */}
                  {(() => {
                    const proj = getProjectedScore();
                    return (
                      <div className="glass-card border border-border/40 rounded-2xl p-3">
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Projected Score</div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-[#11223b]/30 rounded-xl p-1.5 border border-border/10">
                            <div className="text-[9px] text-muted-foreground font-semibold">MIN ({proj.minRpo} RPO)</div>
                            <div className="text-sm font-black font-display text-muted-foreground">{proj.min}</div>
                          </div>
                          <div className="bg-[#11223b]/50 rounded-xl p-2 border border-primary/20 shadow-glow-sm">
                            <div className="text-[9px] text-primary font-bold">EXPECTED</div>
                            <div className="text-base font-black font-display text-primary">{proj.expected}</div>
                          </div>
                          <div className="bg-[#11223b]/30 rounded-xl p-1.5 border border-border/10">
                            <div className="text-[9px] text-muted-foreground font-semibold">MAX ({proj.maxRpo} RPO)</div>
                            <div className="text-sm font-black font-display text-foreground">{proj.max}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Innings 2 Chase Card */
                <div className="space-y-4">
                  {(() => {
                    const runsNeeded = Math.max(0, scoring.target - scoring.runs);
                    const ballsRemaining = Math.max(0, match.overs * 6 - scoring.totalBalls);
                    const rrr = ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : "0.00";
                    const winProb = getWinProbability();
                    const progressPct = Math.min(100, Math.round((scoring.runs / scoring.target) * 100));
                    const sit = getMatchSituation();

                    return (
                      <>
                        <div className="glass-card border border-border/40 rounded-2xl p-4 shadow-card text-center neon-glow-primary">
                          <div className="text-[10px] uppercase tracking-widest text-destructive font-bold flex items-center justify-center gap-1.5">
                            🔴 LIVE • INNINGS 2
                          </div>
                          <div className="font-display text-4xl mt-1.5 font-black tracking-tight">
                            {scoring.runs}
                            <span className="text-xl text-muted-foreground font-normal">/{scoring.wickets}</span>
                          </div>
                          <div className="text-[11px] text-primary font-bold mt-1 bg-primary/10 py-1 px-3 rounded-full inline-block border border-primary/20">
                            Target {scoring.target} · Need <span className="underline">{runsNeeded} runs</span> from <span className="underline">{ballsRemaining} balls</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1 font-semibold flex justify-center gap-3">
                            <span>CRR {rr}</span>
                            <span>•</span>
                            <span>RRR {rrr}</span>
                          </div>
                        </div>

                        {/* Chase Progress Bar */}
                        <div className="glass-card border border-border/40 rounded-2xl p-3">
                          <div className="flex justify-between items-center text-[10px] mb-1.5">
                            <span className="font-semibold text-muted-foreground">Chase Progress</span>
                            <span className="font-black text-primary">{scoring.runs} / {scoring.target} ({progressPct}%)</span>
                          </div>
                          <div className="w-full h-2 bg-[#11223b]/30 rounded-full overflow-hidden border border-border/10">
                            <div
                              className="h-full gradient-lime transition-all duration-300 rounded-full"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Match Situation Banner */}
                        {sit && (
                          <div className={`border rounded-2xl p-3 shadow-glow-sm ${
                            sit.variant === "victory" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                            sit.variant === "level" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                            sit.variant === "comfortable" ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" :
                            sit.variant === "balanced" ? "bg-sky-500/10 border-sky-500/30 text-sky-400" :
                            "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          }`}>
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Match Situation</div>
                                <div className="text-xs font-bold mt-0.5">{sit.text}</div>
                              </div>
                              <div className="flex gap-0.5 text-yellow-400 text-xs">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <span key={i}>{i < sit.stars ? "★" : "☆"}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Win Probability Panel */}
                        <div className="glass-card border border-border/40 rounded-2xl p-3">
                          <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mb-2 text-center">Win Probability</div>
                          <div className="flex justify-between text-[10px] font-bold mb-1">
                            <span className="text-primary">{currentBattingTeam?.shortName || "Batting"} {winProb.batting}%</span>
                            <span className="text-muted-foreground">{currentBowlingTeam?.shortName || "Bowling"} {winProb.bowling}%</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex border border-border/10">
                            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${winProb.batting}%` }} />
                            <div className="h-full bg-[#3b4b5e] transition-all duration-300" style={{ width: `${winProb.bowling}%` }} />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Current Players Panel */}
              <div className="grid grid-cols-2 gap-3">
                {/* Batters */}
                <div className="glass-card border border-border/40 rounded-xl p-3 space-y-2">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/10 pb-1 flex justify-between items-center">
                    <span>Batting</span>
                  </div>
                  
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-foreground text-xs truncate max-w-28">{findMatchPlayer(scoring.strikerId)?.name || "Striker"}*</span>
                        <span className="text-xs font-black font-display text-primary">{strikerStats.runs} <span className="text-[9px] text-muted-foreground font-normal">({strikerStats.balls})</span></span>
                      </div>
                      <div className="flex gap-1.5 text-[9px] text-muted-foreground mt-0.5 font-medium">
                        <span>4s: {strikerStats.fours}</span>
                        <span>•</span>
                        <span>6s: {strikerStats.sixes}</span>
                        <span>•</span>
                        <span>SR: {strikerSR}</span>
                      </div>
                    </div>
                    
                    <div className="border-t border-border/10 pt-2">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-foreground/80 text-xs truncate max-w-28">{findMatchPlayer(scoring.nonStrikerId)?.name || "Non-striker"}</span>
                        <span className="text-xs font-bold font-display text-foreground/90">{nonStrikerStats.runs} <span className="text-[9px] text-muted-foreground font-normal">({nonStrikerStats.balls})</span></span>
                      </div>
                      <div className="flex gap-1.5 text-[9px] text-muted-foreground mt-0.5 font-medium">
                        <span>4s: {nonStrikerStats.fours}</span>
                        <span>•</span>
                        <span>6s: {nonStrikerStats.sixes}</span>
                        <span>•</span>
                        <span>SR: {nonStrikerSR}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bowler */}
                <div className="glass-card border border-border/40 rounded-xl p-3 space-y-2">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/10 pb-1">
                    Bowling
                  </div>
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground text-xs truncate">{findMatchPlayer(scoring.bowlerId)?.name || "Bowler"}</div>
                    <div className="text-lg font-black font-display text-primary mt-0.5">
                      {activeBowlerStats.wickets} <span className="text-xs text-muted-foreground font-normal">Wickets</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 text-[9px] text-muted-foreground pt-1 font-medium">
                      <div>Overs: <span className="text-foreground font-semibold">{activeBowlerStats.overs || "0.0"}</span></div>
                      <div>Runs: <span className="text-foreground font-semibold">{activeBowlerStats.runs}</span></div>
                      <div>Maidens: <span className="text-foreground font-semibold">{activeBowlerStats.maidens || 0}</span></div>
                      <div>Econ: <span className="text-foreground font-semibold">{getBowlerEconomy(activeBowlerStats)}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Partnership & Last Wicket & Extras Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Partnership & Last Wicket */}
                <div className="glass-card border border-border/40 rounded-xl p-3 space-y-2.5 flex flex-col justify-between">
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Current Partnership</div>
                    <div className="text-xs font-bold text-foreground mt-0.5">
                      {partnership.runs} <span className="text-[9px] text-muted-foreground font-normal">Runs off {partnership.balls} balls</span>
                    </div>
                  </div>
                  {lastWktDetails && (
                    <div className="border-t border-border/10 pt-2">
                      <div className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Last Wicket</div>
                      <div className="text-[10px] font-semibold text-foreground mt-0.5 leading-tight">
                        {lastWktDetails.name} <span className="text-primary font-bold">{lastWktDetails.runs}</span> ({lastWktDetails.balls})
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                        {lastWktDetails.type} at {lastWktDetails.runsAtWicket}/{lastWktDetails.wicketsAtWicket} ({lastWktDetails.over} Ov)
                      </div>
                    </div>
                  )}
                </div>

                {/* Extras Breakdown */}
                {(() => {
                  const ext = activeInnings?.extras || { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 };
                  return (
                    <div className="glass-card border border-border/40 rounded-xl p-3">
                      <div className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/10 pb-1 flex justify-between items-center">
                        <span>Extras</span>
                        <span className="text-primary font-bold">{ext.total}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-1 gap-y-1 text-[9px] text-muted-foreground pt-2 font-medium">
                        <div>Wides: <span className="text-foreground font-bold">{ext.wides}</span></div>
                        <div>No Balls: <span className="text-foreground font-bold">{ext.noballs}</span></div>
                        <div>Byes: <span className="text-foreground font-bold">{ext.byes}</span></div>
                        <div>Leg Byes: <span className="text-foreground font-bold">{ext.legbyes}</span></div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* This Over Display */}
              <div className="glass-card border border-border/40 rounded-xl p-3">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5 flex justify-between items-center">
                  <span>This over</span>
                  <span className="font-semibold text-primary">{currentOverRuns} runs</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {currentOverBalls.map((item, i) => (
                    <div
                      key={i}
                      className={`h-7 w-7 rounded-full grid place-items-center font-display text-xs ${getBallBadgeClass(item.ball.outcome)}`}
                    >
                      {item.ball.outcome}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Overs Timeline */}
              {scoring.ballLog && scoring.ballLog.length > 0 && (
                <div className="border-t border-border/10 pt-3">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2 font-bold">Recent Overs</div>
                  <div className="space-y-1.5">
                    {getHistoricalOvers(scoring.ballLog).reverse().map((ov, idx) => (
                      <div key={idx} className="glass-card border border-border/20 rounded-lg p-2.5 flex justify-between items-center text-left text-[11px]">
                        <div>
                          <div className="text-[8px] font-bold text-muted-foreground">OVER {ov.overNum}</div>
                          <div className="font-medium text-foreground truncate max-w-28">
                            Bowled by: <span className="text-primary font-semibold">{findMatchPlayer(ov.bowlerId)?.name || "Unknown"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {ov.balls.map((b, bIdx) => (
                              <span
                                key={bIdx}
                                className={`h-5 w-5 rounded-full text-[8px] font-display font-semibold grid place-items-center ${getBallBadgeClass(b.outcome)}`}
                              >
                                {b.outcome}
                              </span>
                            ))}
                          </div>
                          <div className="text-[10px] font-bold text-right min-w-8 text-primary">
                            {ov.runs} runs
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {(() => {
          const isOrganizer = user && tournament && (tournament.organizerId === user.id || tournament.organizer === user.name);
            // match may not have explicit umpireIds (started quickly for 2-team matches)
            // fall back to tournament-level umpires so tournament umpires get full access
            const tournamentUmpireIds = (tournament?.umpires || []).map((u: any) => u.id);
            const matchUmpires = (match.umpireIds && match.umpireIds.length) ? match.umpireIds : tournamentUmpireIds;
            const isUmpire = user?.playerId && matchUmpires.includes(user.playerId);
            const hasUmpires = matchUmpires.length > 0;
            const canScore = hasUmpires ? (isUmpire || isOrganizer) : isOrganizer;

          if (canScore) {
            return (
              <>
                {match.status === "upcoming" && (
                  <Button
                    variant="lime"
                    size="sm"
                    className="w-full mt-4 cursor-pointer shadow-glow font-bold animate-fade-up"
                    onClick={() => setTossOpen(true)}
                  >
                    Start Match — Toss
                  </Button>
                )}
                {match.status === "live" && (
                  <Button
                    variant="lime"
                    size="sm"
                    className="w-full mt-4 cursor-pointer shadow-glow font-bold animate-fade-up"
                    onClick={() => navigate(`/matches/${matchId}/score`)}
                  >
                    Open Scoring
                  </Button>
                )}
              </>
            );
          } else {
            return (
              <div className="mt-4 text-xs text-muted-foreground text-center bg-white/5 border border-border/20 p-2.5 rounded-xl animate-fade-up">
                {hasUmpires 
                  ? "This match is managed by the assigned Umpire(s)." 
                  : "This match is managed by the Tournament Organizer."}
              </div>
            );
          }
        })()}

        {(() => {
          const isOrganizer = user && tournament && (tournament.organizerId === user.id || tournament.organizer === user.name);
          if (isOrganizer && match.status !== "completed") {
            return (
              <Button
                variant="outline"
                size="sm"
                disabled={cancelMatchMutation.isPending}
                className="w-full mt-2.5 cursor-pointer border-destructive/20 text-destructive hover:bg-destructive/10 rounded-xl transition font-semibold animate-fade-up"
                onClick={() => setIsCancelAlertOpen(true)}
              >
                {cancelMatchMutation.isPending ? "Cancelling..." : "Cancel & Delete Match"}
              </Button>
            );
          }
          return null;
        })()}
      </div>

      <TossModal
        matchId={matchId!}
        open={tossOpen}
        onOpenChange={setTossOpen}
        onTossCompleted={() => {
          navigate(`/matches/${matchId}/score`);
        }}
      />

      {match.innings && match.innings.length > 0 && (
        <Tabs defaultValue="scorecard" className="mt-6">
          <TabsList className="grid grid-cols-3 w-full bg-elevated/40 backdrop-blur-md">
            <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
            <TabsTrigger value="bowling">Bowling</TabsTrigger>
            <TabsTrigger value="commentary">Commentary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="scorecard" className="mt-4 grid gap-4 animate-fade-up">
            {match.innings.map((inn: any, i: number) => {
              const activeStrikerId = (match.status === "live" && scoring && scoring.inningsIndex === i) ? scoring.strikerId : null;
              const activeNonStrikerId = (match.status === "live" && scoring && scoring.inningsIndex === i) ? scoring.nonStrikerId : null;
              
              let battersList = [...(inn.batters || [])];
              if (activeStrikerId && !battersList.some((b: any) => b.playerId === activeStrikerId)) {
                battersList.push({
                  playerId: activeStrikerId,
                  runs: 0,
                  balls: 0,
                  fours: 0,
                  sixes: 0,
                  dismissal: "batting"
                });
              }
              if (activeNonStrikerId && !battersList.some((b: any) => b.playerId === activeNonStrikerId)) {
                battersList.push({
                  playerId: activeNonStrikerId,
                  runs: 0,
                  balls: 0,
                  fours: 0,
                  sixes: 0,
                  dismissal: "batting"
                });
              }

              const battersToShow = battersList.filter((bat: any) => 
                bat.balls > 0 || bat.playerId === activeStrikerId || bat.playerId === activeNonStrikerId
              );

              return (
                <div key={i} className="glass-card border border-border/40 rounded-2xl overflow-hidden shadow-card">
                  <div className="px-4 py-3 text-xs uppercase tracking-widest text-primary border-b border-border/40 bg-white/5 font-bold flex justify-between items-center">
                    <span>{getTeamName(inn.battingTeamId)} Innings</span>
                    <span className="font-mono text-foreground">{inn.runs}/{inn.wickets} ({inn.overs} ov)</span>
                  </div>
                  
                  {/* Header Row */}
                  <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-2.5 text-[9px] uppercase tracking-wider text-muted-foreground/60 border-b border-border/20 font-bold bg-black/20">
                    <span>Batter</span>
                    <span className="text-right">R</span>
                    <span className="text-right">B</span>
                    <span className="text-right">4s</span>
                    <span className="text-right">6s</span>
                    <span className="text-right">SR</span>
                  </div>

                  {battersToShow.map((bat: any) => {
                    const sr = bat.balls > 0 ? ((bat.runs / bat.balls) * 100).toFixed(1) : "0.0";
                    const isStriker = bat.playerId === activeStrikerId;
                    const isNonStriker = bat.playerId === activeNonStrikerId;
                    return (
                      <Link
                        key={bat.playerId}
                        to={`/players/${bat.playerId}`}
                        className={`grid grid-cols-[3fr_1fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-3 text-xs items-center border-b border-border/40 last:border-0 hover:bg-white/5 transition ${
                          isStriker || isNonStriker ? "bg-primary/5 border-l-2 border-l-primary" : ""
                        }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate flex items-center gap-1.5">
                            {findMatchPlayer(bat.playerId)?.name || "Batter"}
                            {isStriker && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/20">
                                Striker
                              </span>
                            )}
                            {isNonStriker && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/40">
                                Runner
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                            {isStriker || isNonStriker ? "batting" : (bat.dismissal || "not out")}
                          </span>
                        </div>
                        <span className="font-bold text-right text-foreground">{bat.runs}</span>
                        <span className="text-muted-foreground text-right">{bat.balls}</span>
                        <span className="text-muted-foreground text-right">{bat.fours}</span>
                        <span className="text-muted-foreground text-right">{bat.sixes}</span>
                        <span className="text-muted-foreground text-right font-mono text-[11px]">{sr}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="bowling" className="mt-4 grid gap-4 animate-fade-up">
            {match.innings.map((inn: any, i: number) => {
              const activeBowlerId = (match.status === "live" && scoring && scoring.inningsIndex === i) ? scoring.bowlerId : null;
              
              let bowlersList = [...(inn.bowlers || [])];
              if (activeBowlerId && !bowlersList.some((b: any) => b.playerId === activeBowlerId)) {
                bowlersList.push({
                  playerId: activeBowlerId,
                  overs: "0.0",
                  runs: 0,
                  wickets: 0,
                  economy: "0.00"
                });
              }

              return (
                <div key={i} className="glass-card border border-border/40 rounded-2xl overflow-hidden shadow-card">
                  <div className="px-4 py-3 text-xs uppercase tracking-widest text-primary border-b border-border/40 bg-white/5 font-bold">
                    Bowling — {getTeamName(inn.bowlingTeamId)}
                  </div>

                  {/* Header Row */}
                  <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-2.5 text-[9px] uppercase tracking-wider text-muted-foreground/60 border-b border-border/20 font-bold bg-black/20">
                    <span>Bowler</span>
                    <span className="text-right">O</span>
                    <span className="text-right">R</span>
                    <span className="text-right">W</span>
                    <span className="text-right">Econ</span>
                  </div>

                  {bowlersList.map((bw: any) => {
                    const isActive = bw.playerId === activeBowlerId;
                    return (
                      <div
                        key={bw.playerId}
                        className={`grid grid-cols-[3fr_1fr_1fr_1fr_1.2fr] gap-2 px-4 py-3 text-xs border-b border-border/40 last:border-0 items-center transition ${
                          isActive ? "bg-accent/5 border-l-2 border-l-accent" : ""
                        }`}
                      >
                        <span className="font-semibold text-foreground truncate flex items-center gap-1.5">
                          {findMatchPlayer(bw.playerId)?.name || "Bowler"}
                          {isActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/20">
                              Bowling
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground text-right">{bw.overs}</span>
                        <span className="text-muted-foreground text-right">{bw.runs}</span>
                        <span className="font-bold text-right text-foreground">{bw.wickets}</span>
                        <span className="text-muted-foreground text-right font-mono text-[11px]">{bw.economy}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="commentary" className="mt-4 grid gap-3 animate-fade-up">
            {match.commentary && match.commentary.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">No commentary available yet.</div>
            ) : (
              match.commentary.map((comm: any, i: number) => {
                const isOut = comm.wicket;
                const isFour = comm.text && comm.text.startsWith("FOUR");
                const isSix = comm.text && comm.text.startsWith("SIX");
                const isExtra = comm.text && (comm.text.startsWith("Wide") || comm.text.startsWith("No ball"));

                let tagBg = "bg-white/5 border-border/20 text-muted-foreground";
                let tagText = "RUNS";
                if (isOut) {
                  tagBg = "bg-destructive/10 border-destructive/30 text-destructive";
                  tagText = "OUT";
                } else if (isSix) {
                  tagBg = "bg-primary/10 border-primary/30 text-primary";
                  tagText = "SIX";
                } else if (isFour) {
                  tagBg = "bg-accent/10 border-accent/30 text-accent";
                  tagText = "FOUR";
                } else if (isExtra) {
                  tagBg = "bg-yellow-500/10 border-yellow-500/30 text-yellow-500";
                  tagText = "EXTRA";
                } else if (comm.runs === 0) {
                  tagBg = "bg-white/5 border-border/10 text-muted-foreground/60";
                  tagText = "DOT";
                }

                return (
                  <div
                    key={i}
                    className={`flex items-start gap-4 p-4 border rounded-2xl transition-all duration-300 ${
                      isOut 
                        ? "bg-destructive/5 border-destructive/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]" 
                        : "glass-card border-border/40 hover:border-border/60"
                    }`}
                  >
                    {/* Over Badge */}
                    <div className="h-10 w-10 shrink-0 rounded-full border border-border/40 bg-elevated/80 flex items-center justify-center font-mono text-xs font-bold text-foreground shadow-sm">
                      {comm.over}
                    </div>

                    {/* Content */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tagBg}`}>
                          {tagText}
                        </span>
                        {comm.runs !== undefined && !isExtra && !isOut && (
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            {comm.runs} {comm.runs === 1 ? "run" : "runs"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/90 leading-relaxed font-semibold">
                        {comm.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Cancel Match Confirmation Popup UI */}
      <AlertDialog open={isCancelAlertOpen} onOpenChange={setIsCancelAlertOpen}>
        <AlertDialogContent className="glass-card border border-destructive/30 rounded-2xl shadow-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg text-foreground flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Cancel & Delete Match
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-normal">
              Are you sure you want to cancel and delete this match? This will remove all scoring history and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="rounded-xl border border-border/40 bg-elevated/45 hover:bg-elevated text-foreground text-xs font-semibold py-2">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMatchMutation.isPending}
              onClick={() => cancelMatchMutation.mutate()}
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-xs py-2"
            >
              {cancelMatchMutation.isPending ? "Cancelling..." : "Yes, Cancel Match"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {renderEndGamePopup()}
      {renderLiveAnimation()}
    </AppShell>
  );



  function renderLiveAnimation() {
    if (!activeAnimation) return null;

    switch (activeAnimation.type) {
      case "four":
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden">
            <div className="relative w-96 h-40 flex flex-col items-center justify-center scale-90 bg-black/60 rounded-2xl backdrop-blur-md shadow-2xl border border-border/30 pointer-events-none">
              <div className="absolute text-5xl animate-ball-roll select-none z-20">
                🥎
              </div>
              <h1 className="font-display text-6xl font-black tracking-widest text-primary drop-shadow-[0_4px_25px_rgba(195,244,0,0.85)] z-10 animate-bounce">
                FOUR!
              </h1>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/80 mt-1 z-10">
                Crosses the Boundary! 🏏
              </p>
            </div>
          </div>
        );

      case "six":
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden">
            <div className="relative w-96 h-40 flex flex-col items-center justify-center scale-90 bg-black/60 rounded-2xl backdrop-blur-md shadow-2xl border border-border/30 pointer-events-none">
              <div className="absolute text-6xl animate-ball-soar select-none z-20">
                🥎
              </div>
              <h1 className="font-display text-6xl font-black tracking-widest text-yellow-400 drop-shadow-[0_4px_25px_rgba(250,204,21,0.85)] z-10 animate-bounce">
                SIX!
              </h1>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/80 mt-1 z-10">
                Out of the Stadium! 🚀
              </p>
            </div>
          </div>
        );

      case "noball":
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden">
            <div className="relative w-96 h-40 flex flex-col items-center justify-center scale-90 bg-black/60 rounded-2xl backdrop-blur-md shadow-2xl border border-orange-500/20 pointer-events-none text-center space-y-1">
              <div className="text-4xl animate-warning-pulse select-none">
                🚨
              </div>
              <h1 className="font-display text-5xl font-black tracking-widest text-orange-500 drop-shadow-[0_4px_15px_rgba(249,115,22,0.8)]">
                NO BALL!
              </h1>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                Free Hit Coming Up! ⚡
              </p>
            </div>
          </div>
        );

      default: { // Wickets (caught, bowled, lbw, stumped, runout, wicket)
        const type = activeAnimation.type;
        let wicketTitle = "OUT!";
        let wicketSubtitle = "Wicket Down";
        if (type === "bowled") {
          wicketTitle = "BOWLED!";
          wicketSubtitle = "Clean Bowled! 🎳";
        } else if (type === "caught") {
          wicketTitle = "CAUGHT!";
          wicketSubtitle = "Brilliant Catch! 🧤";
        } else if (type === "lbw") {
          wicketTitle = "LBW!";
          wicketSubtitle = "Leg Before Wicket! 🛑";
        } else if (type === "stumped") {
          wicketTitle = "STUMPED!";
          wicketSubtitle = "Lightning Fast Hands! 🧤";
        } else if (type === "runout") {
          wicketTitle = "RUN OUT!";
          wicketSubtitle = "Direct Hit! 🏃💨";
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none overflow-hidden">
            <div className="relative w-96 h-44 flex flex-col items-center justify-center scale-75 bg-black/60 rounded-2xl backdrop-blur-md shadow-2xl border border-red-500/20 pointer-events-none">
              {/* Stumps container */}
              <div className="relative h-44 w-44 flex items-end justify-center mb-6 z-10">
                {/* Bails */}
                <div className="absolute bottom-32 left-[53px] right-[53px] h-1.5 flex justify-between z-10">
                  <div className="w-[33px] h-1.5 bg-amber-800 rounded shadow animate-bail-left border border-amber-900" />
                  <div className="w-[33px] h-1.5 bg-amber-800 rounded shadow animate-bail-right border border-amber-900" />
                </div>
                
                {/* Stumps */}
                <div className="flex gap-5 relative z-10">
                  {/* Stump Left */}
                  <div className="w-2.5 h-32 bg-gradient-to-b from-amber-700 to-amber-950 rounded-t-sm shadow border border-amber-950 animate-stump-left" />
                  {/* Stump Middle */}
                  <div className="w-2.5 h-32 bg-gradient-to-b from-amber-700 to-amber-950 rounded-t-sm shadow border border-amber-950" />
                  {/* Stump Right */}
                  <div className="w-2.5 h-32 bg-gradient-to-b from-amber-700 to-amber-950 rounded-t-sm shadow border border-amber-950 animate-stump-right" />
                </div>

                {/* Red ball striking the stumps */}
                <div className="absolute text-4xl animate-ball-strike select-none z-20">
                  🔴
                </div>
              </div>

              {/* Glowing Text Info */}
              <div className="text-center space-y-1">
                <h1 className="font-display text-5xl font-black tracking-widest text-red-500 drop-shadow-[0_4px_16px_rgba(239,68,68,0.7)] animate-pulse">
                  {wicketTitle}
                </h1>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
                  {wicketSubtitle}
                </p>
              </div>
            </div>
          </div>
        );
      }
    }
  }

  function renderEndGamePopup() {
    if (!match || match.status !== "completed" || !match.winnerId || !isPlayingPlayer) return null;

    const isWinner = user?.teamId && user.teamId === match.winnerId;
    const isNeutral = !user?.teamId;
    const winnerName = getTeamName(match.winnerId);
    const resultTextStr = match.resultText || "Match completed";

    return (
      <Dialog open={showEndGamePopup} onOpenChange={setShowEndGamePopup}>
        <DialogContent className="max-w-md border border-border/40 rounded-3xl p-8 text-center glass-card shadow-2xl bg-elevated/95 backdrop-blur-2xl animate-scale-up overflow-hidden relative">
          <div className="absolute inset-0 bg-radial-glow opacity-30 pointer-events-none" />

          {isWinner ? (
            <div className="space-y-6 relative z-10 animate-fade-up">
              <div className="relative inline-block">
                <span className="text-6xl animate-bounce inline-block">🏆</span>
                <span className="absolute -top-2 -right-2 text-2xl animate-ping">✨</span>
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-200 to-yellow-500 animate-pulse">
                  VICTORY!
                </h2>
                <p className="text-sm font-semibold text-foreground/90 uppercase tracking-widest">
                  Your Team Won!
                </p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 shadow-inner">
                <div className="text-lg font-bold text-yellow-400 font-display">
                  {winnerName}
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">
                  {resultTextStr}
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Congratulations on a spectacular performance! 🎉
              </p>
              <Button
                variant="lime"
                className="w-full h-11 rounded-xl font-bold shadow-glow"
                onClick={() => setShowEndGamePopup(false)}
              >
                Awesome!
              </Button>
            </div>
          ) : isNeutral ? (
            <div className="space-y-6 relative z-10 animate-fade-up">
              <div className="text-5xl animate-pulse">🏏</div>
              <div className="space-y-2">
                <h2 className="font-display text-2xl font-extrabold text-primary">
                  Match Completed!
                </h2>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                  Final Result
                </p>
              </div>
              <div className="bg-[#11223b]/40 border border-border/20 rounded-2xl p-4 shadow-inner">
                <div className="text-lg font-bold text-foreground font-display">
                  {winnerName}
                </div>
                <div className="text-xs text-primary font-semibold mt-1">
                  {resultTextStr}
                </div>
              </div>
              <Button
                variant="hero"
                className="w-full h-11 rounded-xl font-bold"
                onClick={() => setShowEndGamePopup(false)}
              >
                Close Scorecard
              </Button>
            </div>
          ) : (
            <div className="space-y-6 relative z-10 animate-fade-up">
              <div className="text-5xl animate-bounce">💔</div>
              <div className="space-y-2">
                <h2 className="font-display text-2xl font-extrabold text-muted-foreground">
                  Defeat
                </h2>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                  Better Luck Next Time!
                </p>
              </div>
              <div className="bg-destructive/5 border border-destructive/10 rounded-2xl p-4 shadow-inner">
                <div className="text-lg font-bold text-foreground font-display">
                  {winnerName}
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-medium">
                  {resultTextStr}
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Hard luck today, analyze your stats and come back stronger!
              </p>
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl font-bold"
                onClick={() => setShowEndGamePopup(false)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
}
