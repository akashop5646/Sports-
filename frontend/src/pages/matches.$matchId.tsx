import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { findTeam, findPlayer } from "@/lib/mockdb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { TossModal } from "@/components/TossModal";

export const Route = createFileRoute("/matches/$matchId")({
  head: ({ params }) => ({ meta: [{ title: `Match ${params.matchId} — Stadium Night` }] }),
  component: MatchDetail,
});

function MatchDetail() {
  const { matchId } = Route.useParams();
  const match = useApp((s) => s.matches.find((m) => m.id === matchId));
  const navigate = useNavigate();
  const [tossOpen, setTossOpen] = useState(false);

  if (!match) throw notFound();
  const a = findTeam(match.teamAId)!,
    b = findTeam(match.teamBId)!;

  return (
    <AppShell title="Match">
      <div className="gradient-card border border-border rounded-2xl p-5 shadow-card">
        <div className="text-xs text-muted-foreground">
          {match.venue} · {match.date}
        </div>
        {match.innings.map((inn, i) => {
          const t = findTeam(inn.battingTeamId)!;
          return (
            <div key={i} className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg grid place-items-center font-display"
                  style={{ backgroundColor: t.color, color: "#0A1628" }}
                >
                  {t.shortName.slice(0, 2)}
                </div>
                <div>
                  <div className="font-display text-lg">{t.shortName}</div>
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
        {match.innings.length === 0 && (
          <div className="flex items-center justify-between mt-3">
            <div className="font-display text-2xl">
              {a.shortName} vs {b.shortName}
            </div>
            <span className="text-xs text-accent uppercase font-bold">Upcoming</span>
          </div>
        )}
        <div className="text-sm text-primary mt-3">{match.resultText}</div>
        {match.motmId && (
          <div className="text-xs text-muted-foreground mt-1">
            Player of the Match: {findPlayer(match.motmId)?.name}
          </div>
        )}

        {match.status === "upcoming" && (
          <Button
            variant="lime"
            size="sm"
            className="w-full mt-4"
            onClick={() => setTossOpen(true)}
          >
            Start Match — Toss
          </Button>
        )}
        {match.status === "live" && (
          <Button
            variant="lime"
            size="sm"
            className="w-full mt-4"
            onClick={() => navigate({ to: "/matches/$matchId/score", params: { matchId } })}
          >
            Open Scoring
          </Button>
        )}
      </div>

      <TossModal
        matchId={matchId}
        open={tossOpen}
        onOpenChange={setTossOpen}
        onTossCompleted={() => {
          navigate({ to: "/matches/$matchId/score", params: { matchId } });
        }}
      />

      {match.innings.length > 0 && (
        <Tabs defaultValue="scorecard" className="mt-6">
          <TabsList className="grid grid-cols-3 w-full bg-elevated">
            <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
            <TabsTrigger value="bowling">Bowling</TabsTrigger>
            <TabsTrigger value="commentary">Commentary</TabsTrigger>
          </TabsList>
          <TabsContent value="scorecard" className="mt-4 grid gap-4">
            {match.innings.map((inn, i) => (
              <div key={i} className="bg-elevated border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground border-b border-border">
                  {findTeam(inn.battingTeamId)!.name} — {inn.runs}/{inn.wickets} ({inn.overs})
                </div>
                {inn.batters
                  .filter((b) => b.balls > 0)
                  .slice(0, 11)
                  .map((b) => (
                    <Link
                      key={b.playerId}
                      to="/players/$playerId"
                      params={{ playerId: b.playerId }}
                      className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 text-xs items-center border-b border-border/40 last:border-0 hover:bg-muted/40"
                    >
                      <span className="truncate">
                        {findPlayer(b.playerId)?.name}
                        <span className="text-muted-foreground"> {b.dismissal ?? "not out"}</span>
                      </span>
                      <span className="font-bold">{b.runs}</span>
                      <span className="text-muted-foreground">{b.balls}b</span>
                      <span className="text-muted-foreground">{b.fours}×4</span>
                      <span className="text-muted-foreground">{b.sixes}×6</span>
                    </Link>
                  ))}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="bowling" className="mt-4 grid gap-4">
            {match.innings.map((inn, i) => (
              <div key={i} className="bg-elevated border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 text-xs uppercase tracking-widest text-muted-foreground border-b border-border">
                  Bowling — {findTeam(inn.bowlingTeamId)!.name}
                </div>
                {inn.bowlers.map((bw) => (
                  <div
                    key={bw.playerId}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 text-xs border-b border-border/40 last:border-0"
                  >
                    <span className="truncate">{findPlayer(bw.playerId)?.name}</span>
                    <span>{bw.overs}</span>
                    <span>{bw.runs}r</span>
                    <span className="font-bold">{bw.wickets}w</span>
                    <span className="text-muted-foreground">{bw.economy}</span>
                  </div>
                ))}
              </div>
            ))}
          </TabsContent>
          <TabsContent value="commentary" className="mt-4 grid gap-2">
            {match.commentary.map((c, i) => (
              <div
                key={i}
                className={`border border-border rounded-xl p-3 ${c.wicket ? "bg-destructive/10 border-destructive/40" : "bg-elevated"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{c.over}</span>
                  {c.runs !== undefined && (
                    <span className="text-xs font-bold text-primary">{c.runs}</span>
                  )}
                </div>
                <div className="text-sm mt-1">{c.text}</div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}
