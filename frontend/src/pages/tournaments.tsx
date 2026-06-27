import { Link } from "react-router-dom";
import { AppShell, SectionTitle } from "@/components/AppShell";
import { useQuery } from "@/hooks/useApi";
import { getTournaments } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, MapPin, Calendar } from "lucide-react";
import { useEffect } from "react";

export default function TournamentsPage() {
  useEffect(() => {
    document.title = "Tournaments — Stadium Night";
  }, []);

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => getTournaments(),
  });

  const live = tournaments.filter((t: any) => t.status === "live");
  const upcoming = tournaments.filter((t: any) => t.status === "upcoming");
  const completed = tournaments.filter((t: any) => t.status === "completed");

  return (
    <AppShell title="Tournaments">
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="h-8 w-8 rounded-full border-t-2 border-primary animate-spin" />
        </div>
      ) : (
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
      )}
    </AppShell>
  );
}

function List({ items }: { items: any[] }) {
  if (items.length === 0)
    return (
      <div className="text-muted-foreground text-sm text-center py-12">
        No tournaments here yet.
      </div>
    );
  return (
    <div className="grid gap-3 mt-4">
      {items.map((t, i) => (
        <Link
          key={t.id}
          to={`/tournaments/${t.id}`}
          className="gradient-card border border-border rounded-2xl p-4 hover:border-primary/40 transition-all duration-300 hover:scale-[1.01] hover:shadow-card animate-fade-up tap-scale"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/15 grid place-items-center shrink-0">
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
                  {t.startDate?.slice(0, 7)}
                </span>
                <span>
                  {t.format} · {t.teamIds?.length || 0} teams
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
