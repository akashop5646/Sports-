import { Link, useParams } from "react-router-dom";
import { AppShell, StatPill } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getTeam, getTeamPlayers, getMatches, updateTeamName } from "@/lib/api";
import { useApp } from "@/lib/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Copy, Trophy, Edit3, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function TeamDetail() {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const user = useApp((s) => s.user);

  // Queries
  const { data: team, isLoading: loadingTeam } = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => getTeam({ data: teamId }),
  });

  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: () => getTeamPlayers({ data: teamId }),
    enabled: !!team,
  });

  const { data: allMatches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["matches"],
    queryFn: () => getMatches(),
  });

  // Edit Team Name State
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (team) {
      document.title = `${team.name} — Stadium Night`;
      setNewName(team.name);
    } else {
      document.title = "Team Details — Stadium Night";
    }
  }, [team]);

  // Rename Mutation
  const renameMutation = useMutation({
    mutationFn: (name: string) => updateTeamName({ data: { teamId: teamId!, newName: name } }),
    onSuccess: () => {
      toast.success("Team name updated successfully!");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["team", teamId!] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update team name.");
    },
  });

  if (loadingTeam) {
    return (
      <AppShell title="Team">
        <div className="flex justify-center items-center py-24">
          <div className="h-10 w-10 rounded-full border-t-2 border-primary animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!team) {
    return (
      <AppShell title="Team Not Found">
        <div className="text-center py-24">
          <h2 className="font-display text-2xl text-destructive">Team Not Found</h2>
          <p className="text-muted-foreground text-sm mt-2">The team you are looking for does not exist.</p>
          <Link to="/teams" className="inline-block mt-4 text-primary hover:underline">Back to Teams</Link>
        </div>
      </AppShell>
    );
  }

  const isCaptain = user && team.captainId === user.playerId;

  const recent = allMatches
    .filter((m: any) => (m.teamAId === teamId || m.teamBId === teamId) && m.status === "completed")
    .slice(0, 8);

  const handleSave = () => {
    if (!newName.trim()) {
      toast.error("Team name cannot be empty.");
      return;
    }
    renameMutation.mutate(newName.trim());
  };

  return (
    <AppShell title="Team">
      <div className="gradient-card border border-border rounded-2xl p-5 shadow-card">
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-xl grid place-items-center font-display text-3xl shrink-0"
            style={{ backgroundColor: team.color || "oklch(0.85 0.18 75)", color: "#0A1628" }}
          >
            {team.shortName.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="text"
                  className="glass-card border border-border/40 rounded-lg px-2 py-1 text-sm bg-surface-container font-medium w-full focus:outline-none focus:border-primary/60"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <button
                  onClick={handleSave}
                  disabled={renameMutation.isPending}
                  className="h-8 w-8 rounded-lg bg-primary/20 text-primary border border-primary/30 grid place-items-center cursor-pointer hover:bg-primary/30 transition shrink-0"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setNewName(team.name);
                  }}
                  className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 grid place-items-center cursor-pointer hover:bg-destructive/20 transition shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl truncate">{team.name}</h1>
                {isCaptain && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition cursor-pointer"
                    title="Edit Team Name"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-0.5">
              {team.city} · Est. {team.founded}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 text-primary font-bold">
              <Trophy className="h-4 w-4" />
              {team.trophies || 0}
            </div>
            {isCaptain && (
              <div className="text-[9px] uppercase tracking-wider text-primary font-semibold mt-1">
                Captain View
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
          <StatPill label="P" value={team.matches || 0} />
          <StatPill label="W" value={team.wins || 0} accent />
          <StatPill label="L" value={team.losses || 0} />
          <StatPill label="NRR" value={(team.nrr || 0).toFixed(2)} />
        </div>
        {isCaptain && (
          <Button
            variant="lime"
            size="sm"
            className="w-full mt-4 cursor-pointer"
            onClick={() => {
              navigator.clipboard?.writeText(team.code);
              toast.success(`Invite Code copied: ${team.code}`);
            }}
          >
            <Copy className="h-4 w-4" /> Share Team Invite Code ({team.code})
          </Button>
        )}
      </div>

      <Tabs defaultValue="squad" className="mt-6">
        <TabsList className="grid grid-cols-2 w-full bg-elevated">
          <TabsTrigger value="squad">Squad ({players.length})</TabsTrigger>
          <TabsTrigger value="matches">Recent ({recent.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="squad" className="grid gap-2 mt-4">
          {loadingPlayers ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Loading squad…</div>
          ) : players.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground italic">
              No players have joined this team squad yet. Share the code above to invite them!
            </div>
          ) : (
            players.map((p: any) => (
              <Link
                key={p.id}
                to={`/players/${p.id}`}
                className="bg-elevated border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition"
              >
                <div className="h-10 w-10 rounded-full bg-primary/15 grid place-items-center font-display text-sm text-primary">
                  {p.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.name} <span className="text-muted-foreground text-xs">#{p.jersey}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.role} · {p.battingStyle}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-bold">
                    {p.stats?.runs || 0} <span className="text-muted-foreground font-normal">runs</span>
                  </div>
                  <div className="text-muted-foreground">{p.stats?.wickets || 0} wkts</div>
                </div>
              </Link>
            ))
          )}
        </TabsContent>
        <TabsContent value="matches" className="grid gap-2 mt-4">
          {loadingMatches ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Loading matches…</div>
          ) : recent.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground italic">
              No matches played yet in the tournament.
            </div>
          ) : (
            recent.map((m: any) => {
              const opponentName = m.teamAId === teamId
                ? (allMatches.find((t: any) => t.id === m.teamBId)?.name || "Opponent")
                : (allMatches.find((t: any) => t.id === m.teamAId)?.name || "Opponent");
              return (
                <Link
                  key={m.id}
                  to={`/matches/${m.id}`}
                  className="bg-elevated border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      vs {opponentName}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.resultText}</div>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold ${
                      m.winnerId === team.id ? "text-success" : "text-destructive"
                    }`}
                  >
                    {m.winnerId === team.id ? "Won" : "Lost"}
                  </span>
                </Link>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
