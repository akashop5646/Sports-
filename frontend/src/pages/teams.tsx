import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, SectionTitle } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/teams")({
  head: () => ({ meta: [{ title: "Teams — Stadium Night" }] }),
  component: TeamsList,
});

function TeamsList() {
  const teams = useApp((s) => s.teams);
  return (
    <AppShell title="Teams">
      <div className="grid gap-2">
        {teams.map((t) => (
          <Link
            key={t.id}
            to="/teams/$teamId"
            params={{ teamId: t.id }}
            className="gradient-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/40 transition"
          >
            <div
              className="h-14 w-14 rounded-xl grid place-items-center font-display text-2xl"
              style={{ backgroundColor: t.color, color: "#0A1628" }}
            >
              {t.shortName.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-lg truncate">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {t.city} · {t.playerIds.length} players · NRR {t.nrr.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 text-primary text-sm font-bold">
                <Trophy className="h-3.5 w-3.5" />
                {t.trophies}
              </div>
              <div className="text-[10px] text-muted-foreground">
                W {t.wins} · L {t.losses}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
