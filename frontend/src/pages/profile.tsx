import { Link } from "react-router-dom";
import { AppShell, StatPill } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useQuery } from "@/hooks/useApi";
import { getPlayer, getTeam, getPlayerCertificates } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Award, LogOut, ChevronRight } from "lucide-react";
import { useEffect } from "react";

export default function Profile() {
  const user = useApp((s) => s.user);
  const signOut = useApp((s) => s.signOut);
  const setAuthModalOpen = useApp((s) => s.setAuthModalOpen);

  useEffect(() => {
    document.title = "Profile — Stadium Night";
  }, []);

  // Queries
  const { data: p, isLoading: loadingPlayer } = useQuery({
    queryKey: ["player", user?.playerId],
    queryFn: () => getPlayer({ data: user?.playerId }),
    enabled: !!user && !!user.playerId,
  });

  const { data: team, isLoading: loadingTeam } = useQuery({
    queryKey: ["team", user?.teamId],
    queryFn: () => getTeam({ data: user?.teamId }),
    enabled: !!user && !!user.teamId,
  });

  const { data: certs = [], isLoading: loadingCerts } = useQuery({
    queryKey: ["player-certs", user?.playerId],
    queryFn: () => getPlayerCertificates({ data: user?.playerId }),
    enabled: !!user && !!user.playerId,
  });

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

  const isLoading = loadingPlayer || loadingTeam || loadingCerts;

  return (
    <AppShell title="Profile">
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <div className="h-8 w-8 rounded-full border-t-2 border-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="gradient-card border border-border rounded-2xl p-5 shadow-card text-center">
            <div className="h-20 w-20 rounded-full gradient-lime grid place-items-center font-display text-3xl text-primary-foreground mx-auto font-bold animate-scale-in">
              {user.avatar}
            </div>
            <h1 className="font-display text-2xl mt-3">{user.name}</h1>
            <div className="text-xs text-muted-foreground">{user.email}</div>
            {team ? (
              <Link
                to={`/teams/${team.id}`}
                className="inline-flex items-center gap-1 text-primary text-sm mt-2 font-medium hover:underline"
              >
                {team.name} <ChevronRight className="h-3 w-3" />
              </Link>
            ) : (
              <div className="text-xs text-muted-foreground/60 mt-2">No active team registered</div>
            )}
          </div>

          {p && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              <StatPill label="M" value={p.stats?.matches || 0} />
              <StatPill label="Runs" value={p.stats?.runs || 0} accent />
              <StatPill label="Wkts" value={p.stats?.wickets || 0} />
              <StatPill label="HS" value={p.stats?.highScore || 0} />
            </div>
          )}

          <h2 className="font-display text-2xl mt-6 mb-3">My certificates</h2>
          <div className="grid gap-2">
            {certs.length === 0 && (
              <div className="text-sm text-muted-foreground py-4">
                No certificates yet — win a tournament!
              </div>
            )}
            {certs.map((c: any) => (
              <Link
                key={c.id}
                to="/certificates"
                className="bg-elevated border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition"
              >
                <Award className="h-5 w-5 text-primary" />
                <span className="flex-1 text-sm font-medium">{c.type}</span>
                <span className="text-xs text-muted-foreground">{c.issuedOn}</span>
              </Link>
            ))}
          </div>

          <Button variant="hero" className="w-full mt-6 cursor-pointer" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </>
      )}
    </AppShell>
  );
}
