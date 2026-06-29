import { Link, useParams, useNavigate } from "react-router-dom";
import { AppShell, StatPill } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { CricketLoading, useLoadingState } from "@/components/CricketLoading";
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
  updateTournamentRoadmap,
} from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  // Schedule match states
  const createMatchAction = useApp((s) => s.createMatch);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [schedTeamA, setSchedTeamA] = useState("");
  const [schedTeamB, setSchedTeamB] = useState("");
  const [schedOvers, setSchedOvers] = useState<number | "">(20);
  const [schedVenue, setSchedVenue] = useState("Local Ground");
  const [schedUmpires, setSchedUmpires] = useState<string[]>([]);
  const [schedNodeId, setSchedNodeId] = useState("");
  const [scheduling, setScheduling] = useState(false);

  // Roadmap actions
  const [savingRoadmap, setSavingRoadmap] = useState(false);

  const handleSaveRoadmap = async (newRoadmap: any) => {
    setSavingRoadmap(true);
    try {
      await updateTournamentRoadmap({
        data: {
          tournamentId: tournamentId!,
          roadmap: newRoadmap,
        }
      });
      toast.success("Tournament roadmap updated!");
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId!] });
    } catch (e: any) {
      toast.error(e.message || "Failed to update roadmap.");
    } finally {
      setSavingRoadmap(false);
    }
  };

  const handleScheduleMatch = async () => {
    if (!schedTeamA || !schedTeamB) {
      toast.error("Please select both teams.");
      return;
    }
    if (schedTeamA === schedTeamB) {
      toast.error("A team cannot play against itself.");
      return;
    }
    setScheduling(true);
    try {
      const id = await createMatchAction({
        tournamentId: tournamentId!,
        teamAId: schedTeamA,
        teamBId: schedTeamB,
        overs: Number(schedOvers) || 20,
        venue: schedVenue.trim() || "Local Ground",
        umpireIds: isTwoTeams ? [] : schedUmpires,
        nodeId: schedNodeId || undefined,
      });
      toast.success(isTwoTeams ? "Match started!" : "Match scheduled successfully!");
      setIsScheduleOpen(false);
      setSchedTeamA("");
      setSchedTeamB("");
      setSchedUmpires([]);
      setSchedNodeId("");
      queryClient.invalidateQueries({ queryKey: ["tournament-matches", tournamentId!] });
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId!] });
      if (isTwoTeams) {
        navigate(`/matches/${id}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to schedule match.");
    } finally {
      setScheduling(false);
    }
  };

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

  // Get all unique players from squads to choose umpires
  const allPlayers = squads.flatMap((s: any) => [
    ...(s.captain ? [s.captain] : []),
    ...(s.players || [])
  ]);
  const uniquePlayers = Array.from(new Map(allPlayers.map((p: any) => [p.id, p])).values());

  const getPlayerTeamName = (playerId: string) => {
    const squad = squads.find((s: any) => 
      (s.captain && s.captain.id === playerId) || 
      (s.players && s.players.some((p: any) => p.id === playerId))
    );
    return squad ? squad.team.name : "";
  };

  const getPlayingPlayerIds = () => {
    const ids = new Set<string>();
    const teamA = squads.find((s: any) => s.team.id === schedTeamA);
    const teamB = squads.find((s: any) => s.team.id === schedTeamB);
    if (teamA) {
      if (teamA.captain) ids.add(teamA.captain.id);
      teamA.players?.forEach((p: any) => ids.add(p.id));
    }
    if (teamB) {
      if (teamB.captain) ids.add(teamB.captain.id);
      teamB.players?.forEach((p: any) => ids.add(p.id));
    }
    return ids;
  };

  const playingPlayerIds = getPlayingPlayerIds();
  const umpireCandidates = uniquePlayers.filter((p: any) => !playingPlayerIds.has(p.id));
  const isTwoTeams = squads.length === 2;
  const activeOrUpcomingMatch = matches.find((m: any) => m.status === "upcoming" || m.status === "live");
  const hasActiveMatch = !!activeOrUpcomingMatch;
  const liveMatch = matches.find((m: any) => m.status === "live");

  useEffect(() => {
    if (tournament) {
      document.title = `${tournament.name} — Stadium Night`;
    } else {
      document.title = "Tournament Details — Stadium Night";
    }
  }, [tournament]);

  const isLoading = useLoadingState(loadingTournament || loadingMatches || loadingTable || loadingCerts || loadingSquads);

  if (isLoading) {
    return (
      <AppShell title="Tournament">
        <CricketLoading />
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

      <Tabs defaultValue="fixtures" className="mt-6 animate-fade-in">
        <TabsList className={`grid ${tournament?.detailed !== false ? 'grid-cols-5' : 'grid-cols-4'} w-full bg-elevated/45 border border-border/30 rounded-xl p-1 mb-2`}>
          <TabsTrigger value="fixtures" className="text-xs font-semibold">Fixtures</TabsTrigger>
          {tournament?.detailed !== false && (
            <TabsTrigger value="roadmap" className="text-xs font-semibold">Roadmap</TabsTrigger>
          )}
          <TabsTrigger value="table" className="text-xs font-semibold">Table</TabsTrigger>
          <TabsTrigger value="awards" className="text-xs font-semibold">Awards</TabsTrigger>
          <TabsTrigger value="teams" className="text-xs font-semibold">Teams ({squads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="fixtures" className="grid gap-2 mt-4 animate-tab-fade-in">
          {hasActiveMatch && (
            <div className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl mb-3 leading-normal animate-fade-up text-center font-medium">
              ⚠ An active or upcoming match is already in progress. Please complete it before scheduling/starting another match.
            </div>
          )}
          {liveMatch && (
            <div className="glass-card border border-destructive/30 bg-destructive/5 rounded-2xl p-5 shadow-card animate-fade-up relative overflow-hidden mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-destructive font-bold flex items-center gap-1.5 live-pulse">
                  <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
                  Live Match In Progress
                </span>
                <span className="text-[9px] uppercase bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold border border-destructive/20">
                  Live scoring
                </span>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="flex flex-col">
                  <span className="font-display text-lg font-bold text-foreground">
                    {squads.find((s: any) => s.team.id === liveMatch.teamAId)?.team.name || "Team A"}
                  </span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">Home</span>
                </div>
                <div className="text-xs text-muted-foreground font-semibold px-3 py-1 rounded-full bg-white/5 border border-border/10">
                  VS
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-display text-lg font-bold text-foreground">
                    {squads.find((s: any) => s.team.id === liveMatch.teamBId)?.team.name || "Team B"}
                  </span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">Away</span>
                </div>
              </div>
              <div className="text-xs text-center text-muted-foreground mt-3 border-t border-border/10 pt-3">
                Venue: {liveMatch.venue}
              </div>
              <Link
                to={`/matches/${liveMatch.id}`}
                className="block text-center text-xs py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-xl mt-4 transition shadow-glow duration-200"
              >
                Go to Match Center / Score Live
              </Link>
            </div>
          )}
          {isOrganizer && squads.length >= 2 && (
            <Button
              variant="lime"
              disabled={hasActiveMatch}
              className="mb-2 cursor-pointer w-full shadow-glow font-bold animate-fade-up disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                setSchedTeamA(isTwoTeams ? squads[0].team.id : "");
                setSchedTeamB(isTwoTeams ? squads[1].team.id : "");
                setSchedUmpires([]);
                setSchedNodeId("");
                setIsScheduleOpen(true);
              }}
            >
              {isTwoTeams ? "Start Match" : "+ Schedule Match"}
            </Button>
          )}
          {loadingMatches ? (
            <div className="text-center py-6 text-xs text-muted-foreground animate-pulse">Loading fixtures…</div>
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

        {tournament?.detailed !== false && (
          <TabsContent value="roadmap" className="grid gap-4 mt-4 animate-tab-fade-in">
          {hasActiveMatch && (
            <div className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl mb-3 leading-normal animate-fade-up text-center font-medium">
              ⚠ An active or upcoming match is already in progress. Please complete it before scheduling/starting another match.
            </div>
          )}
          {(() => {
            const roadmap = tournament.roadmap;
            const hasRoadmap = roadmap && roadmap.nodes && roadmap.nodes.length > 0;

            if (!hasRoadmap) {
              if (isOrganizer) {
                return (
                  <div className="glass-card border border-border/40 rounded-2xl p-6 text-center space-y-4">
                    <Trophy className="h-10 w-10 text-muted-foreground mx-auto" />
                    <div>
                      <h3 className="font-display text-xl">Create Tournament Roadmap</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-normal">
                        Organize your tournament stages and auto-advance winning squads down a visual bracket pathway.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
                      <Button
                        variant="lime"
                        className="flex-1 rounded-xl cursor-pointer font-bold shadow-glow"
                        onClick={() => {
                          const nodes = [
                            {
                              id: "sf1",
                              label: "Semifinal 1",
                              teamASource: { type: "manual" },
                              teamBSource: { type: "manual" },
                              teamAId: squads[0]?.team.id || "",
                              teamBId: squads[1]?.team.id || "",
                              matchId: null,
                              winnerId: null
                            },
                            {
                              id: "sf2",
                              label: "Semifinal 2",
                              teamASource: { type: "manual" },
                              teamBSource: { type: "manual" },
                              teamAId: squads[2]?.team.id || "",
                              teamBId: squads[3]?.team.id || "",
                              matchId: null,
                              winnerId: null
                            },
                            {
                              id: "final",
                              label: "Grand Final",
                              teamASource: { type: "node", value: "sf1" },
                              teamBSource: { type: "node", value: "sf2" },
                              teamAId: "",
                              teamBId: "",
                              matchId: null,
                              winnerId: null
                            }
                          ];
                          handleSaveRoadmap({ nodes });
                        }}
                      >
                        4-Team Knockout
                      </Button>
                      <Button
                        variant="hero"
                        className="flex-1 rounded-xl cursor-pointer font-bold"
                        onClick={() => {
                          const nodes = [
                            {
                              id: "final",
                              label: "Grand Final",
                              teamASource: { type: "manual" },
                              teamBSource: { type: "manual" },
                              teamAId: squads[0]?.team.id || "",
                              teamBId: squads[1]?.team.id || "",
                              matchId: null,
                              winnerId: null
                            }
                          ];
                          handleSaveRoadmap({ nodes });
                        }}
                      >
                        Single Final
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl cursor-pointer"
                        onClick={() => {
                          handleSaveRoadmap({ nodes: [] });
                        }}
                      >
                        Custom Setup
                      </Button>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="text-center py-10 text-xs text-muted-foreground italic">
                    No tournament roadmap scheduled by the organizer yet.
                  </div>
                );
              }
            }

            const getTeamNameById = (tid: string) => {
              if (!tid) return "";
              return squads.find((s: any) => s.team.id === tid)?.team.name || "TBD";
            };

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg">Roadmap Bracket</h3>
                  {isOrganizer && (
                    <div className="flex gap-2">
                      <Button
                        variant="hero"
                        size="sm"
                        className="rounded-lg cursor-pointer text-xs font-bold"
                        onClick={() => {
                          const label = prompt("Enter Node Label (e.g. Semifinal 3):");
                          if (!label) return;
                          const newId = `node_${Date.now()}`;
                          const newNode = {
                            id: newId,
                            label: label.trim(),
                            teamASource: { type: "manual" },
                            teamBSource: { type: "manual" },
                            teamAId: "",
                            teamBId: "",
                            matchId: null,
                            winnerId: null
                          };
                          handleSaveRoadmap({ nodes: [...roadmap.nodes, newNode] });
                        }}
                      >
                        + Add Stage
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg cursor-pointer text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          if (confirm("Reset roadmap? This will delete all nodes.")) {
                            handleSaveRoadmap(null);
                          }
                        }}
                      >
                        Reset Roadmap
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up">
                  {roadmap.nodes.map((node: any) => {
                    const matchObj = matches.find((m: any) => m.id === node.matchId);
                    const canScheduleNode = node.teamAId && node.teamBId && !node.matchId;

                    return (
                      <div
                        key={node.id}
                        className="glass-card border border-border/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 relative hover:border-primary/20 transition-all duration-300"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{node.label}</span>
                            <h4 className="font-display text-sm font-semibold mt-0.5 text-foreground">
                              {getTeamNameById(node.teamAId) || "TBD"} vs {getTeamNameById(node.teamBId) || "TBD"}
                            </h4>
                          </div>
                          {isOrganizer && (
                            <button
                              onClick={() => {
                                if (confirm("Delete this stage?")) {
                                  const updatedNodes = roadmap.nodes.filter((n: any) => n.id !== node.id);
                                  handleSaveRoadmap({ nodes: updatedNodes });
                                }
                              }}
                              className="text-xs text-destructive hover:underline cursor-pointer bg-transparent border-0"
                            >
                              Delete
                            </button>
                          )}
                        </div>

                        <div className="text-xs space-y-1 bg-black/10 p-2.5 rounded-xl border border-border/10">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Team A Source:</span>
                            <span className="text-foreground font-medium">
                              {node.teamASource.type === "node" 
                                ? `Winner of ${roadmap.nodes.find((n: any) => n.id === node.teamASource.value)?.label || node.teamASource.value}` 
                                : "Manual Assignment"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Team B Source:</span>
                            <span className="text-foreground font-medium">
                              {node.teamBSource.type === "node" 
                                ? `Winner of ${roadmap.nodes.find((n: any) => n.id === node.teamBSource.value)?.label || node.teamBSource.value}` 
                                : "Manual Assignment"}
                            </span>
                          </div>
                          {node.winnerId && (
                            <div className="flex justify-between border-t border-border/10 pt-1.5 mt-1.5 font-semibold">
                              <span className="text-primary flex items-center gap-1">✔ Winner:</span>
                              <span className="text-primary font-bold">{getTeamNameById(node.winnerId)}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-1 flex gap-2">
                          {node.matchId ? (
                            <Link
                              to={`/matches/${node.matchId}`}
                              className="flex-1 text-center text-xs py-2 bg-primary/10 border border-primary/20 text-primary font-semibold rounded-xl hover:bg-primary/20 transition duration-200"
                            >
                              {matchObj 
                                ? `View Match (${matchObj.status === "completed" ? "Done" : matchObj.status === "live" ? "Live" : "Upcoming"})` 
                                : "View Match Details"}
                            </Link>
                          ) : canScheduleNode && isOrganizer ? (
                            <Button
                              variant="lime"
                              size="sm"
                              disabled={hasActiveMatch}
                              className="w-full text-xs cursor-pointer shadow-glow font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => {
                                setSchedTeamA(node.teamAId);
                                setSchedTeamB(node.teamBId);
                                setSchedNodeId(node.id);
                                setSchedUmpires([]);
                                setIsScheduleOpen(true);
                              }}
                            >
                              {isTwoTeams ? "Start Match" : "Schedule Match"}
                            </Button>
                          ) : isOrganizer ? (
                            <Button
                              variant="hero"
                              size="sm"
                              className="w-full text-xs cursor-pointer font-bold"
                              onClick={() => {
                                const newTeamA = prompt(`Assign Team A for ${node.label} (Enter team name or leave empty):`);
                                const newTeamB = prompt(`Assign Team B for ${node.label} (Enter team name or leave empty):`);
                                
                                const updatedNodes = roadmap.nodes.map((n: any) => {
                                  if (n.id === node.id) {
                                    const aSquad = squads.find((s: any) => s.team.name.toLowerCase() === newTeamA?.toLowerCase().trim());
                                    const bSquad = squads.find((s: any) => s.team.name.toLowerCase() === newTeamB?.toLowerCase().trim());
                                    return {
                                      ...n,
                                      teamAId: aSquad ? aSquad.team.id : n.teamAId,
                                      teamBId: bSquad ? bSquad.team.id : n.teamBId,
                                      teamASource: aSquad ? { type: "manual" } : n.teamASource,
                                      teamBSource: bSquad ? { type: "manual" } : n.teamBSource,
                                    };
                                  }
                                  return n;
                                });
                                handleSaveRoadmap({ nodes: updatedNodes });
                              }}
                            >
                              Edit Assignments
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic text-center w-full block py-1.5 bg-white/5 rounded-xl border border-border/10">
                              Waiting for qualifying matches
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </TabsContent>
        )}

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
            squads.map(({ team, captain, players }: any, si: number) => {
              const isTeamCaptain = user && team.captainId === user.playerId;
              return (
                <div
                  key={team.id}
                  className="gradient-card border border-border/40 rounded-2xl p-5 space-y-4 animate-fade-up"
                  style={{ animationDelay: `${si * 70}ms` }}
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
                        {/* ponytail: Use Avatar component to support player profile pictures */}
                        <Avatar className="h-8 w-8 border border-border/40">
                          {captain.picture && <AvatarImage src={captain.picture} alt={captain.name} className="object-cover" />}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-display flex items-center justify-center h-full w-full font-bold">
                            {captain.initials || "C"}
                          </AvatarFallback>
                        </Avatar>
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
                        {players.map((p: any, pi: number) => {
                          const isCaptainPlayer = p.id === team.captainId;
                          return (
                            <div
                              key={p.id}
                              className="bg-elevated/40 border border-border/40 rounded-xl p-2.5 flex items-center justify-between gap-2 transition hover:border-border/60 animate-fade-up"
                              style={{ animationDelay: `${(pi + 1) * 45}ms` }}
                            >
                              <Link
                                to={`/players/${p.id}`}
                                className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-85"
                              >
                                {/* ponytail: Use Avatar component to support player profile pictures */}
                                <Avatar className="h-7 w-7 border border-border/40 shrink-0">
                                  {p.picture && <AvatarImage src={p.picture} alt={p.name} className="object-cover" />}
                                  <AvatarFallback className="bg-accent/10 text-accent text-[10px] font-display flex items-center justify-center h-full w-full font-bold">
                                    {p.initials}
                                  </AvatarFallback>
                                </Avatar>
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
    {/* Schedule Match Dialog */}
    <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
      <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl bg-elevated/90 backdrop-blur-xl">
        <DialogTitle className="font-display text-2xl mb-3 text-foreground flex items-center gap-2 border-b border-border/10 pb-3">
          <Trophy className="h-6 w-6 text-muted-foreground" />
          {isTwoTeams ? "Start Match" : "Schedule Match"}
        </DialogTitle>
        <div className="space-y-4">
          {!isTwoTeams ? (
            <div className="grid grid-cols-2 gap-3 animate-fade-up">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Team A (Home)</label>
                <select
                  value={schedTeamA}
                  onChange={(e) => setSchedTeamA(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">Select Team A</option>
                  {squads.map(({ team }: any) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Team B (Away)</label>
                <select
                  value={schedTeamB}
                  onChange={(e) => setSchedTeamB(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border/60 bg-[#11223b] text-foreground px-3 py-1 text-sm shadow-sm focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">Select Team B</option>
                  {squads.map(({ team }: any) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-border/20 rounded-2xl p-5 text-center space-y-2 animate-fade-up">
              <div className="font-display text-2xl font-bold flex items-center justify-center gap-4">
                <span className="text-primary">{squads[0]?.team.name}</span>
                <span className="text-xs text-muted-foreground font-normal px-2 py-0.5 rounded-full bg-white/5 border border-border/10">VS</span>
                <span className="text-accent">{squads[1]?.team.name}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Overs</label>
              <Input
                type="number"
                min="1"
                max="50"
                value={schedOvers}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setSchedOvers("");
                  } else {
                    const num = Number(val);
                    if (!isNaN(num)) setSchedOvers(num);
                  }
                }}
                className="bg-elevated/20 border-border/60 focus:border-primary h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Venue</label>
              <Input
                type="text"
                placeholder="e.g. Wankhede Stadium"
                value={schedVenue}
                onChange={(e) => setSchedVenue(e.target.value)}
                className="bg-elevated/20 border-border/60 focus:border-primary h-10"
              />
            </div>
          </div>

          {!isTwoTeams && (
            <div className="space-y-1 animate-fade-up">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                Assign Umpires (Optional)
              </label>
              <div className="max-h-40 overflow-y-auto border border-border/40 rounded-xl p-2.5 space-y-1.5 bg-black/15">
                {umpireCandidates.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic text-center py-2">
                    No neutral players or captains available to umpire
                  </div>
                ) : (
                  umpireCandidates.map((player: any) => {
                    const isChecked = schedUmpires.includes(player.id);
                    const teamName = getPlayerTeamName(player.id);
                    return (
                      <label
                        key={player.id}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer text-xs transition"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSchedUmpires(schedUmpires.filter((id) => id !== player.id));
                            } else {
                              setSchedUmpires([...schedUmpires, player.id]);
                            }
                          }}
                          className="rounded border-border text-primary focus:ring-primary cursor-pointer h-4 w-4 bg-transparent"
                        />
                        <span className="font-medium text-foreground">{player.name}</span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                          ({player.role}{teamName ? ` · ${teamName}` : ""})
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                If assigned, only the selected umpires or the organizer can score this match.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-3 border-t border-border/20">
            <Button variant="outline" onClick={() => setIsScheduleOpen(false)} className="rounded-xl cursor-pointer">
              Cancel
            </Button>
            <Button
              variant="lime"
              onClick={handleScheduleMatch}
              disabled={scheduling}
              className="rounded-xl cursor-pointer shadow-glow font-bold animate-fade-up"
            >
              {isTwoTeams 
                ? (scheduling ? "Starting..." : "Start Match") 
                : (scheduling ? "Scheduling..." : "Schedule")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
