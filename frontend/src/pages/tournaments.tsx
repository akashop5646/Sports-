import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, SectionTitle } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, MapPin, Calendar } from "lucide-react";

export const Route = createFileRoute("/tournaments")({
  head: () => ({
    meta: [
      { title: "Tournaments — Stadium Night" },
      { name: "description", content: "Browse live, upcoming and completed cricket tournaments." },
    ],
  }),
  component: TournamentsPage,
});

function TournamentsPage() {
  const tournaments = useApp((s) => s.tournaments);
  const live = tournaments.filter((t) => t.status === "live");
  const upcoming = tournaments.filter((t) => t.status === "upcoming");
  const completed = tournaments.filter((t) => t.status === "completed");

  return (
    <AppShell title="Tournaments">
      <Tabs defaultValue="live" className="w-full">
        <TabsList className="grid grid-cols-3 w-full bg-elevated">
          <TabsTrigger value="live">Live ({live.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="completed">Past ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="live">
          <List items={live} />
        </TabsContent>
        <TabsContent value="upcoming">
          <List items={upcoming} />
        </TabsContent>
        <TabsContent value="completed">
          <List items={completed} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function List({ items }: { items: ReturnType<typeof useApp.getState>["tournaments"] }) {
  if (items.length === 0)
    return (
      <div className="text-muted-foreground text-sm text-center py-12">
        No tournaments here yet.
      </div>
    );
  return (
    <div className="grid gap-3 mt-4">
      {items.map((t) => (
        <Link
          key={t.id}
          to="/tournaments/$tournamentId"
          params={{ tournamentId: t.id }}
          className="gradient-card border border-border rounded-2xl p-4 hover:border-primary/40 transition"
        >
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/15 grid place-items-center">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-display text-lg truncate">{t.name}</div>
                <span
                  className={`text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${
                    t.status === "live"
                      ? "bg-destructive/20 text-destructive"
                      : t.status === "upcoming"
                        ? "bg-accent/20 text-accent"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {t.city}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t.startDate.slice(0, 7)}
                </span>
                <span>
                  {t.format} · {t.teamIds.length} teams
                </span>
              </div>
              <div className="text-xs text-primary mt-2 font-medium">Prize: {t.prizePool}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
