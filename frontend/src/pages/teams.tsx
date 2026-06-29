import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useQuery } from "@/hooks/useApi";
import { getTeams } from "@/lib/api";
import { useApp } from "@/lib/store";
import { Trophy } from "lucide-react";
import { useEffect } from "react";
import { CricketLoading } from "@/components/CricketLoading";

export default function TeamsList() {
  const user = useApp((s) => s.user);

  useEffect(() => {
    document.title = "Teams — Stadium Night";
  }, []);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => getTeams(),
  });

  const joinedTeams = user?.playerId
    ? teams.filter((t: any) => t.playerIds?.includes(user.playerId))
    : [];

  return (
    <AppShell title="Teams">
      {isLoading ? (
        <CricketLoading />
      ) : joinedTeams.length === 0 ? (
        <div className="text-muted-foreground text-sm text-center py-12">
          No joined teams found. Use "Create" or "Join" to register or enter one.
        </div>
      ) : (
        <div className="grid gap-2">
          {joinedTeams.map((t: any) => (
            <Link
              key={t.id}
              to={`/teams/${t.id}`}
              className="gradient-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/40 transition"
            >
              <div
                className="h-14 w-14 rounded-xl grid place-items-center font-display text-2xl"
                style={{ backgroundColor: t.color || "oklch(0.85 0.18 75)", color: "#0A1628" }}
              >
                {t.shortName.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t.city} · {t.playerIds?.length || 0} players · NRR {(t.nrr || 0).toFixed(2)}
                </div>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1 text-primary text-sm font-bold">
                  <Trophy className="h-3.5 w-3.5" />
                  {t.trophies || 0}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  W {t.wins || 0} · L {t.losses || 0}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
