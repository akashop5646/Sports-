import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { findPlayer, findTeam, findTournament } from "@/lib/mockdb";
import { Award, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/certificates")({
  head: () => ({ meta: [{ title: "Certificates — Stadium Night" }] }),
  component: Certificates,
});

function Certificates() {
  const certs = useApp((s) => s.certificates);
  return (
    <AppShell title="Certificates">
      <div className="grid gap-3">
        {certs.map((c) => {
          const t = findTournament(c.tournamentId);
          const target = c.playerId ? findPlayer(c.playerId) : findTeam(c.teamId);
          return (
            <div
              key={c.id}
              className="gradient-card border border-border rounded-2xl p-5 shadow-card"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl gradient-lime grid place-items-center">
                  <Award className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-widest text-primary font-bold">
                    {c.type}
                  </div>
                  <div className="font-display text-xl mt-0.5 truncate">{target?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t?.name} · {c.issuedOn}
                  </div>
                </div>
              </div>
              <Button
                variant="hero"
                size="sm"
                className="w-full mt-3"
                onClick={() => toast.success("Certificate downloaded (demo)")}
              >
                <Download className="h-4 w-4" /> Download PDF
              </Button>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
