import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useApp, type BallOutcome } from "@/lib/store";
import { useQuery, useQueryClient } from "@/hooks/useApi";
import { getMatch, getTeam, getTeamPlayers, getScoring, getTournament } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Undo2, Flag } from "lucide-react";
import { toast } from "sonner";
import { CricketLoading, useLoadingState } from "@/components/CricketLoading";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function Scoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Queries
  const { data: match, isLoading: loadingMatch, error: matchError } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => getMatch({ data: matchId }),
  });

  const { data: scoringDb, isLoading: loadingScoringDb } = useQuery({
    queryKey: ["scoring", matchId],
    queryFn: () => getScoring({ data: matchId }),
  });

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

  // Zustand Store
  const scoring = useApp((s) => s.scoring);
  const setScoringState = useApp((s) => s.setScoringState);
  const startScoring = useApp((s) => s.startScoring);
  const setInningsLineup = useApp((s) => s.setInningsLineup);
  const applyBall = useApp((s) => s.applyBall);
  const editBall = useApp((s) => s.editBall);
  const endInnings = useApp((s) => s.endInnings);
  const finishMatch = useApp((s) => s.finishMatch);

  // Pickers state
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");

  // Edit ball states
  const [editingBallIndex, setEditingBallIndex] = useState<number | null>(null);
  const [editBallOutcome, setEditBallOutcome] = useState<string>("");
  const [editBallRuns, setEditBallRuns] = useState<number>(0);
  const [editBallDismissedId, setEditBallDismissedId] = useState<string>("");

  // Extras selection & wicket customizations
  const [extraType, setExtraType] = useState<"wide" | "noball" | "byes" | "legbyes" | "rare" | null>(null);
  const [wicketRuns, setWicketRuns] = useState<number>(0);
  const [isWicketNoBall, setIsWicketNoBall] = useState<boolean>(false);
  const [wicketKind, setWicketKind] = useState<"wicket" | "retired_hurt" | "retired_out" | "timedout">("wicket");

  const started = scoring.matchId === matchId;
  const user = useApp((s) => s.user);

  const { data: tournament } = useQuery({
    queryKey: ["tournament", match?.tournamentId],
    queryFn: () => getTournament({ data: match?.tournamentId }),
    enabled: !!match,
  });

  useEffect(() => {
    document.title = "Scoring — Stadium Night";
  }, []);

  useEffect(() => {
    if (matchError) {
      toast.error("Match not found or has been deleted.");
      navigate("/home");
    }
  }, [matchError, navigate]);

  // Restore session from DB on load
  useEffect(() => {
    if (scoringDb && scoring.matchId !== matchId) {
      setScoringState(scoringDb);
    }
  }, [scoringDb, scoring.matchId, matchId, setScoringState]);

  // Wicket Modal state
  const [isWicketOpen, setIsWicketOpen] = useState(false);
  const [dismissalType, setDismissalType] = useState<"bowled" | "caught" | "lbw" | "stumped" | "runout" | "retired" | "timedout">("caught");
  const [dismissedBatterId, setDismissedBatterId] = useState("");
  const [fielderId, setFielderId] = useState("");
  const [newBatterId, setNewBatterId] = useState("");

  const a = teamA || { id: match?.teamAId || "", name: "Team A", shortName: "TMA" };
  const b = teamB || { id: match?.teamBId || "", name: "Team B", shortName: "TMB" };

  const currentBattingTeamId = started && scoring.battingTeamId
    ? scoring.battingTeamId
    : match?.tossDecision === "bat"
      ? match.tossWinnerId!
      : match?.tossWinnerId === match?.teamAId
        ? match?.teamBId
        : match?.teamAId;

  const currentBowlingTeamId = currentBattingTeamId === a.id ? b.id : a.id;

  const currentBattingTeam = currentBattingTeamId === a.id ? a : b;
  const currentBowlingTeam = currentBowlingTeamId === a.id ? a : b;

  const batters = currentBattingTeamId === a.id ? teamAPlayers : teamBPlayers;
  const bowlers = currentBattingTeamId === a.id ? teamBPlayers : teamAPlayers;

  const matchPlayers = [...teamAPlayers, ...teamBPlayers];
  const findMatchPlayer = (pid?: string) => {
    if (!pid) return null;
    const found = matchPlayers.find((p: any) => p.id === pid);
    if (found) return found;
    return tournament?.umpires?.find((p: any) => p.id === pid) || null;
  };

  const dismissedIds = scoring.dismissedPlayerIds || [];
  const availableBatters = batters.filter((p: any) => !dismissedIds.includes(p.id));

  const needsLineupSetup = !started || (started && (!scoring.strikerId || !scoring.nonStrikerId || !scoring.bowlerId));

  // Set default picker selections once rosters are loaded
  useEffect(() => {
    if (needsLineupSetup && batters.length > 0 && bowlers.length > 0) {
      if (availableBatters[0]) setStriker(availableBatters[0].id);
      if (availableBatters[1]) setNonStriker(availableBatters[1].id);
      const defaultBowler = bowlers.find((p: any) => p.role !== "Batter" && p.id !== scoring.previousBowlerId) || bowlers[0];
      if (defaultBowler) setBowler(defaultBowler.id);
    }
  }, [needsLineupSetup, currentBattingTeamId, teamAPlayers, teamBPlayers, scoring.previousBowlerId]);

  const [hasShownEndGame, setHasShownEndGame] = useState(false);
  const [showEndGamePopup, setShowEndGamePopup] = useState(false);

  useEffect(() => {
    if (scoring.finished && !hasShownEndGame) {
      setShowEndGamePopup(true);
      setHasShownEndGame(true);
    }
  }, [scoring.finished, hasShownEndGame]);

  // Auto-select bowler on over completed
  useEffect(() => {
    if (scoring.needsNewBowler) {
      const nextBowler = bowlers.find((p: any) => p.role !== "Batter" && p.id !== scoring.previousBowlerId) || 
                         bowlers.find((p: any) => p.id !== scoring.previousBowlerId) || 
                         bowlers[0];
      if (nextBowler) {
        setBowler(nextBowler.id);
      }
    }
  }, [scoring.needsNewBowler, scoring.previousBowlerId, bowlers]);

  const isLoading = useLoadingState(loadingMatch || loadingScoringDb || loadingTeamA || loadingTeamB || loadingPlayersA || loadingPlayersB);

  if (isLoading) {
    return (
      <AppShell title="Live Scoring">
        <CricketLoading />
      </AppShell>
    );
  }

  if (!match) {
    return (
      <AppShell title="Match Not Found">
        <div className="text-center py-24">
          <h2 className="font-display text-2xl text-destructive">Match Not Found</h2>
          <p className="text-muted-foreground text-sm mt-2">The match to score does not exist.</p>
          <button onClick={() => navigate("/matches")} className="inline-block mt-4 text-primary hover:underline cursor-pointer">Back to Matches</button>
        </div>
      </AppShell>
    );
  }

  const isOrganizer = user && tournament && (tournament.organizerId === user.id || tournament.organizer === user.name);
  const matchUmpires = match.umpireIds || [];
  const isUmpire = user?.playerId && matchUmpires.includes(user.playerId);
  const hasUmpires = matchUmpires.length > 0;
  const canScore = hasUmpires ? (isUmpire || isOrganizer) : isOrganizer;

  if (!canScore) {
    return (
      <AppShell title="Access Denied">
        <div className="text-center py-16 px-4 glass-card border border-destructive/20 rounded-2xl max-w-md mx-auto my-8">
          <h2 className="font-display text-3xl text-destructive">Access Denied</h2>
          <p className="text-muted-foreground text-xs mt-3 leading-relaxed">
            {hasUmpires 
              ? "This match has assigned Umpires. Only the selected Umpires or the Tournament Organizer are permitted to handle live scoring."
              : "Only the Tournament Organizer is permitted to handle live scoring for this match."}
          </p>
          <Button variant="lime" className="mt-5 w-full cursor-pointer" onClick={() => navigate(`/matches/${matchId}`)}>
            Back to Match Details
          </Button>
        </div>
      </AppShell>
    );
  }

  if (needsLineupSetup) {
    return (
      <AppShell title="Playing XI">
        <div className="glass-card border border-border/40 rounded-2xl p-5 space-y-4 max-w-md mx-auto my-4 animate-fade-up">
          <h1 className="font-display text-2xl mb-1 text-foreground">
            {currentBattingTeam.name} — Innings {scoring.inningsIndex + 1}
          </h1>
          <p className="text-xs text-muted-foreground leading-normal">
            Setup active batsman and bowler to start scoring for this inning.
          </p>

          <Select
            label="Striker"
            players={availableBatters}
            value={striker}
            onChange={setStriker}
            exclude={[nonStriker]}
          />
          <Select
            label="Non-striker"
            players={availableBatters}
            value={nonStriker}
            onChange={setNonStriker}
            exclude={[striker]}
          />
          <Select 
            label="Bowler" 
            players={bowlers.filter((p: any) => p.id !== scoring.previousBowlerId)} 
            value={bowler} 
            onChange={setBowler} 
          />

          <Button
            variant="lime"
            size="lg"
            className="w-full mt-4 cursor-pointer font-bold shadow-glow"
            disabled={!striker || !nonStriker || !bowler}
            onClick={async () => {
              if (!started) {
                await startScoring(matchId!, striker, nonStriker, bowler, currentBattingTeamId || "", currentBowlingTeamId || "");
              } else {
                await setInningsLineup(striker, nonStriker, bowler);
              }
              queryClient.invalidateQueries({ queryKey: ["match", matchId!] });
              queryClient.invalidateQueries({ queryKey: ["scoring", matchId!] });
              queryClient.invalidateQueries({ queryKey: ["matches"] });
              queryClient.invalidateQueries({ queryKey: ["team"] });
              toast.success("Innings lineup configured.");
            }}
          >
            Start Innings
          </Button>
        </div>
      </AppShell>
    );
  }

  const oversStr = `${Math.floor(scoring.totalBalls / 6)}.${scoring.totalBalls % 6}`;
  const rr = scoring.totalBalls > 0 ? ((scoring.runs / scoring.totalBalls) * 6).toFixed(2) : "0.00";
  const targetText = scoring.target
    ? `Target ${scoring.target} · Need ${Math.max(0, scoring.target - scoring.runs)} off ${
        match.overs * 6 - scoring.totalBalls
      }`
    : null;
  const chaseDone = scoring.target && scoring.runs >= scoring.target;
  const inningsDone = scoring.totalBalls >= match.overs * 6 || scoring.wickets >= 10;
  const isInningsOver = !!(inningsDone || chaseDone);

  const isExtraBall = (outcome: string) => {
    if (!outcome) return false;
    const o = outcome.toLowerCase();
    return o.startsWith("wd") || o.startsWith("nb") || o === "dead" || o === "dead ball" || o === "5pen" || o === "rethurt" || o === "timedout";
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

  const currentOverBalls = getCurrentOverBalls(scoring.ballLog || [], scoring.ballsInOver, !!scoring.needsNewBowler);
  const currentOverRuns = currentOverBalls.reduce((sum, item) => sum + (item.ball.runs || 0), 0);

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

  const btn = (label: string, outcome: BallOutcome, classes = "glass-card hover:bg-white/10") => (
    <button
      onClick={async () => {
        await applyBall(outcome);
      }}
      disabled={scoring.needsNewBowler || isInningsOver}
      className={`h-14 rounded-xl border border-border/40 font-display text-xl transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${classes}`}
    >
      {label}
    </button>
  );



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

  const getBowlerEconomy = (bStats: any) => {
    const oversParts = String(bStats.overs || "0.0").split(".");
    const oversInt = parseInt(oversParts[0], 10) || 0;
    const ballsInt = parseInt(oversParts[1], 10) || 0;
    const totalBalls = (oversInt * 6) + ballsInt;
    if (totalBalls === 0) return "0.00";
    return ((bStats.runs / totalBalls) * 6).toFixed(2);
  };

  const getPartnership = () => {
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

  const partnership = getPartnership();

  const getLastWicketFull = () => {
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

    const batterStats = activeInnings?.batters?.find((b: any) => b.playerId === wktBall.dismissedBatterId) || { runs: 0, balls: 0 };

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

  const lastWktDetails = getLastWicketFull();

  const getWinProbability = () => {
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
    const crr = scoring.totalBalls > 0 ? (scoring.runs / scoring.totalBalls) * 6 : 6;
    const remainingBalls = Math.max(0, match.overs * 6 - scoring.totalBalls);
    const remainingOvers = remainingBalls / 6;

    const minProj = Math.round(scoring.runs + (5 * remainingOvers));
    const expProj = Math.round(scoring.runs + (crr * remainingOvers));
    const maxProj = Math.round(scoring.runs + (8 * remainingOvers));

    return { min: minProj, expected: expProj, max: maxProj };
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

  const getTeamNameById = (teamId?: string) => {
    if (teamId === a.id) return a.name;
    if (teamId === b.id) return b.name;
    return "Team";
  };
  const getWinnerName = (wid?: string) => {
    if (!wid) return "Team";
    return getTeamNameById(wid) || "Team";
  };
  const getResultText = () => {
    const winnerId = scoring.target && scoring.runs >= scoring.target ? scoring.battingTeamId : scoring.bowlingTeamId;
    const winnerName = getWinnerName(winnerId);
    const battingPlayersCount = batters.length;
    const maxWickets = battingPlayersCount > 0 ? battingPlayersCount - 1 : 10;
    
    if (scoring.target && scoring.runs >= scoring.target) {
      return `${winnerName} won by ${maxWickets - scoring.wickets} wickets`;
    } else {
      return `${winnerName} won by ${(scoring.target || scoring.runs) - scoring.runs - 1} runs`;
    }
  };

  return (
    <AppShell title="Live Scoring">
      {scoring.inningsIndex === 0 ? (
        <div className="glass-card border border-border/40 rounded-2xl p-5 shadow-card text-center neon-glow-primary animate-fade-up">
          <div className="text-xs uppercase tracking-widest text-destructive font-bold flex items-center justify-center gap-1.5 live-pulse">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            🔴 LIVE • INNINGS 1
          </div>
          <div className="font-display text-6xl mt-2 font-black tracking-tight">
            {scoring.runs}
            <span className="text-3xl text-muted-foreground font-normal">/{scoring.wickets}</span>
          </div>
          <div className="text-sm text-foreground/80 font-bold mt-1">
            {currentBattingTeam.name} vs {currentBowlingTeam.name}
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-semibold flex justify-center gap-3">
            <span>{oversStr} Overs</span>
            <span>•</span>
            <span>CRR {rr}</span>
          </div>
        </div>
      ) : (
        <div className="glass-card border border-border/40 rounded-2xl p-5 shadow-card text-center neon-glow-primary animate-fade-up">
          <div className="text-xs uppercase tracking-widest text-destructive font-bold flex items-center justify-center gap-1.5 live-pulse">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            🔴 LIVE • INNINGS 2
          </div>
          <div className="font-display text-6xl mt-2 font-black tracking-tight">
            {scoring.runs}
            <span className="text-3xl text-muted-foreground font-normal">/{scoring.wickets}</span>
          </div>
          {(() => {
            const runsNeeded = Math.max(0, (scoring.target || 0) - scoring.runs);
            const ballsRemaining = Math.max(0, match.overs * 6 - scoring.totalBalls);
            const rrr = ballsRemaining > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : "0.00";
            return (
              <>
                <div className="text-xs text-primary font-bold mt-1.5 bg-primary/10 py-1 px-3 rounded-full inline-block border border-primary/20">
                  Target {scoring.target || 0} · Need <span className="underline">{runsNeeded} runs</span> from <span className="underline">{ballsRemaining} balls</span>
                </div>
                <div className="text-sm text-foreground/80 font-bold mt-2.5">
                  {currentBattingTeam.name} vs {currentBowlingTeam.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-semibold flex justify-center gap-3">
                  <span>CRR {rr}</span>
                  <span>•</span>
                  <span>RRR {rrr}</span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Current Players Panel with Strike Rotation */}
      <div className="grid grid-cols-2 gap-4 mt-4 animate-fade-up">
        {/* Batters */}
        <div className="glass-card border border-border/40 rounded-2xl p-4 space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/10 pb-2 flex justify-between items-center">
            <span>Batting</span>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[9px] rounded-lg border-border/40 text-muted-foreground hover:text-foreground cursor-pointer font-bold"
              onClick={async () => {
                await applyBall({ kind: "swap_strike" });
                toast.success("Strike rotated");
              }}
            >
              ⇄ Strike
            </Button>
          </div>
          
          <div className="space-y-3.5">
            <div>
              <div className="flex justify-between items-start">
                <span className="font-semibold text-foreground text-xs truncate max-w-28">{findMatchPlayer(scoring.strikerId)?.name || "Striker"}*</span>
                <span className="text-xs font-black font-display text-primary">{strikerStats.runs} <span className="text-[10px] text-muted-foreground font-normal">({strikerStats.balls})</span></span>
              </div>
              <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5 font-medium">
                <span>4s: {strikerStats.fours}</span>
                <span>•</span>
                <span>6s: {strikerStats.sixes}</span>
                <span>•</span>
                <span>SR: {strikerSR}</span>
              </div>
            </div>
            
            <div className="border-t border-border/10 pt-2.5">
              <div className="flex justify-between items-start">
                <span className="font-medium text-foreground/80 text-xs truncate max-w-28">{findMatchPlayer(scoring.nonStrikerId)?.name || "Non-striker"}</span>
                <span className="text-xs font-bold font-display text-foreground/90">{nonStrikerStats.runs} <span className="text-[10px] text-muted-foreground font-normal">({nonStrikerStats.balls})</span></span>
              </div>
              <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5 font-medium">
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
        <div className="glass-card border border-border/40 rounded-2xl p-4 space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/10 pb-2">
            Bowling
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-foreground text-xs truncate">{findMatchPlayer(scoring.bowlerId)?.name || "Bowler"}</div>
            <div className="text-xl font-black font-display text-primary mt-1">
              {activeBowlerStats.wickets} <span className="text-xs text-muted-foreground font-normal">Wickets</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-muted-foreground pt-1.5 font-medium">
              <div>Overs: <span className="text-foreground font-semibold">{activeBowlerStats.overs || "0.0"}</span></div>
              <div>Runs: <span className="text-foreground font-semibold">{activeBowlerStats.runs}</span></div>
              <div>Maidens: <span className="text-foreground font-semibold">{activeBowlerStats.maidens || 0}</span></div>
              <div>Econ: <span className="text-foreground font-semibold">{getBowlerEconomy(activeBowlerStats)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Scoring Input / New Bowler selector (Primary interaction) */}
      {scoring.needsNewBowler && !isInningsOver ? (
        <div className="glass-card border border-primary/30 bg-primary/5 rounded-2xl p-5 shadow-glow text-center my-4 animate-fade-up">
          <h2 className="font-display text-lg text-primary flex items-center justify-center gap-1.5 font-bold">
            ⚡ Over Completed!
          </h2>
          
          <div className="my-3 bg-[#11223b]/40 border border-border/30 rounded-xl p-3 text-left">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Completed Over Summary</div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-foreground">
                Bowled by: <span className="text-primary font-semibold">{findMatchPlayer(scoring.previousBowlerId)?.name || "Unknown"}</span>
              </span>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {currentOverRuns} runs
              </span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {currentOverBalls.map((item, i) => (
                <span
                  key={i}
                  className={`h-7 w-7 rounded-full text-xs font-display font-semibold grid place-items-center ${getBallBadgeClass(item.ball.outcome)}`}
                >
                  {item.ball.outcome}
                </span>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground mt-1 mb-4">
            Select a bowler for the next over. Note: {findMatchPlayer(scoring.previousBowlerId)?.name || "Previous bowler"} cannot bowl back-to-back overs.
          </p>
          <div className="space-y-3">
            <select
              className="w-full h-10 rounded-xl border border-border/40 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer font-medium"
              value={bowler}
              onChange={(e) => setBowler(e.target.value)}
            >
              <option value="" disabled>Select Bowler</option>
              {bowlers
                .filter((p: any) => p.id !== scoring.previousBowlerId)
                .map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.role}
                  </option>
                ))}
            </select>
            <Button
              variant="lime"
              className="w-full cursor-pointer font-bold shadow-glow animate-pulse"
              disabled={!bowler}
              onClick={async () => {
                await applyBall({ kind: "set_bowler", bowlerId: bowler });
                toast.success("New over started");
              }}
            >
              Start Next Over
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 mt-5 animate-fade-up">
          {btn("0", { kind: "runs", runs: 0 })}
          {btn("1", { kind: "runs", runs: 1 })}
          {btn("2", { kind: "runs", runs: 2 })}
          {btn("3", { kind: "runs", runs: 3 })}
          {btn(
            "4",
            { kind: "runs", runs: 4 },
            "bg-accent/20 border-accent/40 hover:bg-accent/30 text-accent font-bold shadow-[0_0_10px_rgba(0,209,255,0.1)]",
          )}
          {btn("5", { kind: "runs", runs: 5 })}
          {btn(
            "6",
            { kind: "runs", runs: 6 },
            "gradient-lime text-primary-foreground font-bold shadow-[0_0_10px_rgba(195,244,0,0.2)]",
          )}
          
          <button
            onClick={() => {
              setDismissalType("caught");
              setDismissedBatterId(scoring.strikerId || "");
              setFielderId(bowlers.find((p: any) => p.id !== scoring.bowlerId)?.id || bowlers[0]?.id || "");
              const nextBat = availableBatters.find((p: any) => p.id !== scoring.strikerId && p.id !== scoring.nonStrikerId);
              setNewBatterId(nextBat?.id || "");
              setWicketKind("wicket");
              setIsWicketOpen(true);
            }}
            disabled={scoring.needsNewBowler || isInningsOver}
            className="h-14 rounded-xl border border-destructive/40 bg-destructive/20 hover:bg-destructive/30 text-destructive font-bold font-display text-xl transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-30"
          >
            W
          </button>
          
          <button
            onClick={() => setExtraType("wide")}
            disabled={scoring.needsNewBowler || isInningsOver}
            className="h-14 rounded-xl border border-border/40 font-display text-xl transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-elevated/40 hover:bg-white/10"
          >
            Wd
          </button>
          <button
            onClick={() => setExtraType("noball")}
            disabled={scoring.needsNewBowler || isInningsOver}
            className="h-14 rounded-xl border border-border/40 font-display text-xl transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-elevated/40 hover:bg-white/10"
          >
            Nb
          </button>
          <button
            onClick={() => setExtraType("byes")}
            disabled={scoring.needsNewBowler || isInningsOver}
            className="h-14 rounded-xl border border-border/40 font-display text-xl transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-elevated/40 hover:bg-white/10"
          >
            B
          </button>
          <button
            onClick={() => setExtraType("legbyes")}
            disabled={scoring.needsNewBowler || isInningsOver}
            className="h-14 rounded-xl border border-border/40 font-display text-xl transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-elevated/40 hover:bg-white/10"
          >
            Lb
          </button>
          
          <button
            onClick={() => setExtraType("rare")}
            disabled={scoring.needsNewBowler || isInningsOver}
            className="h-12 col-span-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ★ Special / Rare Runs (Penalty, Dead Ball, Retired, Timed Out)
          </button>
        </div>
      )}

      {/* Action Buttons (Undo / Declare / Finish) */}
      <div className="grid grid-cols-2 gap-2 mt-4 animate-fade-up">
        <Button
          variant="hero"
          className="cursor-pointer font-bold"
          onClick={async () => {
            await applyBall({ kind: "undo" });
          }}
        >
          <Undo2 className="h-4 w-4 mr-1" /> Undo
        </Button>
        {chaseDone || (inningsDone && scoring.inningsIndex === 1) ? (
          <Button
            variant="lime"
            className="cursor-pointer font-bold shadow-glow"
            onClick={async () => {
              await finishMatch();
              queryClient.invalidateQueries({ queryKey: ["match", matchId!] });
              queryClient.invalidateQueries({ queryKey: ["scoring", matchId!] });
              queryClient.invalidateQueries({ queryKey: ["matches"] });
              queryClient.invalidateQueries({ queryKey: ["team"] });
              toast.success("Match finished");
              navigate(`/matches/${matchId}`);
            }}
          >
            <Flag className="h-4 w-4 mr-1" /> Finish match
          </Button>
        ) : inningsDone ? (
          <Button
            variant="lime"
            className="cursor-pointer font-bold shadow-glow"
            onClick={async () => {
              await endInnings();
              queryClient.invalidateQueries({ queryKey: ["match", matchId!] });
              queryClient.invalidateQueries({ queryKey: ["scoring", matchId!] });
              queryClient.invalidateQueries({ queryKey: ["matches"] });
              queryClient.invalidateQueries({ queryKey: ["team"] });
              toast.success("Innings ended");
            }}
          >
            End innings
          </Button>
        ) : (
          <Button
            variant="hero"
            className="cursor-pointer font-bold"
            onClick={async () => {
              await endInnings();
              queryClient.invalidateQueries({ queryKey: ["match", matchId!] });
              queryClient.invalidateQueries({ queryKey: ["scoring", matchId!] });
              queryClient.invalidateQueries({ queryKey: ["matches"] });
              queryClient.invalidateQueries({ queryKey: ["team"] });
              toast("Innings ended (Declared)");
            }}
          >
            Declare
          </Button>
        )}
      </div>

      {/* This Over Display */}
      <div className="mt-5 animate-fade-up">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex justify-between items-center">
          <span>This over</span>
          <span className="font-semibold text-primary">{currentOverRuns} runs</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {currentOverBalls.map((item, i) => {
            const l = item.ball;
            return (
              <div
                key={i}
                onClick={() => {
                  setEditingBallIndex(item.absIndex);
                  setEditBallOutcome(l.outcome);
                  setEditBallRuns(l.runs);
                  setEditBallDismissedId(l.dismissedBatterId || "");
                }}
                className={`h-9 w-9 rounded-full grid place-items-center font-display text-sm cursor-pointer hover:border-primary/60 transition ${getBallBadgeClass(l.outcome)}`}
                title={`Batter: ${findMatchPlayer(l.strikerId)?.name || 'N/A'} · Click to edit`}
              >
                {l.outcome}
              </div>
            );
          })}
        </div>
      </div>

      {/* Secondary Statistics (Bottom Panels) */}
      <div className="border-t border-border/10 pt-6 mt-6 space-y-4 animate-fade-up text-left">
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-black">
          Detailed Statistics & Predictions
        </div>

        {/* Projections or Chase Details */}
        {scoring.inningsIndex === 0 ? (
          /* Innings 1 Projections */
          (() => {
            const proj = getProjectedScore();
            return (
              <div className="glass-card border border-border/40 rounded-2xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">Projected Score</div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-[#11223b]/30 rounded-xl p-2 border border-border/10">
                    <div className="text-[10px] text-muted-foreground font-semibold">MIN (5 RPO)</div>
                    <div className="text-lg font-black font-display text-muted-foreground">{proj.min}</div>
                  </div>
                  <div className="bg-[#11223b]/50 rounded-xl p-2.5 border border-primary/20 shadow-glow-sm">
                    <div className="text-[10px] text-primary font-bold">EXPECTED</div>
                    <div className="text-xl font-black font-display text-primary">{proj.expected}</div>
                  </div>
                  <div className="bg-[#11223b]/30 rounded-xl p-2 border border-border/10">
                    <div className="text-[10px] text-muted-foreground font-semibold">MAX (8 RPO)</div>
                    <div className="text-lg font-black font-display text-foreground">{proj.max}</div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          /* Innings 2 Chase/Probability panels */
          (() => {
            const runsNeeded = Math.max(0, (scoring.target || 0) - scoring.runs);
            const ballsRemaining = Math.max(0, match.overs * 6 - scoring.totalBalls);
            const winProb = getWinProbability();
            const progressPct = Math.min(100, Math.round((scoring.runs / (scoring.target || 1)) * 100));
            const sit = getMatchSituation();

            return (
              <div className="space-y-4">
                {/* Chase progress */}
                <div className="glass-card border border-border/40 rounded-2xl p-4">
                  <div className="flex justify-between items-center text-xs mb-2">
                    <span className="font-semibold text-muted-foreground">Chase Progress</span>
                    <span className="font-black text-primary">{scoring.runs} / {scoring.target || 0} ({progressPct}%)</span>
                  </div>
                  <div className="w-full h-3 bg-[#11223b]/30 rounded-full overflow-hidden border border-border/10">
                    <div
                      className="h-full gradient-lime transition-all duration-300 rounded-full"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Situation */}
                {sit && (
                  <div className={`border rounded-2xl p-4 shadow-glow-sm ${
                    sit.variant === "victory" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                    sit.variant === "level" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                    sit.variant === "comfortable" ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" :
                    sit.variant === "balanced" ? "bg-sky-500/10 border-sky-500/30 text-sky-400" :
                    "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  }`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Match Situation</div>
                        <div className="text-xs font-bold mt-0.5">{sit.text}</div>
                      </div>
                      <div className="flex gap-0.5 text-yellow-400 text-sm">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i}>{i < sit.stars ? "★" : "☆"}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Win probability */}
                <div className="glass-card border border-border/40 rounded-2xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3 text-center">Win Probability</div>
                  <div className="flex justify-between text-xs font-bold mb-2">
                    <span className="text-primary">{currentBattingTeam.shortName || "Team"} (Batting) {winProb.batting}%</span>
                    <span className="text-muted-foreground">{currentBowlingTeam.shortName || "Team"} (Bowling) {winProb.bowling}%</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex border border-border/10">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${winProb.batting}%` }} />
                    <div className="h-full bg-[#3b4b5e] transition-all duration-300" style={{ width: `${winProb.bowling}%` }} />
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* Partnership & Extras card */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card border border-border/40 rounded-2xl p-4 space-y-3.5 flex flex-col justify-between text-left">
            <div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Current Partnership</div>
              <div className="text-sm font-bold text-foreground mt-0.5">
                {partnership.runs} <span className="text-[10px] text-muted-foreground font-normal">Runs off {partnership.balls} balls</span>
              </div>
            </div>
            {lastWktDetails && (
              <div className="border-t border-border/10 pt-2.5">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Last Wicket</div>
                <div className="text-xs font-semibold text-foreground mt-0.5 leading-tight">
                  {lastWktDetails.name} <span className="text-primary font-bold">{lastWktDetails.runs}</span> ({lastWktDetails.balls})
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                  {lastWktDetails.type} at {lastWktDetails.runsAtWicket}/{lastWktDetails.wicketsAtWicket} ({lastWktDetails.over} Ov)
                </div>
              </div>
            )}
          </div>

          {(() => {
            const ext = activeInnings?.extras || { wides: 0, noballs: 0, byes: 0, legbyes: 0, total: 0 };
            return (
              <div className="glass-card border border-border/40 rounded-2xl p-4 text-left">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold border-b border-border/10 pb-1.5 flex justify-between items-center">
                  <span>Extras</span>
                  <span className="text-primary font-bold">{ext.total}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-muted-foreground pt-2.5 font-medium">
                  <div>Wides: <span className="text-foreground font-bold">{ext.wides}</span></div>
                  <div>No Balls: <span className="text-foreground font-bold">{ext.noballs}</span></div>
                  <div>Byes: <span className="text-foreground font-bold">{ext.byes}</span></div>
                  <div>Leg Byes: <span className="text-foreground font-bold">{ext.legbyes}</span></div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Recent Overs Timeline */}
        {scoring.ballLog && scoring.ballLog.length > 0 && (
          <div className="border-t border-border/10 pt-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-bold text-left">Recent Overs</div>
            <div className="space-y-2">
              {getHistoricalOvers(scoring.ballLog).reverse().map((ov, idx) => (
                <div key={idx} className="glass-card border border-border/20 rounded-xl p-3 flex justify-between items-center hover:bg-white/5 transition text-left">
                  <div>
                    <div className="text-[10px] font-bold text-muted-foreground">OVER {ov.overNum}</div>
                    <div className="text-xs font-medium text-foreground">
                      Bowler: <span className="text-primary font-semibold">{findMatchPlayer(ov.bowlerId)?.name || "Unknown"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {ov.balls.map((b, bIdx) => (
                        <span
                          key={bIdx}
                          className={`h-6 w-6 rounded-full text-[10px] font-display font-semibold grid place-items-center ${getBallBadgeClass(b.outcome)}`}
                        >
                          {b.outcome}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs font-bold text-right min-w-12 text-primary">
                      {ov.runs} runs
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Wicket Setup Modal */}
      <Dialog open={isWicketOpen} onOpenChange={(open) => {
        setIsWicketOpen(open);
        if (!open) {
          setIsWicketNoBall(false);
          setWicketRuns(0);
          setWicketKind("wicket");
        }
      }}>
        <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl bg-elevated/90 backdrop-blur-xl animate-fade-up">
          <DialogTitle className="font-display text-xl mb-3 text-destructive border-b border-border/10 pb-3 flex items-center gap-1.5 font-bold">
            🏏 {wicketKind === "retired_hurt" ? "Retired Hurt Details" : wicketKind === "retired_out" ? "Retired Out Details" : wicketKind === "timedout" ? "Timed Out Details" : "Dismissal Details"}
          </DialogTitle>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Type</label>
              <select
                className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer font-semibold"
                value={dismissalType}
                disabled={isWicketNoBall || wicketKind !== "wicket"}
                onChange={(e) => {
                  const type = e.target.value as any;
                  setDismissalType(type);
                  if (type !== "runout") {
                    setDismissedBatterId(scoring.strikerId || "");
                  }
                }}
              >
                {wicketKind === "wicket" ? (
                  <>
                    <option value="caught">Caught</option>
                    <option value="bowled">Bowled</option>
                    <option value="lbw">LBW</option>
                    <option value="stumped">Stumped</option>
                    <option value="runout">Run Out</option>
                  </>
                ) : wicketKind === "timedout" ? (
                  <option value="timedout">Timed Out</option>
                ) : (
                  <option value="retired">Retired</option>
                )}
              </select>
            </div>

            {/* Selection of dismissed batter */}
            <div className="space-y-1 animate-fade-up">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Batter Leaving the Field</label>
              <select
                className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer font-medium"
                value={dismissedBatterId}
                onChange={(e) => setDismissedBatterId(e.target.value)}
              >
                <option value={scoring.strikerId}>Striker: {findMatchPlayer(scoring.strikerId)?.name}</option>
                <option value={scoring.nonStrikerId}>Non-striker: {findMatchPlayer(scoring.nonStrikerId)?.name}</option>
              </select>
            </div>

            {/* Run Out runs completed option */}
            {dismissalType === "runout" && wicketKind === "wicket" && (
              <div className="space-y-1 animate-fade-up">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Runs Completed Before Dismissal</label>
                <select
                  className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer font-medium"
                  value={wicketRuns}
                  onChange={(e) => setWicketRuns(parseInt(e.target.value, 10))}
                >
                  <option value={0}>0 runs completed</option>
                  <option value={1}>1 run completed</option>
                  <option value={2}>2 runs completed</option>
                  <option value={3}>3 runs completed</option>
                </select>
              </div>
            )}

            {/* Fielder assist selection for caught & runout */}
            {(dismissalType === "caught" || dismissalType === "runout") && wicketKind === "wicket" && (
              <div className="space-y-1 animate-fade-up">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  {dismissalType === "caught" ? "Caught By" : "Run Out By (Fielder)"}
                </label>
                <select
                  className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer font-medium"
                  value={fielderId}
                  onChange={(e) => setFielderId(e.target.value)}
                >
                  <option value="">Select Fielder</option>
                  {bowlers.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Selection of next batter */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Next Batter</label>
              {availableBatters.filter((p: any) => p.id !== scoring.strikerId && p.id !== scoring.nonStrikerId).length === 0 ? (
                <div className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 p-2.5 rounded-xl text-center font-semibold animate-pulse">
                  No more batters available (All Out)
                </div>
              ) : (
                <select
                  className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer font-medium"
                  value={newBatterId}
                  onChange={(e) => setNewBatterId(e.target.value)}
                >
                  <option value="" disabled>Select Next Batter</option>
                  {availableBatters
                    .filter((p: any) => p.id !== scoring.strikerId && p.id !== scoring.nonStrikerId)
                    .map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.role}
                      </option>
                    ))}
                </select>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-border/20">
              <Button variant="outline" onClick={() => setIsWicketOpen(false)} className="rounded-xl cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="lime"
                onClick={async () => {
                  const finalBatterId = newBatterId || "";
                  const totalRem = availableBatters.filter((p: any) => p.id !== scoring.strikerId && p.id !== scoring.nonStrikerId).length;
                  if (totalRem > 0 && !finalBatterId) {
                    toast.error("Please select the next batter.");
                    return;
                  }

                  if (wicketKind === "retired_hurt") {
                    await applyBall({
                      kind: "rare",
                      type: "Retired Hurt",
                      dismissedBatterId: dismissedBatterId || scoring.strikerId!,
                      newBatterId: finalBatterId,
                    });
                  } else if (wicketKind === "retired_out") {
                    await applyBall({
                      kind: "rare",
                      type: "Retired Out",
                      dismissedBatterId: dismissedBatterId || scoring.strikerId!,
                      newBatterId: finalBatterId,
                    });
                  } else if (wicketKind === "timedout") {
                    await applyBall({
                      kind: "rare",
                      type: "Timed Out",
                      dismissedBatterId: dismissedBatterId || scoring.strikerId!,
                      newBatterId: finalBatterId,
                    });
                  } else {
                    await applyBall({
                      kind: "wicket",
                      dismissalType,
                      dismissedBatterId: dismissedBatterId || scoring.strikerId!,
                      fielderId: (dismissalType === "caught" || dismissalType === "runout") ? fielderId : undefined,
                      newBatterId: finalBatterId,
                      runs: dismissalType === "runout" ? wicketRuns : 0,
                      isNoBall: isWicketNoBall,
                    });
                  }
                  setIsWicketOpen(false);
                  setIsWicketNoBall(false);
                  setWicketRuns(0);
                  setWicketKind("wicket");
                  toast.success("Wicket logged!");
                }}
                className="rounded-xl cursor-pointer shadow-glow font-bold"
              >
                Confirm Wicket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extras Selection Modal */}
      <Dialog open={extraType !== null} onOpenChange={(open) => { if (!open) setExtraType(null); }}>
        <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl bg-elevated/95 backdrop-blur-xl animate-fade-up">
          <DialogTitle className="font-display text-xl mb-3 text-primary border-b border-border/10 pb-3 flex items-center gap-1.5 font-bold uppercase tracking-wide">
            {extraType === "wide" && "🥎 Wide Ball Options"}
            {extraType === "noball" && "🚫 No Ball Options"}
            {extraType === "byes" && "🏃 Bye Options"}
            {extraType === "legbyes" && "🍗 Leg Bye Options"}
            {extraType === "rare" && "⭐ Special & Rare Outcomes"}
          </DialogTitle>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {extraType === "wide" && (
              <>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "wide", runs: 1 }); setExtraType(null); }}>WD (1 run)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "wide", runs: 2 }); setExtraType(null); }}>WD+1 (2 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "wide", runs: 3 }); setExtraType(null); }}>WD+2 (3 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "wide", runs: 4 }); setExtraType(null); }}>WD+3 (4 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl col-span-2" onClick={() => { applyBall({ kind: "wide", runs: 5 }); setExtraType(null); }}>WD+4 (Boundary, 5 runs)</Button>
              </>
            )}
            {extraType === "noball" && (
              <>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "noball", runs: 1 }); setExtraType(null); }}>NB (1 run)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "noball", runs: 2 }); setExtraType(null); }}>NB+1 (2 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "noball", runs: 3 }); setExtraType(null); }}>NB+2 (3 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "noball", runs: 4 }); setExtraType(null); }}>NB+3 (4 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "noball", runs: 5 }); setExtraType(null); }}>NB+4 (5 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "noball", runs: 7 }); setExtraType(null); }}>NB+6 (7 runs)</Button>
                <Button
                  variant="destructive"
                  className="h-12 text-sm font-bold rounded-xl col-span-2 bg-destructive/15 border border-destructive/25 hover:bg-destructive/25 text-destructive"
                  onClick={() => {
                    setDismissalType("runout");
                    setDismissedBatterId(scoring.strikerId || "");
                    setFielderId(bowlers.find((p: any) => p.id !== scoring.bowlerId)?.id || bowlers[0]?.id || "");
                    const nextBat = availableBatters.find((p: any) => p.id !== scoring.strikerId && p.id !== scoring.nonStrikerId);
                    setNewBatterId(nextBat?.id || "");
                    setIsWicketNoBall(true);
                    setWicketRuns(0);
                    setWicketKind("wicket");
                    setIsWicketOpen(true);
                    setExtraType(null);
                  }}
                >
                  NB + Run Out
                </Button>
              </>
            )}
            {extraType === "byes" && (
              <>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "bye", runs: 1 }); setExtraType(null); }}>B1 (1 run)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "bye", runs: 2 }); setExtraType(null); }}>B2 (2 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "bye", runs: 3 }); setExtraType(null); }}>B3 (3 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "bye", runs: 4 }); setExtraType(null); }}>B4 (4 runs)</Button>
              </>
            )}
            {extraType === "legbyes" && (
              <>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "legbye", runs: 1 }); setExtraType(null); }}>LB1 (1 run)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "legbye", runs: 2 }); setExtraType(null); }}>LB2 (2 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "legbye", runs: 3 }); setExtraType(null); }}>LB3 (3 runs)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl" onClick={() => { applyBall({ kind: "legbye", runs: 4 }); setExtraType(null); }}>LB4 (4 runs)</Button>
              </>
            )}
            {extraType === "rare" && (
              <>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl col-span-2" onClick={() => { applyBall({ kind: "rare", type: "5 Runs" }); setExtraType(null); }}>5 Runs (Legal Ball)</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl col-span-2" onClick={() => { applyBall({ kind: "rare", type: "5 Penalty Runs" }); setExtraType(null); }}>5 Penalty Runs</Button>
                <Button variant="outline" className="h-12 text-sm font-semibold rounded-xl col-span-2" onClick={() => { applyBall({ kind: "rare", type: "Dead Ball" }); setExtraType(null); }}>Dead Ball</Button>
                <Button
                  variant="destructive"
                  className="h-12 text-sm font-bold rounded-xl bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 text-destructive"
                  onClick={() => {
                    setDismissalType("retired");
                    setDismissedBatterId(scoring.strikerId || "");
                    const nextBat = availableBatters.find((p: any) => p.id !== scoring.strikerId && p.id !== scoring.nonStrikerId);
                    setNewBatterId(nextBat?.id || "");
                    setIsWicketNoBall(false);
                    setWicketRuns(0);
                    setWicketKind("retired_hurt");
                    setIsWicketOpen(true);
                    setExtraType(null);
                  }}
                >
                  Retired Hurt
                </Button>
                <Button
                  variant="destructive"
                  className="h-12 text-sm font-bold rounded-xl bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 text-destructive"
                  onClick={() => {
                    setDismissalType("retired");
                    setDismissedBatterId(scoring.strikerId || "");
                    const nextBat = availableBatters.find((p: any) => p.id !== scoring.strikerId && p.id !== scoring.nonStrikerId);
                    setNewBatterId(nextBat?.id || "");
                    setIsWicketNoBall(false);
                    setWicketRuns(0);
                    setWicketKind("retired_out");
                    setIsWicketOpen(true);
                    setExtraType(null);
                  }}
                >
                  Retired Out
                </Button>
                <Button
                  variant="destructive"
                  className="h-12 text-sm font-bold rounded-xl col-span-2 bg-destructive/15 border border-destructive/25 hover:bg-destructive/25 text-destructive"
                  onClick={() => {
                    setDismissalType("timedout");
                    setDismissedBatterId(scoring.strikerId || "");
                    const nextBat = availableBatters.find((p: any) => p.id !== scoring.strikerId && p.id !== scoring.nonStrikerId);
                    setNewBatterId(nextBat?.id || "");
                    setIsWicketNoBall(false);
                    setWicketRuns(0);
                    setWicketKind("timedout");
                    setIsWicketOpen(true);
                    setExtraType(null);
                  }}
                >
                  Timed Out
                </Button>
              </>
            )}
          </div>
          <div className="flex justify-end mt-4 pt-3 border-t border-border/15">
            <Button variant="outline" className="rounded-xl cursor-pointer" onClick={() => setExtraType(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Ball Modal */}
      <Dialog open={editingBallIndex !== null} onOpenChange={(open) => { if (!open) setEditingBallIndex(null); }}>
        <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl bg-elevated/95 backdrop-blur-xl animate-fade-up">
          <DialogTitle className="font-display text-xl mb-3 text-primary border-b border-border/10 pb-3 flex items-center gap-1.5 font-bold uppercase tracking-wide">
            ✏️ Edit Ball #{editingBallIndex !== null ? editingBallIndex + 1 : ""}
          </DialogTitle>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Outcome Label</label>
              <input
                type="text"
                className="w-full mt-1 glass-card border border-border/40 rounded-xl px-3 py-2 text-sm bg-[#11223b]/30 focus:outline-none focus:border-primary text-foreground font-semibold"
                value={editBallOutcome}
                onChange={(e) => setEditBallOutcome(e.target.value)}
                placeholder="e.g. 0, 1, WD, NB+1, W, LB2"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Runs Scored on this ball</label>
              <input
                type="number"
                className="w-full mt-1 glass-card border border-border/40 rounded-xl px-3 py-2 text-sm bg-[#11223b]/30 focus:outline-none focus:border-primary text-foreground font-semibold"
                value={editBallRuns}
                onChange={(e) => setEditBallRuns(parseInt(e.target.value, 10) || 0)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Dismissed Batter (if Wicket)</label>
              <select
                className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer font-medium"
                value={editBallDismissedId}
                onChange={(e) => setEditBallDismissedId(e.target.value)}
              >
                <option value="">None (Not a Wicket)</option>
                {matchPlayers.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-border/20">
              <Button variant="outline" onClick={() => setEditingBallIndex(null)} className="rounded-xl cursor-pointer">
                Cancel
              </Button>
              <Button
                variant="lime"
                className="rounded-xl cursor-pointer shadow-glow font-bold"
                onClick={async () => {
                  if (editingBallIndex !== null) {
                    await editBall(editingBallIndex, editBallOutcome, editBallRuns, editBallDismissedId || undefined);
                    setEditingBallIndex(null);
                    toast.success("Ball updated successfully!");
                  }
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Select<T extends { id: string; name: string; role: string }>({
  label,
  players,
  value,
  onChange,
  exclude = [],
}: {
  label: string;
  players: T[];
  value?: string;
  onChange: (v: string) => void;
  exclude?: (string | undefined)[];
}) {
  return (
    <div className="mb-3">
      <label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">{label}</label>
      <select
        className="w-full mt-1 glass-card border border-border/40 rounded-xl px-3 py-2.5 text-sm bg-surface-container font-semibold cursor-pointer focus:border-primary"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>Select Player</option>
        {players
          .filter((p) => !exclude.includes(p.id))
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.role}
            </option>
          ))}
      </select>
    </div>
  );
}
