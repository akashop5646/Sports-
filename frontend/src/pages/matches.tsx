import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { findTeam } from "@/lib/mockdb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/matches")({
  head: () => ({ meta: [{ title: "Matches — Stadium Night" }] }),
  component: MatchesPage,
});

function MatchesPage() {
  const matches = useApp((s) => s.matches);
  const live = matches.filter((m) => m.status === "live");
  const up = matches.filter((m) => m.status === "upcoming");
  const done = matches.filter((m) => m.status === "completed");

  const List = ({ items }: { items: typeof matches }) => (
    <div className="grid gap-2 mt-4">
      {items.slice(0, 40).map((m) => {
        const a = findTeam(m.teamAId)!,
          b = findTeam(m.teamBId)!;
        const aI = m.innings.find((i) => i.battingTeamId === a.id);
        const bI = m.innings.find((i) => i.battingTeamId === b.id);
        return (
          <Link
            key={m.id}
            to="/matches/$matchId"
            params={{ matchId: m.id }}
            className="bg-elevated border border-border rounded-xl p-3 hover:border-primary/40 transition"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{m.venue}</span>
              <span
                className={`uppercase font-bold ${m.status === "live" ? "text-destructive" : m.status === "upcoming" ? "text-accent" : "text-primary"}`}
              >
                {m.status}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="font-medium">{a.shortName}</span>
              <span className="font-display">
                {aI ? `${aI.runs}/${aI.wickets} (${aI.overs})` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-medium">{b.shortName}</span>
              <span className="font-display">
                {bI ? `${bI.runs}/${bI.wickets} (${bI.overs})` : "—"}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">{m.resultText}</div>
          </Link>
        );
      })}
    </div>
  );

  return (
    <AppShell title="Matches">
      <Tabs defaultValue="live">
        <TabsList className="grid grid-cols-3 w-full bg-elevated">
          <TabsTrigger value="live">Live ({live.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({up.length})</TabsTrigger>
          <TabsTrigger value="done">Past ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="live">
          <List items={live} />
        </TabsContent>
        <TabsContent value="upcoming">
          <List items={up} />
        </TabsContent>
        <TabsContent value="done">
          <List items={done} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
