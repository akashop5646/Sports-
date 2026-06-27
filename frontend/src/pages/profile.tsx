import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, StatPill } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { findPlayer, findTeam, DB } from "@/lib/mockdb";
import { Button } from "@/components/ui/button";
import { Award, LogOut, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Stadium Night" }] }),
  component: Profile,
});

function Profile() {
  const user = useApp((s) => s.user);
  const signOut = useApp((s) => s.signOut);
  const setAuthModalOpen = useApp((s) => s.setAuthModalOpen);

  if (!user) {
    return (
      <AppShell title="Profile">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Sign in to view your profile.</p>
          <Button variant="lime" onClick={() => setAuthModalOpen(true)}>
            Sign in
          </Button>
        </div>
      </AppShell>
    );
  }

  const p = findPlayer(user.playerId);
  const team = findTeam(user.teamId);
  const certs = DB.certificates.filter((c) => c.playerId === user.playerId);

  return (
    <AppShell title="Profile">
      <div className="gradient-card border border-border rounded-2xl p-5 shadow-card text-center">
        <div className="h-20 w-20 rounded-full gradient-lime grid place-items-center font-display text-3xl text-primary-foreground mx-auto">
          {user.avatar}
        </div>
        <h1 className="font-display text-2xl mt-3">{user.name}</h1>
        <div className="text-xs text-muted-foreground">{user.email}</div>
        {team && (
          <Link
            to="/teams/$teamId"
            params={{ teamId: team.id }}
            className="inline-flex items-center gap-1 text-primary text-sm mt-2"
          >
            {team.name} <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {p && (
        <div className="grid grid-cols-4 gap-2 mt-4">
          <StatPill label="M" value={p.stats.matches} />
          <StatPill label="Runs" value={p.stats.runs} accent />
          <StatPill label="Wkts" value={p.stats.wickets} />
          <StatPill label="HS" value={p.stats.highScore} />
        </div>
      )}

      <h2 className="font-display text-2xl mt-6 mb-3">My certificates</h2>
      <div className="grid gap-2">
        {certs.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No certificates yet — win a tournament!
          </div>
        )}
        {certs.map((c) => (
          <Link
            key={c.id}
            to="/certificates"
            className="bg-elevated border border-border rounded-xl p-3 flex items-center gap-3"
          >
            <Award className="h-5 w-5 text-primary" />
            <span className="flex-1">{c.type}</span>
            <span className="text-xs text-muted-foreground">{c.issuedOn}</span>
          </Link>
        ))}
      </div>

      <Button variant="hero" className="w-full mt-6" onClick={() => signOut()}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </AppShell>
  );
}
