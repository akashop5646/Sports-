import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell, SectionTitle, StatPill } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { findTeam, findPlayer, pointsTable, tournamentMatches } from "@/lib/mockdb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Share2, Trophy, Award, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/tournaments/$tournamentId")({
  head: ({ params }) => ({
    meta: [{ title: `Tournament ${params.tournamentId} — Stadium Night` }],
  }),
  component: TournamentDetail,
});

function TournamentDetail() {
  const { tournamentId } = Route.useParams();
  const tournament = useApp((s) => s.tournaments.find((t) => t.id === tournamentId));
  if (!tournament) throw notFound();
  const matches = tournamentMatches(tournamentId);
  const table = pointsTable(tournamentId);
  const certs = useApp((s) => s.certificates.filter((c) => c.tournamentId === tournamentId));

  return (
    <AppShell title="Tournament">
      <div className="gradient-card border border-border rounded-2xl p-5 shadow-card">
        <div className="text-[10px] uppercase tracking-widest text-primary font-bold">
          {tournament.status}
        </div>
        <h1 className="font-display text-3xl mt-1">{tournament.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{tournament.description}</p>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <StatPill label="Format" value={tournament.format} />
          <StatPill label="Teams" value={tournament.teamIds.length} accent />
          <StatPill label="Prize" value={tournament.prizePool} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="lime"
            size="sm"
            className="flex-1"
            onClick={() => {
              navigator.clipboard?.writeText(tournament.code);
              toast.success(`Code copied: ${tournament.code}`);
            }}
          >
            <Copy className="h-4 w-4" /> Share code {tournament.code}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="fixtures" className="mt-6">
        <TabsList className="grid grid-cols-4 w-full bg-elevated">
          <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="awards">Awards</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
        </TabsList>

        <TabsContent value="fixtures" className="grid gap-2 mt-4">
          {matches.map((m) => {
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
                  <div className="text-sm font-medium">
                    {a.shortName} vs {b.shortName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.venue} · {m.date}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">{m.resultText?.slice(0, 28)}</div>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-bold ${
                      m.status === "live"
                        ? "text-destructive"
                        : m.status === "upcoming"
                          ? "text-accent"
                          : "text-primary"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
              </Link>
            );
          })}
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <div className="bg-elevated border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <span>Team</span>
              <span>P</span>
              <span>W</span>
              <span>NRR</span>
              <span>Pts</span>
            </div>
            {table.map((row, i) => (
              <Link
                key={row.team.id}
                to="/teams/$teamId"
                params={{ teamId: row.team.id }}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2.5 text-sm items-center border-b border-border/40 last:border-0 hover:bg-muted/40 transition"
              >
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs w-4">{i + 1}</span>
                  <span
                    className="h-6 w-6 rounded grid place-items-center text-[10px] font-bold"
                    style={{ backgroundColor: row.team.color, color: "#0A1628" }}
                  >
                    {row.team.shortName.slice(0, 2)}
                  </span>
                  <span className="truncate">{row.team.name}</span>
                </span>
                <span>{row.played}</span>
                <span>{row.wins}</span>
                <span className={row.nrr >= 0 ? "text-success" : "text-destructive"}>
                  {row.nrr.toFixed(2)}
                </span>
                <span className="font-bold">{row.points}</span>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="awards" className="grid gap-2 mt-4">
          {certs.length === 0 && (
            <div className="text-muted-foreground text-sm text-center py-8">
              Awards generated once tournament completes.
            </div>
          )}
          {certs.map((c) => {
            const target = c.playerId ? findPlayer(c.playerId) : findTeam(c.teamId);
            return (
              <Link
                key={c.id}
                to="/certificates"
                className="gradient-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 transition"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/15 grid place-items-center">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-lg">{c.type}</div>
                  <div className="text-xs text-muted-foreground truncate">{target?.name}</div>
                </div>
                <Trophy className="h-5 w-5 text-primary" />
              </Link>
            );
          })}
        </TabsContent>

        <TabsContent value="teams" className="grid gap-2 mt-4">
          {tournament.teamIds.map((tid) => {
            const team = findTeam(tid)!;
            return (
              <Link
                key={tid}
                to="/teams/$teamId"
                params={{ teamId: tid }}
                className="bg-elevated border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition"
              >
                <div
                  className="h-10 w-10 rounded-lg grid place-items-center font-display"
                  style={{ backgroundColor: team.color, color: "#0A1628" }}
                >
                  {team.shortName.slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{team.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {team.city} · {team.playerIds.length} players
                  </div>
                </div>
              </Link>
            );
          })}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
