import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp, type BallOutcome } from "@/lib/store";
import { findTeam, teamPlayers, findPlayer } from "@/lib/mockdb";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Undo2, Flag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/matches/$matchId/score")({
  head: () => ({ meta: [{ title: "Scoring — Stadium Night" }] }),
  component: Scoring,
});

function Scoring() {
  const { matchId } = Route.useParams();
  const match = useApp((s) => s.matches.find((m) => m.id === matchId));
  const scoring = useApp((s) => s.scoring);
  const startScoring = useApp((s) => s.startScoring);
  const applyBall = useApp((s) => s.applyBall);
  const endInnings = useApp((s) => s.endInnings);
  const finishMatch = useApp((s) => s.finishMatch);
  const navigate = useNavigate();

  if (!match) throw notFound();
  const battingTeam = findTeam(
    scoring.matchId === matchId && scoring.battingTeamId
      ? scoring.battingTeamId
      : match.tossDecision === "bat"
        ? match.tossWinnerId!
        : match.tossWinnerId === match.teamAId
          ? match.teamBId
          : match.teamAId,
  )!;
  const bowlingTeam = findTeam(battingTeam.id === match.teamAId ? match.teamBId : match.teamAId)!;
  const batters = teamPlayers(battingTeam.id);
  const bowlers = teamPlayers(bowlingTeam.id);

  const [striker, setStriker] = useState(batters[0]?.id);
  const [nonStriker, setNonStriker] = useState(batters[1]?.id);
  const [bowler, setBowler] = useState(
    bowlers.find((p) => p.role !== "Batter")?.id || bowlers[0]?.id,
  );

  const started = scoring.matchId === matchId;

  useEffect(() => {
    if (!started && match.status === "live") {
      // nothing — wait for user to confirm XI
    }
  }, [started, match.status]);

  if (!started) {
    return (
      <AppShell title="Playing XI">
        <h1 className="font-display text-2xl mb-1">{battingTeam.name} to bat</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Pick striker, non-striker and opening bowler.
        </p>

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
          className="w-full mt-4"
          onClick={() => {
            startScoring(matchId, striker!, nonStriker!, bowler!);
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
    ? `Target ${scoring.target} · Need ${Math.max(0, scoring.target - scoring.runs)} off ${match.overs * 6 - scoring.totalBalls}`
    : null;
  const chaseDone = scoring.target && scoring.runs >= scoring.target;
  const inningsDone = scoring.totalBalls >= match.overs * 6 || scoring.wickets >= 10;

  const btn = (label: string, outcome: BallOutcome, classes = "glass-card hover:bg-white/10") => (
    <button
      onClick={() => applyBall(outcome)}
      className={`h-14 rounded-xl border border-border/40 font-display text-xl transition-all duration-200 active:scale-95 ${classes}`}
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
            <div className="font-medium text-foreground">{findPlayer(scoring.strikerId)?.name}*</div>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Non-striker</span>
            <div className="font-medium text-foreground">{findPlayer(scoring.nonStrikerId)?.name}</div>
          </div>
          <div className="text-xs col-span-2 mt-1">
            <span className="text-muted-foreground">Bowler</span>
            <div className="font-medium text-foreground">{findPlayer(scoring.bowlerId)?.name}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-5">
        {btn("0", { kind: "runs", runs: 0 })}
        {btn("1", { kind: "runs", runs: 1 })}
        {btn("2", { kind: "runs", runs: 2 })}
        {btn("3", { kind: "runs", runs: 3 })}
        {btn("4", { kind: "runs", runs: 4 }, "bg-accent/20 border-accent/40 hover:bg-accent/30 text-accent font-bold shadow-[0_0_10px_rgba(0,209,255,0.1)]")}
        {btn("5", { kind: "runs", runs: 5 })}
        {btn("6", { kind: "runs", runs: 6 }, "gradient-lime text-primary-foreground font-bold shadow-[0_0_10px_rgba(195,244,0,0.2)]")}
        {btn("W", { kind: "wicket" }, "bg-destructive/20 border-destructive/40 hover:bg-destructive/30 text-destructive font-bold")}
        {btn("Wd", { kind: "wide" })}
        {btn("Nb", { kind: "noball" })}
        {btn("B", { kind: "bye", runs: 1 })}
        {btn("Lb", { kind: "legbye", runs: 1 })}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2">
        <Button variant="hero" onClick={() => applyBall({ kind: "undo" })}>
          <Undo2 className="h-4 w-4" /> Undo
        </Button>
        {chaseDone || (inningsDone && scoring.inningsIndex === 1) ? (
          <Button
            variant="lime"
            onClick={() => {
              finishMatch();
              toast.success("Match finished");
              navigate({ to: "/matches/$matchId", params: { matchId } });
            }}
          >
            <Flag className="h-4 w-4" /> Finish match
          </Button>
        ) : inningsDone ? (
          <Button
            variant="lime"
            onClick={() => {
              endInnings();
              toast.success("Innings ended");
            }}
          >
            End innings
          </Button>
        ) : (
          <Button
            variant="hero"
            onClick={() => {
              endInnings();
              toast("Innings ended");
            }}
          >
            Declare
          </Button>
        )}
      </div>

      <div className="mt-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
          This over
        </div>
        <div className="flex gap-2 flex-wrap">
          {scoring.ballLog.slice(-12).map((l, i) => (
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

