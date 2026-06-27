import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, StatPill } from "@/components/AppShell";
import { findTeam, teamPlayers, DB } from "@/lib/mockdb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/teams/$teamId")({
  head: ({ params }) => ({ meta: [{ title: `Team ${params.teamId} — Stadium Night` }] }),
  component: TeamDetail,
});

function TeamDetail() {
  const { teamId } = Route.useParams();
  const team = findTeam(teamId);
  if (!team) throw notFound();
  const players = teamPlayers(teamId);
  const recent = DB.matches
    .filter((m) => (m.teamAId === teamId || m.teamBId === teamId) && m.status === "completed")
    .slice(0, 8);

  return (
    <AppShell title="Team">
      <div className="gradient-card border border-border rounded-2xl p-5 shadow-card">
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-xl grid place-items-center font-display text-3xl"
            style={{ backgroundColor: team.color, color: "#0A1628" }}
          >
            {team.shortName.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl truncate">{team.name}</h1>
            <div className="text-xs text-muted-foreground">
              {team.city} · Est. {team.founded}
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-1 text-primary font-bold">
              <Trophy className="h-4 w-4" />
              {team.trophies}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
          <StatPill label="P" value={team.matches} />
          <StatPill label="W" value={team.wins} accent />
          <StatPill label="L" value={team.losses} />
          <StatPill label="NRR" value={team.nrr.toFixed(2)} />
        </div>
        <Button
          variant="lime"
          size="sm"
          className="w-full mt-4"
          onClick={() => {
            navigator.clipboard?.writeText(team.code);
            toast.success(`Code copied: ${team.code}`);
          }}
        >
          <Copy className="h-4 w-4" /> Share code {team.code}
        </Button>
      </div>

      <Tabs defaultValue="squad" className="mt-6">
        <TabsList className="grid grid-cols-2 w-full bg-elevated">
          <TabsTrigger value="squad">Squad ({players.length})</TabsTrigger>
          <TabsTrigger value="matches">Recent ({recent.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="squad" className="grid gap-2 mt-4">
          {players.map((p) => (
            <Link
              key={p.id}
              to="/players/$playerId"
              params={{ playerId: p.id }}
              className="bg-elevated border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition"
            >
              <div className="h-10 w-10 rounded-full bg-primary/15 grid place-items-center font-display text-sm text-primary">
                {p.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {p.name} <span className="text-muted-foreground text-xs">#{p.jersey}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.role} · {p.battingStyle}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="font-bold">
                  {p.stats.runs} <span className="text-muted-foreground font-normal">runs</span>
                </div>
                <div className="text-muted-foreground">{p.stats.wickets} wkts</div>
              </div>
            </Link>
          ))}
        </TabsContent>
        <TabsContent value="matches" className="grid gap-2 mt-4">
          {recent.map((m) => {
            const a = findTeam(m.teamAId)!,
              b = findTeam(m.teamBId)!;
            return (
              <Link
                key={m.id}
                to="/matches/$matchId"
                params={{ matchId: m.id }}
                className="bg-elevated border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    {a.shortName} vs {b.shortName}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.resultText}</div>
                </div>
                <span
                  className={`text-[10px] uppercase font-bold ${m.winnerId === team.id ? "text-success" : "text-destructive"}`}
                >
                  {m.winnerId === team.id ? "Won" : "Lost"}
                </span>
              </Link>
            );
          })}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
