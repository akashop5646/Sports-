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

  const { data: teamAPlayers = [], isLoading: loadingPlayersA } = useQuery({
    queryKey: ["team-players", match?.teamAId],
    queryFn: () => getTeamPlayers({ data: match?.teamAId }),
    enabled: !!match,
  });

  const { data: teamBPlayers = [], isLoading: loadingPlayersB } = useQuery({
    queryKey: ["team-players", match?.teamBId],
    queryFn: () => getTeamPlayers({ data: match?.teamBId }),
    enabled: !!match,
  });

  // Zustand Store
  const scoring = useApp((s) => s.scoring);
  const setScoringState = useApp((s) => s.setScoringState);
  const startScoring = useApp((s) => s.startScoring);
  const setInningsLineup = useApp((s) => s.setInningsLineup);
  const applyBall = useApp((s) => s.applyBall);
  const endInnings = useApp((s) => s.endInnings);
  const finishMatch = useApp((s) => s.finishMatch);

  // Pickers state
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");

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
  const [dismissalType, setDismissalType] = useState<"bowled" | "caught" | "lbw" | "stumped" | "runout">("caught");
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
    return matchPlayers.find((p: any) => p.id === pid);
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

  return (
    <AppShell title="Live Scoring">
      <div className="glass-card border border-border/40 rounded-2xl p-5 shadow-card text-center neon-glow-primary">
        <div className="text-xs uppercase tracking-widest text-destructive font-bold flex items-center justify-center gap-1.5 live-pulse">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          Live · Innings {scoring.inningsIndex + 1}
        </div>
        <div className="font-display text-6xl mt-2">
          {scoring.runs}
          <span className="text-3xl text-muted-foreground">/{scoring.wickets}</span>
        </div>
        <div className="text-sm text-muted-foreground font-medium mt-1">
          {currentBattingTeam.name} vs {currentBowlingTeam.name}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 font-semibold">
          {oversStr} overs · RR {rr}
        </div>
        {targetText && <div className="text-xs text-primary mt-1 font-bold">{targetText}</div>}
        
        {/* Batsman & Bowlers Display with Manual Strike Rotation */}
        <div className="grid grid-cols-[2fr_1fr_2fr] gap-2 mt-4 text-left border-t border-border/40 pt-4 items-center">
          <div className="text-xs">
            <span className="text-muted-foreground uppercase text-[9px] tracking-wider font-bold">Striker</span>
            <div className="font-medium text-foreground truncate">{findMatchPlayer(scoring.strikerId)?.name || "Batter"}*</div>
          </div>
          <div className="text-center">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[10px] rounded-lg border-border/40 text-muted-foreground hover:text-foreground cursor-pointer shadow-sm font-semibold"
              onClick={async () => {
                await applyBall({ kind: "swap_strike" });
                toast.success("Strike rotated");
              }}
              title="Rotate Strike"
            >
              ⇄ Strike
            </Button>
          </div>
          <div className="text-xs text-right">
            <span className="text-muted-foreground uppercase text-[9px] tracking-wider font-bold">Non-striker</span>
            <div className="font-medium text-foreground truncate">{findMatchPlayer(scoring.nonStrikerId)?.name || "Batter"}</div>
          </div>
          <div className="text-xs col-span-3 mt-2 border-t border-border/5 pt-2 flex justify-between items-center">
            <div>
              <span className="text-muted-foreground uppercase text-[9px] tracking-wider font-bold block">Bowler</span>
              <span className="font-medium text-foreground text-xs">{findMatchPlayer(scoring.bowlerId)?.name || "Bowler"}</span>
            </div>
            {scoring.needsNewBowler && (
              <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 font-bold animate-pulse">
                Over Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* New Over Setup Card when over is completed */}
      {scoring.needsNewBowler && !isInningsOver ? (
        <div className="glass-card border border-primary/30 bg-primary/5 rounded-2xl p-5 shadow-glow text-center my-4 animate-fade-up">
          <h2 className="font-display text-lg text-primary flex items-center justify-center gap-1.5 font-bold">
            ⚡ Over Completed!
          </h2>
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
              className="w-full cursor-pointer font-bold shadow-glow"
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
          
          {/* Custom Wicket Button trigger */}
          <button
            onClick={() => {
              setDismissalType("caught");
              setDismissedBatterId(scoring.strikerId || "");
              setFielderId(bowlers.find((p: any) => p.id !== scoring.bowlerId)?.id || bowlers[0]?.id || "");
              const nextBat = availableBatters.find((p: any) => p.id !== scoring.strikerId && p.id !== scoring.nonStrikerId);
              setNewBatterId(nextBat?.id || "");
              setIsWicketOpen(true);
            }}
            disabled={scoring.needsNewBowler || isInningsOver}
            className="h-14 rounded-xl border border-destructive/40 bg-destructive/20 hover:bg-destructive/30 text-destructive font-bold font-display text-xl transition-all duration-200 active:scale-95 cursor-pointer disabled:opacity-30"
          >
            W
          </button>
          
          {btn("Wd", { kind: "wide" })}
          {btn("Nb", { kind: "noball" })}
          {btn("B", { kind: "bye", runs: 1 })}
          {btn("Lb", { kind: "legbye", runs: 1 })}
        </div>
      )}

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

      <div className="mt-5 animate-fade-up">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">This over</div>
        <div className="flex gap-2 flex-wrap">
          {scoring.ballLog && scoring.ballLog.slice(-12).map((l: any, i: number) => (
            <div
              key={i}
              className={`h-9 w-9 rounded-full grid place-items-center font-display text-sm ${
                l.outcome === "W"
                  ? "bg-destructive text-destructive-foreground font-bold shadow-glow"
                  : l.outcome === "6"
                    ? "gradient-lime text-primary-foreground font-bold"
                    : l.outcome === "4"
                      ? "bg-accent text-accent-foreground font-bold"
                      : "glass-card border border-border/40 text-xs"
              }`}
              title={`Batter: ${findMatchPlayer(l.strikerId)?.name || 'N/A'}`}
            >
              {l.outcome}
            </div>
          ))}
        </div>
      </div>

      {/* Wicket Setup Modal */}
      <Dialog open={isWicketOpen} onOpenChange={setIsWicketOpen}>
        <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl bg-elevated/90 backdrop-blur-xl animate-fade-up">
          <DialogTitle className="font-display text-xl mb-3 text-destructive border-b border-border/10 pb-3 flex items-center gap-1.5 font-bold">
            🏏 Dismissal Details
          </DialogTitle>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Wicket Type</label>
              <select
                className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer font-semibold"
                value={dismissalType}
                onChange={(e) => {
                  const type = e.target.value as any;
                  setDismissalType(type);
                  // Bowled, LBW, Stumped always dismisses the striker.
                  if (type !== "runout") {
                    setDismissedBatterId(scoring.strikerId || "");
                  }
                }}
              >
                <option value="caught">Caught</option>
                <option value="bowled">Bowled</option>
                <option value="lbw">LBW</option>
                <option value="stumped">Stumped</option>
                <option value="runout">Run Out</option>
              </select>
            </div>

            {/* Run Out selection for striker or non-striker */}
            {dismissalType === "runout" && (
              <div className="space-y-1 animate-fade-up">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Dismissed Batter</label>
                <select
                  className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer font-medium"
                  value={dismissedBatterId}
                  onChange={(e) => setDismissedBatterId(e.target.value)}
                >
                  <option value={scoring.strikerId}>Striker: {findMatchPlayer(scoring.strikerId)?.name}</option>
                  <option value={scoring.nonStrikerId}>Non-striker: {findMatchPlayer(scoring.nonStrikerId)?.name}</option>
                </select>
              </div>
            )}

            {/* Fielder assist selection for caught & runout */}
            {(dismissalType === "caught" || dismissalType === "runout") && (
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
                  await applyBall({
                    kind: "wicket",
                    dismissalType,
                    dismissedBatterId: dismissedBatterId || scoring.strikerId!,
                    fielderId: (dismissalType === "caught" || dismissalType === "runout") ? fielderId : undefined,
                    newBatterId: finalBatterId,
                  });
                  setIsWicketOpen(false);
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
