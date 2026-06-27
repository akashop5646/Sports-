import { Link, useParams, useNavigate } from "react-router-dom";
import { AppShell, StatPill } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import {
  getTournament,
  getTournamentMatches,
  getPointsTable,
  getCertificates,
  getTournamentSquads,
  deleteTournament,
  removeTeamFromTournament,
  removePlayerFromTeam,
  updateTeamName,
} from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trophy, Award, Copy, Users, ChevronRight, Trash2, Edit3, Check, X, UserX } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";

export default function TournamentDetail() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useApp((s) => s.user);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "team" | "player";
    teamId: string;
    playerId?: string;
    label: string;
    description: string;
  }>({
    open: false,
    type: "team",
    teamId: "",
    label: "",
    description: "",
  });

  // Remove Team Mutation
  const removeTeamMutation = useMutation({
    mutationFn: (teamId: string) => removeTeamFromTournament({ data: { tournamentId: tournamentId!, teamId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournament-squads", tournamentId!] });
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId!] });
    },
  });

  // Remove Player Mutation
  const removePlayerMutation = useMutation({
    mutationFn: ({ teamId, playerId }: { teamId: string; playerId: string }) =>
      removePlayerFromTeam({ data: { teamId, playerId } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tournament-squads", tournamentId!] });
      queryClient.invalidateQueries({ queryKey: ["team-players", variables.teamId] });
    },
  });

  // Rename Team Mutation
  const renameTeamMutation = useMutation({
    mutationFn: ({ teamId, newName }: { teamId: string; newName: string }) =>
      updateTeamName({ data: { teamId, newName } }),
    onSuccess: () => {
      toast.success("Team name updated successfully!");
      setEditingTeamId(null);
      queryClient.invalidateQueries({ queryKey: ["tournament-squads", tournamentId!] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update team name.");
    },
  });

  const handleRemoveTeam = (teamId: string, teamName: string) => {
    setConfirmDialog({
      open: true,
      type: "team",
      teamId,
      label: `Remove "${teamName}"?`,
      description: `This will permanently delete the squad and all its players from this tournament. This action cannot be undone.`,
    });
  };

  const handleRemovePlayer = (teamId: string, playerId: string, playerName: string) => {
    setConfirmDialog({
      open: true,
      type: "player",
      teamId,
      playerId,
      label: `Remove ${playerName}?`,
      description: `${playerName} will be removed from the team roster.`,
    });
  };

  const handleConfirmAction = () => {
    const { type, teamId, playerId, label } = confirmDialog;
    setConfirmDialog((d) => ({ ...d, open: false }));
    if (type === "team") {
      toast.promise(
        removeTeamMutation.mutateAsync(teamId),
        {
          loading: "Removing team…",
          success: label.replace("?", "") + " removed from tournament.",
          error: (err) => err?.message || "Failed to remove team.",
        }
      );
    } else if (type === "player" && playerId) {
      toast.promise(
        removePlayerMutation.mutateAsync({ teamId, playerId }),
        {
          loading: "Removing player…",
          success: label.replace("?", "") + " removed from squad.",
          error: (err) => err?.message || "Failed to remove player.",
        }
      );
    }
  };

  const handleSaveTeamName = (teamId: string) => {
    if (!editingTeamName.trim()) {
      toast.error("Team name cannot be empty.");
      return;
    }
    renameTeamMutation.mutate({ teamId, newName: editingTeamName.trim() });
  };

  // Queries
  const { data: tournament, isLoading: loadingTournament } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournament({ data: tournamentId }),
  });

  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["tournament-matches", tournamentId],
    queryFn: () => getTournamentMatches({ data: tournamentId }),
    enabled: !!tournament,
  });

  const { data: table = [], isLoading: loadingTable } = useQuery({
    queryKey: ["points-table", tournamentId],
    queryFn: () => getPointsTable({ data: tournamentId }),
    enabled: !!tournament,
  });

  const { data: allCerts = [], isLoading: loadingCerts } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => getCertificates(),
  });

  const { data: squads = [], isLoading: loadingSquads } = useQuery({
    queryKey: ["tournament-squads", tournamentId],
    queryFn: () => getTournamentSquads({ data: tournamentId }),
    enabled: !!tournament,
  });

  useEffect(() => {
    if (tournament) {
      document.title = `${tournament.name} — Stadium Night`;
    } else {
      document.title = "Tournament Details — Stadium Night";
    }
  }, [tournament]);

  if (loadingTournament) {
    return (
      <AppShell title="Tournament">
        <div className="flex justify-center items-center py-24">
          <div className="h-10 w-10 rounded-full border-t-2 border-primary animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!tournament) {
    return (
      <AppShell title="Tournament Not Found">
        <div className="text-center py-24">
          <h2 className="font-display text-2xl text-destructive">Tournament Not Found</h2>
          <p className="text-muted-foreground text-sm mt-2">The tournament you are looking for does not exist.</p>
          <Link to="/tournaments" className="inline-block mt-4 text-primary hover:underline">Back to Tournaments</Link>
        </div>
      </AppShell>
    );
  }

  const isOrganizer = user && tournament && (tournament.organizerId === user.id || tournament.organizer === user.name);

  const certs = allCerts.filter((c: any) => c.tournamentId === tournamentId);

  // Helper to find player or team in tournament squads for certificates tab
  const findPlayerInSquads = (playerId?: string) => {
    if (!playerId) return null;
    for (const s of squads) {
      if (s.captain && s.captain.id === playerId) return s.captain;
      const found = s.players.find((p: any) => p.id === playerId);
      if (found) return found;
    }
    return null;
  };

  const findTeamInSquads = (teamId?: string) => {
    if (!teamId) return null;
    const found = squads.find((s: any) => s.team.id === teamId);
    return found ? found.team : null;
  };

  return (
    <>
    <AppShell title="Tournament">
      <div className="gradient-card border border-border rounded-2xl p-5 shadow-card">
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${
              tournament.status === "live"
                ? "bg-destructive/20 text-destructive"
                : tournament.status === "upcoming"
                  ? "bg-accent/20 text-accent"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {tournament.status}
          </span>
          {user && (tournament.organizerId === user.id || tournament.organizer === user.name) && tournament.code && (
            <span className="text-[10px] font-mono text-muted-foreground">Code: {tournament.code}</span>
          )}
        </div>
        <h1 className="font-display text-3xl mt-2">{tournament.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{tournament.description}</p>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <StatPill label="Format" value={tournament.format} />
          <StatPill label="Teams" value={tournament.teamIds?.length || 0} accent />
          <StatPill label="Prize" value={tournament.prizePool} />
        </div>
        {user && (tournament.organizerId === user.id || tournament.organizer === user.name) && tournament.code && (
          <div className="mt-4 flex gap-2">
            <Button
              variant="lime"
              size="sm"
              className="flex-1 cursor-pointer"
              onClick={() => {
                navigator.clipboard?.writeText(tournament.code);
                toast.success(`Invite Code copied: ${tournament.code}`);
              }}
            >
              <Copy className="h-4 w-4" /> Copy Tournament Code ({tournament.code})
            </Button>
          </div>
        )}

        {/* Cancel Tournament — creator only */}
        {user && (tournament.organizerId === user.id || tournament.organizer === user.name) && (
          <div className="mt-3">
            {!confirmCancel ? (
              <button
                onClick={() => setConfirmCancel(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-destructive/70 hover:text-destructive bg-destructive/5 hover:bg-destructive/10 border border-destructive/10 hover:border-destructive/20 transition cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" /> Cancel Tournament
              </button>
            ) : (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 space-y-2">
                <p className="text-xs text-destructive font-medium text-center">
                  This will permanently delete the tournament, all teams, matches, and certificates. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium bg-elevated hover:bg-muted border border-border transition cursor-pointer"
                  >
                    Keep it
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await deleteTournament({ data: tournamentId });
                        toast.success("Tournament cancelled and removed.");
                        queryClient.invalidateQueries({ queryKey: ["tournaments"] });
                        navigate("/tournaments", { replace: true });
                      } catch (err: any) {
                        toast.error(err.message || "Failed to cancel tournament.");
                      }
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition cursor-pointer"
                  >
                    Yes, Cancel & Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="fixtures" className="mt-6">
        <TabsList className="grid grid-cols-4 w-full bg-elevated">
          <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="awards">Awards</TabsTrigger>
          <TabsTrigger value="teams">Teams ({squads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="fixtures" className="grid gap-2 mt-4">
          {loadingMatches ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Loading fixtures…</div>
          ) : matches.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">No matches scheduled yet.</div>
          ) : (
            matches.map((m: any) => {
              const a = squads.find((s: any) => s.team.id === m.teamAId)?.team || { name: "Team A", shortName: "TMA", color: "#666" };
              const b = squads.find((s: any) => s.team.id === m.teamBId)?.team || { name: "Team B", shortName: "TMB", color: "#666" };
              return (
                <Link
                  key={m.id}
                  to={`/matches/${m.id}`}
                  className="bg-elevated border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/40 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {a.shortName} vs {b.shortName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.venue} · {m.date}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{m.resultText?.slice(0, 28)}</div>
                    <span
                      className={`text-[10px] uppercase tracking-wider font-bold ${
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
                </Link>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          {loadingTable ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Loading standings…</div>
          ) : table.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Standings will appear once matches begin.</div>
          ) : (
            <div className="bg-elevated border border-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <span>Team</span>
                <span>P</span>
                <span>W</span>
                <span>NRR</span>
                <span>Pts</span>
              </div>
              {table.map((row: any, i: number) => (
                <Link
                  key={row.team.id}
                  to={`/teams/${row.team.id}`}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-3 py-2.5 text-sm items-center border-b border-border/40 last:border-0 hover:bg-muted/40 transition"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-4">{i + 1}</span>
                    <span
                      className="h-6 w-6 rounded grid place-items-center text-[10px] font-bold"
                      style={{ backgroundColor: row.team.color, color: "#0A1628" }}
                    >
                      {row.team.shortName.slice(0, 2)}
                    </span>
                    <span className="truncate">{row.team.name}</span>
                  </span>
                  <span>{row.played}</span>
                  <span>{row.wins}</span>
                  <span className={row.nrr >= 0 ? "text-success" : "text-destructive"}>
                    {row.nrr.toFixed(2)}
                  </span>
                  <span className="font-bold">{row.points}</span>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="awards" className="grid gap-2 mt-4">
          {loadingCerts ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Loading awards…</div>
          ) : certs.length === 0 ? (
            <div className="text-muted-foreground text-sm text-center py-8">
              Awards generated once tournament completes.
            </div>
          ) : (
            certs.map((c: any) => {
              const target = c.playerId ? findPlayerInSquads(c.playerId) : findTeamInSquads(c.teamId);
              return (
                <Link
                  key={c.id}
                  to="/certificates"
                  className="gradient-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/40 transition"
                >
                  <div className="h-12 w-12 rounded-xl bg-primary/15 grid place-items-center">
                    <Award className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-lg">{c.type}</div>
                    <div className="text-xs text-muted-foreground truncate">{target?.name || "Player/Team"}</div>
                  </div>
                  <Trophy className="h-5 w-5 text-primary" />
                </Link>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="teams" className="grid gap-4 mt-4">
          {loadingSquads ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Loading teams & squads…</div>
          ) : squads.length === 0 ? (
            <div className="text-muted-foreground text-sm text-center py-8">
              No teams have joined this tournament yet.
            </div>
          ) : (
            squads.map(({ team, captain, players }: any) => {
              const isTeamCaptain = user && team.captainId === user.playerId;
              return (
                <div
                  key={team.id}
                  className="gradient-card border border-border/40 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-border/40 pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-xl grid place-items-center font-display text-sm font-bold shadow-md"
                        style={{ backgroundColor: team.color, color: "#0A1628" }}
                      >
                        {team.shortName.slice(0, 2)}
                      </div>
                      <div>
                        {editingTeamId === team.id ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="text"
                              className="glass-card border border-border/40 rounded-lg px-2 py-1 text-sm bg-[#11223b] font-medium focus:outline-none focus:border-primary/60 text-foreground"
                              value={editingTeamName}
                              onChange={(e) => setEditingTeamName(e.target.value)}
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveTeamName(team.id)}
                              disabled={renameTeamMutation.isPending}
                              className="h-8 w-8 rounded-lg bg-primary/20 text-primary border border-primary/30 grid place-items-center cursor-pointer hover:bg-primary/30 transition shrink-0"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingTeamId(null)}
                              className="h-8 w-8 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 grid place-items-center cursor-pointer hover:bg-destructive/20 transition shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              to={`/teams/${team.id}`}
                              className="font-display text-lg hover:text-primary transition flex items-center gap-1"
                            >
                              {team.name} <ChevronRight className="h-4 w-4" />
                            </Link>
                            {isTeamCaptain && (
                              <button
                                onClick={() => {
                                  setEditingTeamId(team.id);
                                  setEditingTeamName(team.name);
                                }}
                                className="p-1 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-primary transition cursor-pointer"
                                title="Edit Team Name"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">{team.city}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-mono bg-white/5 border border-border/40 px-2 py-1 rounded">
                        {players.length} players
                      </span>
                      {isOrganizer && (
                        <button
                          onClick={() => handleRemoveTeam(team.id, team.name)}
                          disabled={removeTeamMutation.isPending}
                          className="p-1.5 rounded-lg bg-destructive/15 hover:bg-destructive/25 text-destructive border border-destructive/10 hover:border-destructive/30 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove Team from Tournament"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Captain */}
                  {captain && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full gradient-lime grid place-items-center font-display text-xs text-primary-foreground font-bold">
                          {captain.initials || "C"}
                        </div>
                        <div>
                          <Link
                            to={`/players/${captain.id}`}
                            className="text-xs font-semibold text-foreground hover:underline"
                          >
                            {captain.name}
                          </Link>
                          <div className="text-[10px] text-primary font-bold uppercase tracking-wider mt-0.5">
                            Team Captain
                          </div>
                        </div>
                      </div>
                      <Trophy className="h-4 w-4 text-primary" />
                    </div>
                  )}

                  {/* Squad List */}
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Players Squad
                    </div>
                    {players.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No players in squad yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {players.map((p: any) => {
                          const isCaptainPlayer = p.id === team.captainId;
                          return (
                            <div
                              key={p.id}
                              className="bg-elevated/40 border border-border/40 rounded-xl p-2.5 flex items-center justify-between gap-2 transition hover:border-border/60"
                            >
                              <Link
                                to={`/players/${p.id}`}
                                className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-85"
                              >
                                <div className="h-7 w-7 rounded-full bg-accent/15 text-accent grid place-items-center font-display text-[10px] font-bold shrink-0">
                                  {p.initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate">{p.name}</div>
                                  <div className="text-[9px] text-muted-foreground truncate">{p.role}</div>
                                </div>
                              </Link>
                              {isTeamCaptain && !isCaptainPlayer && (
                                <button
                                  onClick={() => handleRemovePlayer(team.id, p.id, p.name)}
                                  disabled={removePlayerMutation.isPending}
                                  className="p-1.5 rounded-lg bg-destructive/15 hover:bg-destructive/25 text-destructive border border-destructive/10 hover:border-destructive/30 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                  title="Remove Player from Team"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </AppShell>

    {/* Centered Confirm Dialog */}
    <AlertDialog
      open={confirmDialog.open}
      onOpenChange={(open) => setConfirmDialog((d) => ({ ...d, open }))}
    >
      <AlertDialogContent className="glass-card border border-destructive/30 rounded-2xl shadow-2xl max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-lg text-foreground flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {confirmDialog.label}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {confirmDialog.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="rounded-xl border border-border/40 bg-elevated/40 hover:bg-elevated text-foreground">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmAction}
            className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
          >
            Yes, Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
