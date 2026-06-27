import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useApp, type BallOutcome } from "@/lib/store";
import { useQuery } from "@/hooks/useApi";
import { getMatch, getTeam, getTeamPlayers, getScoring } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Undo2, Flag } from "lucide-react";
import { toast } from "sonner";

export default function Scoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  // Queries
  const { data: match, isLoading: loadingMatch } = useQuery({
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
  const applyBall = useApp((s) => s.applyBall);
  const endInnings = useApp((s) => s.endInnings);
  const finishMatch = useApp((s) => s.finishMatch);

  // Pickers state
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");

  const started = scoring.matchId === matchId;

  useEffect(() => {
    document.title = "Scoring — Stadium Night";
  }, []);

  // Restore session from DB on load
  useEffect(() => {
    if (scoringDb && scoring.matchId !== matchId) {
      setScoringState(scoringDb);
    }
  }, [scoringDb, scoring.matchId, matchId, setScoringState]);

  // Set default picker selections once rosters are loaded
  useEffect(() => {
    if (match && teamAPlayers.length > 0 && teamBPlayers.length > 0 && !started) {
      const battingTeamId =
        match.tossDecision === "bat"
          ? match.tossWinnerId!
          : match.tossWinnerId === match.teamAId
            ? match.teamBId
            : match.teamAId;

      const battingRoster = battingTeamId === match.teamAId ? teamAPlayers : teamBPlayers;
      const bowlingRoster = battingTeamId === match.teamAId ? teamBPlayers : teamAPlayers;

      if (battingRoster[0]) setStriker(battingRoster[0].id);
      if (battingRoster[1]) setNonStriker(battingRoster[1].id);
      
      const defaultBowler = bowlingRoster.find((p: any) => p.role !== "Batter") || bowlingRoster[0];
      if (defaultBowler) setBowler(defaultBowler.id);
    }
  }, [match, teamAPlayers, teamBPlayers, started]);

  if (loadingMatch || loadingScoringDb || loadingTeamA || loadingTeamB || loadingPlayersA || loadingPlayersB) {
    return (
      <AppShell title="Live Scoring">
        <div className="flex justify-center items-center py-24">
          <div className="h-10 w-10 rounded-full border-t-2 border-primary animate-spin" />
        </div>
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

  const a = teamA || { id: match.teamAId, name: "Team A", shortName: "TMA" };
  const b = teamB || { id: match.teamBId, name: "Team B", shortName: "TMB" };

  const battingTeamId =
    scoring.matchId === matchId && scoring.battingTeamId
      ? scoring.battingTeamId
      : match.tossDecision === "bat"
        ? match.tossWinnerId!
        : match.tossWinnerId === match.teamAId
          ? match.teamBId
          : match.teamAId;

  const bowlingTeamId = battingTeamId === a.id ? b.id : a.id;

  const battingTeam = battingTeamId === a.id ? a : b;
  const bowlingTeam = bowlingTeamId === a.id ? a : b;

  const batters = battingTeamId === a.id ? teamAPlayers : teamBPlayers;
  const bowlers = battingTeamId === a.id ? teamBPlayers : teamAPlayers;

  const matchPlayers = [...teamAPlayers, ...teamBPlayers];
  const findMatchPlayer = (pid?: string) => {
    if (!pid) return null;
    return matchPlayers.find((p: any) => p.id === pid);
  };

  if (!started) {
    return (
      <AppShell title="Playing XI">
        <h1 className="font-display text-2xl mb-1">{battingTeam.name} to bat</h1>
        <p className="text-sm text-muted-foreground mb-4">Pick striker, non-striker and opening bowler.</p>

        <Select
          label="Striker"
          players={batters}
          value={striker}
          onChange={setStriker}
          exclude={[nonStriker]}
        />
        <Select
          label="Non-striker"
          players={batters}
          value={nonStriker}
          onChange={setNonStriker}
          exclude={[striker]}
        />
        <Select label="Bowler" players={bowlers} value={bowler} onChange={setBowler} />

        <Button
          variant="lime"
          size="lg"
          className="w-full mt-4 cursor-pointer"
          disabled={!striker || !nonStriker || !bowler}
          onClick={async () => {
            await startScoring(matchId!, striker, nonStriker, bowler, battingTeamId, bowlingTeamId);
            toast.success("Match started");
          }}
        >
          Start innings
        </Button>
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

  const btn = (label: string, outcome: BallOutcome, classes = "glass-card hover:bg-white/10") => (
    <button
      onClick={async () => {
        await applyBall(outcome);
      }}
      className={`h-14 rounded-xl border border-border/40 font-display text-xl transition-all duration-200 active:scale-95 cursor-pointer ${classes}`}
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
        <div className="text-sm text-muted-foreground">
          {battingTeam.name} · {oversStr} ov · RR {rr}
        </div>
        {targetText && <div className="text-xs text-primary mt-1">{targetText}</div>}
        <div className="grid grid-cols-2 gap-2 mt-4 text-left border-t border-border/40 pt-4">
          <div className="text-xs">
            <span className="text-muted-foreground">Striker</span>
            <div className="font-medium text-foreground">{findMatchPlayer(scoring.strikerId)?.name || "Batter"}*</div>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Non-striker</span>
            <div className="font-medium text-foreground">{findMatchPlayer(scoring.nonStrikerId)?.name || "Batter"}</div>
          </div>
          <div className="text-xs col-span-2 mt-1">
            <span className="text-muted-foreground">Bowler</span>
            <div className="font-medium text-foreground">{findMatchPlayer(scoring.bowlerId)?.name || "Bowler"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-5">
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
        {btn(
          "W",
          { kind: "wicket" },
          "bg-destructive/20 border-destructive/40 hover:bg-destructive/30 text-destructive font-bold",
        )}
        {btn("Wd", { kind: "wide" })}
        {btn("Nb", { kind: "noball" })}
        {btn("B", { kind: "bye", runs: 1 })}
        {btn("Lb", { kind: "legbye", runs: 1 })}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <Button
          variant="hero"
          className="cursor-pointer"
          onClick={async () => {
            await applyBall({ kind: "undo" });
          }}
        >
          <Undo2 className="h-4 w-4" /> Undo
        </Button>
        {chaseDone || (inningsDone && scoring.inningsIndex === 1) ? (
          <Button
            variant="lime"
            className="cursor-pointer"
            onClick={async () => {
              await finishMatch();
              toast.success("Match finished");
              navigate(`/matches/${matchId}`);
            }}
          >
            <Flag className="h-4 w-4" /> Finish match
          </Button>
        ) : inningsDone ? (
          <Button
            variant="lime"
            className="cursor-pointer"
            onClick={async () => {
              await endInnings();
              toast.success("Innings ended");
            }}
          >
            End innings
          </Button>
        ) : (
          <Button
            variant="hero"
            className="cursor-pointer"
            onClick={async () => {
              await endInnings();
              toast("Innings ended");
            }}
          >
            Declare
          </Button>
        )}
      </div>

      <div className="mt-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">This over</div>
        <div className="flex gap-2 flex-wrap">
          {scoring.ballLog && scoring.ballLog.slice(-12).map((l: any, i: number) => (
            <div
              key={i}
              className={`h-9 w-9 rounded-full grid place-items-center font-display text-sm ${
                l.outcome === "W"
                  ? "bg-destructive text-destructive-foreground"
                  : l.outcome === "6"
                    ? "gradient-lime text-primary-foreground"
                    : l.outcome === "4"
                      ? "bg-accent text-accent-foreground"
                      : "glass-card border border-border/40"
              }`}
            >
              {l.outcome}
            </div>
          ))}
        </div>
      </div>
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
      <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
      <select
        className="w-full mt-1 glass-card border border-border/40 rounded-xl px-3 py-2.5 text-sm bg-surface-container"
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
