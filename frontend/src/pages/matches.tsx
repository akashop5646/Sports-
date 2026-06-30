import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@/hooks/useApi";
import { getMatches, getTeams } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect } from "react";
import { CricketLoading } from "@/components/CricketLoading";
import { useApp } from "@/lib/store";

export default function MatchesPage() {
  useEffect(() => {
    document.title = "Matches — CreaseLive";
  }, []);

  const user = useApp((s) => s.user);
  const userTeamId = user?.teamId;

  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["matches"],
    queryFn: () => getMatches(),
  });

  const { data: teams = [], isLoading: loadingTeams } = useQuery({
    queryKey: ["teams"],
    queryFn: () => getTeams(),
  });

  const filteredMatches = userTeamId
    ? matches.filter((m: any) => m.teamAId === userTeamId || m.teamBId === userTeamId)
    : matches;

  const live = filteredMatches.filter((m: any) => m.status === "live");
  const up = filteredMatches.filter((m: any) => m.status === "upcoming");
  const done = filteredMatches.filter((m: any) => m.status === "completed");

  const findTeamInList = (teamId: string) =>
    teams.find((t: any) => t.id === teamId) || { shortName: "UNK", name: "Unknown Team", id: teamId, color: "#666" };

  const isLoading = loadingMatches || loadingTeams;

  const List = ({ items }: { items: any[] }) => {
    if (items.length === 0) {
      return (
        <div className="text-muted-foreground text-sm text-center py-12">
          No matches in this category.
        </div>
      );
    }
    return (
      <div className="grid gap-2 mt-4">
        {items.slice(0, 40).map((m: any) => {
          const a = findTeamInList(m.teamAId);
          const b = findTeamInList(m.teamBId);
          const aI = m.innings?.find((i: any) => i.battingTeamId === a.id);
          const bI = m.innings?.find((i: any) => i.battingTeamId === b.id);
          return (
            <Link
              key={m.id}
              to={`/matches/${m.id}`}
              className="bg-elevated border border-border rounded-xl p-3 hover:border-primary/40 transition"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{m.venue}</span>
                <span
                  className={`uppercase font-bold ${
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
  };

  return (
    <AppShell title="Matches">
      {isLoading ? (
        <CricketLoading />
      ) : (
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
      )}
    </AppShell>
  );
}
