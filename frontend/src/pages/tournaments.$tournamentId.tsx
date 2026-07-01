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
  finishTournament,
  removeTeamFromTournament,
  removePlayerFromTeam,
  updateTeamName,
  updateTournamentRoadmap,
  getFriends,
  sendSquadInvite,
  getPendingSquadInvites,
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
import { Trophy, Award, Copy, Users, ChevronRight, Trash2, Edit3, Check, X, UserX, Shield } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";

export default function TournamentDetail() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useApp((s) => s.user);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
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

  // Invite friends states
  const [isInviteFriendsOpen, setIsInviteFriendsOpen] = useState(false);
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [optimisticInvitedIds, setOptimisticInvitedIds] = useState<string[]>([]);

  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<any>(null);
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeTeamASourceType, setNodeTeamASourceType] = useState<"manual" | "node">("manual");
  const [nodeTeamASourceValue, setNodeTeamASourceValue] = useState("");
  const [nodeTeamBSourceType, setNodeTeamBSourceType] = useState<"manual" | "node">("manual");
  const [nodeTeamBSourceValue, setNodeTeamBSourceValue] = useState("");

  // Custom Roadmap Wizard states
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardRounds, setWizardRounds] = useState<any[]>([]);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  const openCustomWizard = () => {
    setWizardRounds([
      {
        id: "round_1",
        name: "Round 1",
        matches: [
          {
            id: `w_node_${Date.now()}`,
            label: "Match 1",
            teamASourceType: "manual",
            teamASourceValue: "",
            teamBSourceType: "manual",
            teamBSourceValue: "",
          }
        ]
      }
    ]);
    setIsWizardOpen(true);
  };

  const addWizardRound = () => {
    const nextRoundIndex = wizardRounds.length + 1;
    setWizardRounds([
      ...wizardRounds,
      {
        id: `round_${Date.now()}`,
        name: `Round ${nextRoundIndex}`,
        matches: [
          {
            id: `w_node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            label: "Match 1",
            teamASourceType: "manual",
            teamASourceValue: "",
            teamBSourceType: "manual",
            teamBSourceValue: "",
          }
        ]
      }
    ]);
  };

  const deleteWizardRound = (roundId: string) => {
    const roundToDelete = wizardRounds.find(r => r.id === roundId);
    if (!roundToDelete) return;
    const deletedMatchIds = new Set(roundToDelete.matches.map((m: any) => m.id));

    const updated = wizardRounds
      .filter((r) => r.id !== roundId)
      .map((r) => ({
        ...r,
        matches: r.matches.map((m: any) => ({
          ...m,
          teamASourceType: deletedMatchIds.has(m.teamASourceValue) ? "manual" : m.teamASourceType,
          teamASourceValue: deletedMatchIds.has(m.teamASourceValue) ? "" : m.teamASourceValue,
          teamBSourceType: deletedMatchIds.has(m.teamBSourceValue) ? "manual" : m.teamBSourceType,
          teamBSourceValue: deletedMatchIds.has(m.teamBSourceValue) ? "" : m.teamBSourceValue,
        }))
      }));
    setWizardRounds(updated);
  };

  const updateRoundName = (roundId: string, name: string) => {
    setWizardRounds(
      wizardRounds.map((r) => (r.id === roundId ? { ...r, name } : r))
    );
  };

  const addMatchToRound = (roundId: string) => {
    setWizardRounds(
      wizardRounds.map((r) => {
        if (r.id === roundId) {
          return {
            ...r,
            matches: [
              ...r.matches,
              {
                id: `w_node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                label: `Match ${r.matches.length + 1}`,
                teamASourceType: "manual",
                teamASourceValue: "",
                teamBSourceType: "manual",
                teamBSourceValue: "",
              }
            ]
          };
        }
        return r;
      })
    );
  };

  const deleteMatchFromRound = (roundId: string, matchId: string) => {
    const updated = wizardRounds.map((r) => {
      if (r.id === roundId) {
        return {
          ...r,
          matches: r.matches.filter((m: any) => m.id !== matchId)
        };
      }
      return {
        ...r,
        matches: r.matches.map((m: any) => ({
          ...m,
          teamASourceType: m.teamASourceValue === matchId ? "manual" : m.teamASourceType,
          teamASourceValue: m.teamASourceValue === matchId ? "" : m.teamASourceValue,
          teamBSourceType: m.teamBSourceValue === matchId ? "manual" : m.teamBSourceType,
          teamBSourceValue: m.teamBSourceValue === matchId ? "" : m.teamBSourceValue,
        }))
      };
    });
    setWizardRounds(updated);
  };

  const updateMatchInRound = (roundId: string, matchId: string, updates: any) => {
    setWizardRounds(
      wizardRounds.map((r) => {
        if (r.id === roundId) {
          return {
            ...r,
            matches: r.matches.map((m: any) =>
              m.id === matchId ? { ...m, ...updates } : m
            )
          };
        }
        return r;
      })
    );
  };

  const getPreviousMatchesForRound = (roundId: string) => {
    const roundIndex = wizardRounds.findIndex((r) => r.id === roundId);
    if (roundIndex <= 0) return [];
    
    const list: any[] = [];
    for (let i = 0; i < roundIndex; i++) {
      const r = wizardRounds[i];
      r.matches.forEach((m: any) => {
        list.push({
          id: m.id,
          label: `${r.name}: ${m.label || "Match"}`
        });
      });
    }
    return list;
  };

  // Reset optimistic invited IDs when opening/closing invite friends modal
  useEffect(() => {
    if (!isInviteFriendsOpen) {
      setOptimisticInvitedIds([]);
    }
  }, [isInviteFriendsOpen]);

  // Friends Query
  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: () => getFriends(),
    enabled: isInviteFriendsOpen && !!user,
  });
  const { friends = [] } = friendsData || {};

  // Pending Squad Invites Query for this team
  const { data: pendingSquadInvites = [] } = useQuery({
    queryKey: ["squad-invites", inviteTeamId],
    queryFn: () => getPendingSquadInvites({ teamId: inviteTeamId }),
    enabled: isInviteFriendsOpen && !!inviteTeamId,
  });

  // Send squad invite mutation
  const inviteMutation = useMutation({
    mutationFn: (targetPlayerId: string) => sendSquadInvite({ data: { teamId: inviteTeamId, targetPlayerId } }),
    onMutate: (targetPlayerId) => {
      // Optimistically add to the list so UI updates instantly
      setOptimisticInvitedIds((prev) => [...prev, targetPlayerId]);
    },
    onSuccess: (_, targetPlayerId) => {
      const friendObj = friends.find((f: any) => f.id === targetPlayerId);
      toast.success(`Invite sent to ${friendObj?.name || "friend"}!`);
      queryClient.invalidateQueries({ queryKey: ["squad-invites", inviteTeamId] });
    },
    onError: (err: any, targetPlayerId) => {
      toast.error(err.message || "Failed to send squad invite.");
      // Rollback optimistic update
      setOptimisticInvitedIds((prev) => prev.filter((id) => id !== targetPlayerId));
    }
  });

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
  const { data: tournament, isLoading: loadingTournament, error: tournamentError } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => getTournament({ data: tournamentId }),
  });

  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ["tournament-matches", tournamentId],
    queryFn: () => getTournamentMatches({ data: tournamentId }),
  });

  const { data: table = [], isLoading: loadingTable } = useQuery({
    queryKey: ["points-table", tournamentId],
    queryFn: () => getPointsTable({ data: tournamentId }),
  });

  const { data: allCerts = [], isLoading: loadingCerts } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => getCertificates(),
  });

  const { data: squads = [], isLoading: loadingSquads } = useQuery({
    queryKey: ["tournament-squads", tournamentId],
    queryFn: () => getTournamentSquads({ data: tournamentId }),
  });

  const activeSquads = squads.filter((s: any) => 
    !s.captain || !tournament?.umpires?.some((u: any) => u.id === s.captain.id)
  );

  // Get all unique players from squads to choose umpires
  const allPlayers = [
    ...squads.flatMap((s: any) => [
      ...(s.captain ? [s.captain] : []),
      ...(s.players || [])
    ]),
    ...(tournament?.umpires || [])
  ];
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
    const teamA = activeSquads.find((s: any) => s.team.id === schedTeamA);
    const teamB = activeSquads.find((s: any) => s.team.id === schedTeamB);
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
  const isTwoTeams = activeSquads.length === 2;
  const activeOrUpcomingMatch = matches.find((m: any) => m.status === "upcoming" || m.status === "live");
  const hasActiveMatch = !!activeOrUpcomingMatch;
  const liveMatch = matches.find((m: any) => m.status === "live");

  useEffect(() => {
    if (tournament) {
      document.title = `${tournament.name} — CreaseLive`;
    } else {
      document.title = "Tournament Details — CreaseLive";
    }
  }, [tournament]);

  useEffect(() => {
    if (tournamentError) {
      toast.error("Tournament not found or has been deleted.");
      navigate("/home");
    }
  }, [tournamentError, navigate]);

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
  const isUmpire = user && tournament?.umpires?.some((u: any) => u.id === user.playerId);
  const canManage = isOrganizer || isUmpire;

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
          {tournament.format ? <StatPill label="Format" value={tournament.format} /> : <div />}
          <StatPill label="Teams" value={activeSquads.length || 0} accent />
          {tournament.prizePool ? <StatPill label="Prize" value={tournament.prizePool} /> : <div />}
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

        {/* Finish Tournament — creator only, when tournament is live and at least 1 match is completed */}
        {user && (tournament.organizerId === user.id || tournament.organizer === user.name) && tournament.status === "live" && matches.some((m: any) => m.status === "completed") && (
          <div className="mt-2.5">
            {!confirmFinish ? (
              <button
                onClick={() => setConfirmFinish(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/95 transition cursor-pointer shadow-glow"
              >
                <Trophy className="h-3.5 w-3.5 animate-bounce" /> Finish Tournament
              </button>
            ) : (
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 space-y-2">
                <p className="text-xs text-primary font-medium text-center">
                  This will end the tournament, finalize the standings, and issue certificates to the Champion, Runner-up, and MVP.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmFinish(false)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium bg-elevated hover:bg-muted border border-border transition cursor-pointer"
                  >
                    Not yet
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await finishTournament({ data: tournamentId! });
                        toast.success("Tournament completed! Standing certificates issued.");
                        queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId!] });
                        queryClient.invalidateQueries({ queryKey: ["certificates", tournamentId!] });
                        queryClient.invalidateQueries({ queryKey: ["points-table", tournamentId!] });
                        setConfirmFinish(false);
                      } catch (err: any) {
                        toast.error(err.message || "Failed to finish tournament.");
                      }
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
                  >
                    Yes, Finish Tournament
                  </button>
                </div>
              </div>
            )}
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
          <TabsTrigger value="teams" className="text-xs font-semibold">Teams ({activeSquads.length})</TabsTrigger>
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
          {canManage && activeSquads.length >= 2 && (
            <Button
              variant="lime"
              disabled={hasActiveMatch}
              className="mb-2 cursor-pointer w-full shadow-glow font-bold animate-fade-up disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                setSchedTeamA(isTwoTeams ? activeSquads[0].team.id : "");
                setSchedTeamB(isTwoTeams ? activeSquads[1].team.id : "");
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
              if (canManage) {
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
                              teamAId: activeSquads[0]?.team.id || "",
                              teamBId: activeSquads[1]?.team.id || "",
                              matchId: null,
                              winnerId: null
                            },
                            {
                              id: "sf2",
                              label: "Semifinal 2",
                              teamASource: { type: "manual" },
                              teamBSource: { type: "manual" },
                              teamAId: activeSquads[2]?.team.id || "",
                              teamBId: activeSquads[3]?.team.id || "",
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
                          openCustomWizard();
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
                  {canManage && (
                    <div className="flex gap-2">
                      <Button
                        variant="hero"
                        size="sm"
                        className="rounded-lg cursor-pointer text-xs font-bold"
                        onClick={() => {
                          setEditingNode(null);
                          setNodeLabel("");
                          setNodeTeamASourceType("manual");
                          setNodeTeamASourceValue("");
                          setNodeTeamBSourceType("manual");
                          setNodeTeamBSourceValue("");
                          setIsNodeModalOpen(true);
                        }}
                      >
                        + Add Stage
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg cursor-pointer text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setIsResetDialogOpen(true);
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
                          {canManage && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingNode(node);
                                  setNodeLabel(node.label);
                                  setNodeTeamASourceType(node.teamASource?.type || "manual");
                                  setNodeTeamASourceValue(node.teamASource?.type === "node" ? node.teamASource.value : node.teamAId || "");
                                  setNodeTeamBSourceType(node.teamBSource?.type || "manual");
                                  setNodeTeamBSourceValue(node.teamBSource?.type === "node" ? node.teamBSource.value : node.teamBId || "");
                                  setIsNodeModalOpen(true);
                                }}
                                className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-0"
                              >
                                Edit
                              </button>
                              <span className="text-muted-foreground/30 text-xs">|</span>
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
                            </div>
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
                          ) : canScheduleNode && canManage ? (
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
                          ) : canManage ? (
                            <Button
                              variant="hero"
                              size="sm"
                              className="w-full text-xs cursor-pointer font-bold"
                              onClick={() => {
                                setEditingNode(node);
                                setNodeLabel(node.label);
                                setNodeTeamASourceType(node.teamASource?.type || "manual");
                                setNodeTeamASourceValue(node.teamASource?.type === "node" ? node.teamASource.value : node.teamAId || "");
                                setNodeTeamBSourceType(node.teamBSource?.type || "manual");
                                setNodeTeamBSourceValue(node.teamBSource?.type === "node" ? node.teamBSource.value : node.teamBId || "");
                                setIsNodeModalOpen(true);
                              }}
                            >
                              Edit Configuration
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
          {tournament?.umpires && tournament.umpires.length > 0 && (
            <div className="gradient-card border border-border/40 rounded-2xl p-5 space-y-3 animate-fade-up">
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-lg font-bold text-foreground">Tournament Umpires</h3>
                </div>
                <span className="text-[10px] uppercase font-mono bg-white/5 border border-border/40 px-2 py-1 rounded">
                  {tournament.umpires.length} Official{tournament.umpires.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {tournament.umpires.map((ump: any) => (
                  <div key={ump.id} className="bg-elevated/40 border border-border/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <Link to={`/players/${ump.id}`} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-85">
                      <Avatar className="h-7 w-7 border border-border/40 shrink-0">
                        {ump.picture && <AvatarImage src={ump.picture} alt={ump.name} className="object-cover" />}
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-display flex items-center justify-center h-full w-full font-bold">
                          {ump.initials || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate text-foreground">{ump.name}</div>
                        <div className="text-[9px] text-muted-foreground truncate">{ump.role || "Official"}</div>
                      </div>
                    </Link>
                    <span className="text-[9px] font-bold text-primary border border-primary/20 bg-primary/5 px-2 py-0.5 rounded-full uppercase shrink-0">
                      Umpire
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingSquads ? (
            <div className="text-center py-6 text-xs text-muted-foreground">Loading teams & squads…</div>
          ) : activeSquads.length === 0 ? (
            <div className="text-muted-foreground text-sm text-center py-8">
              No teams have joined this tournament yet.
            </div>
          ) : (
            activeSquads.map(({ team, captain, players }: any, si: number) => {
                const isTeamCaptain = user && team.captainId === user.playerId;
                const isUmpirePlayer = (pid: string) => tournament?.umpires?.some((u: any) => u.id === pid);
                const showCaptain = captain && !isUmpirePlayer(captain.id);
                const filteredPlayers = (players || []).filter((p: any) => !isUmpirePlayer(p.id));
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
                        {filteredPlayers.length} players
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
                  {showCaptain && (
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
                    <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Players Squad
                      </div>
                      {isTeamCaptain && (
                        <Button
                          variant="lime"
                          size="sm"
                          className="h-7 px-2.5 text-[10px] rounded-lg shadow-glow font-bold cursor-pointer"
                          onClick={() => {
                            setInviteTeamId(team.id);
                            setIsInviteFriendsOpen(true);
                          }}
                        >
                          + Invite Friends
                        </Button>
                      )}
                    </div>
                    {filteredPlayers.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No players in squad yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredPlayers.map((p: any, pi: number) => {
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
                  {activeSquads.map(({ team }: any) => (
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
                  {activeSquads.map(({ team }: any) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-border/20 rounded-2xl p-5 text-center space-y-2 animate-fade-up">
              <div className="font-display text-2xl font-bold flex items-center justify-center gap-4">
                <span className="text-primary">{activeSquads[0]?.team.name}</span>
                <span className="text-xs text-muted-foreground font-normal px-2 py-0.5 rounded-full bg-white/5 border border-border/10">VS</span>
                <span className="text-accent">{activeSquads[1]?.team.name}</span>
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

    {/* Invite Friends Modal */}
    <Dialog open={isInviteFriendsOpen} onOpenChange={setIsInviteFriendsOpen}>
      <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <DialogTitle className="font-display text-2xl mb-3 text-foreground flex items-center gap-2 border-b border-border/10 pb-3 shrink-0">
          <Users className="h-5 w-5 text-primary" />
          Invite Friends to Squad
        </DialogTitle>
        <div className="shrink-0 mb-3">
          <div className="relative font-semibold text-xs text-muted-foreground mb-2 leading-relaxed">
            Select a friend to invite to your squad. They must accept the invite from their notifications tab to join.
          </div>
          <div className="relative">
            <Input
              type="text"
              placeholder="Search friends..."
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
              className="bg-elevated/20 border-border/60 focus:border-primary h-9 rounded-xl text-sm"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
          {(() => {
            const currentSquad = squads.find((s: any) => s.team.id === inviteTeamId);
            const squadPlayerIds = new Set<string>();
            if (currentSquad) {
              if (currentSquad.captain) squadPlayerIds.add(currentSquad.captain.id);
              currentSquad.players?.forEach((p: any) => squadPlayerIds.add(p.id));
            }

            const filteredFriends = friends.filter((f: any) =>
              inviteSearch.trim()
                ? f.name?.toLowerCase().includes(inviteSearch.toLowerCase()) ||
                  f.role?.toLowerCase().includes(inviteSearch.toLowerCase())
                : true
            );

            if (filteredFriends.length === 0) {
              return (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No friends found. Go to Profile to add friends!
                </div>
              );
            }

            return filteredFriends.map((f: any) => {
              const isJoined = squadPlayerIds.has(f.id);
              const isAlreadyInTournament = squads.some((s: any) => 
                (s.captain && s.captain.id === f.id) || 
                (s.players && s.players.some((p: any) => p.id === f.id))
              );
              const isSent = pendingSquadInvites.some((inv: any) => inv.receiverId === f.id) || optimisticInvitedIds.includes(f.id);
 
              return (
                <div 
                  key={f.id} 
                  className="bg-elevated/15 border border-border/30 rounded-2xl p-3 flex items-center justify-between gap-3 transition hover:border-border/60"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Avatar className="h-9 w-9 border border-border/40 shrink-0">
                      {f.picture && <AvatarImage src={f.picture} alt={f.name} className="object-cover" />}
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-display font-bold">
                        {f.initials || "P"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate text-foreground">{f.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{f.role}</div>
                    </div>
                  </div>
                  <Button
                    variant={isJoined ? "secondary" : isAlreadyInTournament ? "outline" : isSent ? "outline" : "lime"}
                    size="sm"
                    disabled={isJoined || isAlreadyInTournament || isSent || inviteMutation.isPending}
                    onClick={() => inviteMutation.mutate(f.id)}
                    className="rounded-lg h-7 text-[10px] font-bold shadow-sm"
                  >
                    {isJoined ? "Joined" : isAlreadyInTournament ? "In Tournament" : isSent ? "Invite Sent" : "Invite"}
                  </Button>
                </div>
              );
            });
          })()}
        </div>
      </DialogContent>
    </Dialog>

    {/* Roadmap Stage Builder Dialog Modal */}
    <Dialog open={isNodeModalOpen} onOpenChange={setIsNodeModalOpen}>
      <DialogContent className="glass-card border border-border/40 rounded-3xl max-w-md w-[92%] p-5 text-foreground bg-elevated/95 backdrop-blur-xl">
        <DialogTitle className="font-display text-2xl text-foreground flex items-center gap-2 border-b border-border/10 pb-3 shrink-0">
          <Trophy className="h-5 w-5 text-primary" />
          {editingNode ? "Edit Stage Settings" : "Add Stage to Roadmap"}
        </DialogTitle>
        <div className="space-y-4 mt-2">
          {/* Stage Name */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Stage Name</label>
            <Input
              type="text"
              value={nodeLabel}
              onChange={(e) => setNodeLabel(e.target.value)}
              placeholder="e.g. Semifinal 3, Quarterfinal"
              className="w-full bg-elevated/20 border-border/60 focus:border-primary h-9 rounded-xl text-sm"
            />
          </div>

          {/* Team A Configuration */}
          <div className="space-y-2 border border-border/10 p-3.5 rounded-xl bg-black/10">
            <span className="text-xs font-semibold text-primary">Team A Configuration</span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  setNodeTeamASourceType("manual");
                  setNodeTeamASourceValue("");
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  nodeTeamASourceType === "manual"
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "bg-white/5 border border-border/10 text-muted-foreground"
                }`}
              >
                Manual Select
              </button>
              <button
                type="button"
                onClick={() => {
                  setNodeTeamASourceType("node");
                  setNodeTeamASourceValue("");
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  nodeTeamASourceType === "node"
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "bg-white/5 border border-border/10 text-muted-foreground"
                }`}
              >
                Winner of Stage
              </button>
            </div>

            {nodeTeamASourceType === "manual" ? (
              <div className="space-y-1 mt-2">
                <label className="text-[9px] uppercase font-bold text-muted-foreground">Select Team</label>
                <select
                  value={nodeTeamASourceValue}
                  onChange={(e) => setNodeTeamASourceValue(e.target.value)}
                  className="w-full bg-background border border-border/40 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="">TBD (To Be Decided)</option>
                  {squads.map((s: any) => (
                    <option key={s.team.id} value={s.team.id}>
                      {s.team.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1 mt-2">
                <label className="text-[9px] uppercase font-bold text-muted-foreground">Select Source Stage</label>
                <select
                  value={nodeTeamASourceValue}
                  onChange={(e) => setNodeTeamASourceValue(e.target.value)}
                  className="w-full bg-background border border-border/40 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="">Select Stage...</option>
                  {tournament.roadmap?.nodes
                    ?.filter((n: any) => !editingNode || n.id !== editingNode.id)
                    .map((n: any) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Team B Configuration */}
          <div className="space-y-2 border border-border/10 p-3.5 rounded-xl bg-black/10">
            <span className="text-xs font-semibold text-primary">Team B Configuration</span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => {
                  setNodeTeamBSourceType("manual");
                  setNodeTeamBSourceValue("");
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  nodeTeamBSourceType === "manual"
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "bg-white/5 border border-border/10 text-muted-foreground"
                }`}
              >
                Manual Select
              </button>
              <button
                type="button"
                onClick={() => {
                  setNodeTeamBSourceType("node");
                  setNodeTeamBSourceValue("");
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  nodeTeamBSourceType === "node"
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "bg-white/5 border border-border/10 text-muted-foreground"
                }`}
              >
                Winner of Stage
              </button>
            </div>

            {nodeTeamBSourceType === "manual" ? (
              <div className="space-y-1 mt-2">
                <label className="text-[9px] uppercase font-bold text-muted-foreground">Select Team</label>
                <select
                  value={nodeTeamBSourceValue}
                  onChange={(e) => setNodeTeamBSourceValue(e.target.value)}
                  className="w-full bg-background border border-border/40 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="">TBD (To Be Decided)</option>
                  {squads.map((s: any) => (
                    <option key={s.team.id} value={s.team.id}>
                      {s.team.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1 mt-2">
                <label className="text-[9px] uppercase font-bold text-muted-foreground">Select Source Stage</label>
                <select
                  value={nodeTeamBSourceValue}
                  onChange={(e) => setNodeTeamBSourceValue(e.target.value)}
                  className="w-full bg-background border border-border/40 rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="">Select Stage...</option>
                  {tournament.roadmap?.nodes
                    ?.filter((n: any) => !editingNode || n.id !== editingNode.id)
                    .map((n: any) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 pt-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl cursor-pointer text-xs font-bold"
              onClick={() => setIsNodeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="lime"
              className="flex-1 rounded-xl cursor-pointer text-xs font-bold shadow-glow"
              disabled={
                !nodeLabel.trim() ||
                (nodeTeamASourceType === "node" && !nodeTeamASourceValue) ||
                (nodeTeamBSourceType === "node" && !nodeTeamBSourceValue)
              }
              onClick={() => {
                // Propagate winner status if source node is completed
                let teamAIdVal = nodeTeamASourceType === "manual" ? nodeTeamASourceValue : "";
                let teamBIdVal = nodeTeamBSourceType === "manual" ? nodeTeamBSourceValue : "";

                if (nodeTeamASourceType === "node" && tournament.roadmap?.nodes) {
                  const sourceNode = tournament.roadmap.nodes.find((n: any) => n.id === nodeTeamASourceValue);
                  if (sourceNode && sourceNode.winnerId) {
                    teamAIdVal = sourceNode.winnerId;
                  }
                }
                if (nodeTeamBSourceType === "node" && tournament.roadmap?.nodes) {
                  const sourceNode = tournament.roadmap.nodes.find((n: any) => n.id === nodeTeamBSourceValue);
                  if (sourceNode && sourceNode.winnerId) {
                    teamBIdVal = sourceNode.winnerId;
                  }
                }

                if (editingNode) {
                  const updatedNodes = tournament.roadmap.nodes.map((n: any) => {
                    if (n.id === editingNode.id) {
                      return {
                        ...n,
                        label: nodeLabel.trim(),
                        teamASource: {
                          type: nodeTeamASourceType,
                          ...(nodeTeamASourceType === "node" ? { value: nodeTeamASourceValue } : {})
                        },
                        teamBSource: {
                          type: nodeTeamBSourceType,
                          ...(nodeTeamBSourceType === "node" ? { value: nodeTeamBSourceValue } : {})
                        },
                        teamAId: teamAIdVal,
                        teamBId: teamBIdVal,
                      };
                    }
                    return n;
                  });
                  handleSaveRoadmap({ nodes: updatedNodes });
                } else {
                  const newId = `node_${Date.now()}`;
                  const newNode = {
                    id: newId,
                    label: nodeLabel.trim(),
                    teamASource: {
                      type: nodeTeamASourceType,
                      ...(nodeTeamASourceType === "node" ? { value: nodeTeamASourceValue } : {})
                    },
                    teamBSource: {
                      type: nodeTeamBSourceType,
                      ...(nodeTeamBSourceType === "node" ? { value: nodeTeamBSourceValue } : {})
                    },
                    teamAId: teamAIdVal,
                    teamBId: teamBIdVal,
                    matchId: null,
                    winnerId: null
                  };
                  handleSaveRoadmap({ nodes: [...(tournament.roadmap?.nodes || []), newNode] });
                }
                setIsNodeModalOpen(false);
              }}
            >
              {editingNode ? "Save Changes" : "Add Stage"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Step-by-Step Custom Roadmap Wizard Modal */}
    <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
      <DialogContent className="glass-card border border-border/40 rounded-3xl max-w-4xl w-[92%] p-6 text-foreground bg-elevated/95 backdrop-blur-xl max-h-[85vh] flex flex-col">
        <DialogTitle className="font-display text-2xl text-foreground flex items-center gap-2 border-b border-border/10 pb-3 shrink-0">
          <Trophy className="h-6 w-6 text-primary" />
          Custom Roadmap Builder
        </DialogTitle>

        <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
          <p className="text-xs text-muted-foreground leading-normal max-w-2xl">
            Design your tournament progression step-by-step. Add rounds (e.g. Round 1, Semifinals, Finals) and configure matches in each. Matches in subsequent rounds can automatically draw their teams from the winners of earlier matches.
          </p>

          <div className="space-y-6">
            {wizardRounds.map((round, rIdx) => {
              const prevMatches = getPreviousMatchesForRound(round.id);
              return (
                <div key={round.id} className="border border-border/30 rounded-2xl p-4 bg-black/20 space-y-4 relative animate-fade-up">
                  {/* Round Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-border/10">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">Round {rIdx + 1}</span>
                      <Input
                        type="text"
                        value={round.name}
                        onChange={(e) => updateRoundName(round.id, e.target.value)}
                        placeholder="Round Name (e.g. Semifinals)"
                        className="bg-transparent border-0 border-b border-border/20 focus:border-primary focus:ring-0 h-8 text-sm font-semibold w-full sm:w-48 px-1 py-0 rounded-none focus:outline-none"
                      />
                    </div>
                    {wizardRounds.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-destructive hover:bg-destructive/10 border-destructive/20 h-8 rounded-lg cursor-pointer ml-auto sm:ml-0"
                        onClick={() => deleteWizardRound(round.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Round
                      </Button>
                    )}
                  </div>

                  {/* Matches Grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {round.matches.map((match: any, mIdx: number) => {
                      return (
                        <div key={match.id} className="glass-card border border-border/25 rounded-xl p-3.5 space-y-3 relative">
                          {/* Match Label & Delete */}
                          <div className="flex justify-between items-center">
                            <Input
                              type="text"
                              value={match.label}
                              onChange={(e) => updateMatchInRound(round.id, match.id, { label: e.target.value })}
                              placeholder={`Match ${mIdx + 1} Label`}
                              className="bg-transparent border-0 border-b border-border/20 focus:border-primary focus:ring-0 h-7 text-xs font-bold w-36 px-0 py-0 rounded-none focus:outline-none"
                            />
                            {round.matches.length > 1 && (
                              <button
                                onClick={() => deleteMatchFromRound(round.id, match.id)}
                                className="text-muted-foreground hover:text-destructive cursor-pointer bg-transparent border-0 p-1 rounded"
                                title="Remove Match"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          {/* Team A Source Config */}
                          <div className="space-y-1 bg-black/10 p-2 rounded-lg border border-border/10">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground">Team A Source</span>
                              {rIdx > 0 && (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => updateMatchInRound(round.id, match.id, { teamASourceType: "manual", teamASourceValue: "" })}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${match.teamASourceType === "manual" ? "bg-primary text-primary-foreground font-extrabold" : "bg-white/5 text-muted-foreground"}`}
                                  >
                                    Team
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateMatchInRound(round.id, match.id, { teamASourceType: "node", teamASourceValue: "" })}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${match.teamASourceType === "node" ? "bg-primary text-primary-foreground font-extrabold" : "bg-white/5 text-muted-foreground"}`}
                                  >
                                    Winner of
                                  </button>
                                </div>
                              )}
                            </div>

                            {match.teamASourceType === "manual" || rIdx === 0 ? (
                              <select
                                value={match.teamASourceValue}
                                onChange={(e) => updateMatchInRound(round.id, match.id, { teamASourceValue: e.target.value })}
                                className="w-full bg-background border border-border/40 rounded px-2 py-1 text-xs text-foreground focus:outline-none cursor-pointer mt-1"
                              >
                                <option value="">TBD (To Be Decided)</option>
                                {squads.map((s: any) => (
                                  <option key={s.team.id} value={s.team.id}>
                                    {s.team.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                value={match.teamASourceValue}
                                onChange={(e) => updateMatchInRound(round.id, match.id, { teamASourceValue: e.target.value })}
                                className="w-full bg-background border border-border/40 rounded px-2 py-1 text-xs text-foreground focus:outline-none cursor-pointer mt-1"
                              >
                                <option value="">Select Previous Match...</option>
                                {prevMatches.map((prev: any) => (
                                  <option key={prev.id} value={prev.id}>
                                    {prev.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Team B Source Config */}
                          <div className="space-y-1 bg-black/10 p-2 rounded-lg border border-border/10">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground">Team B Source</span>
                              {rIdx > 0 && (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => updateMatchInRound(round.id, match.id, { teamBSourceType: "manual", teamBSourceValue: "" })}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${match.teamBSourceType === "manual" ? "bg-primary text-primary-foreground font-extrabold" : "bg-white/5 text-muted-foreground"}`}
                                  >
                                    Team
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateMatchInRound(round.id, match.id, { teamBSourceType: "node", teamBSourceValue: "" })}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${match.teamBSourceType === "node" ? "bg-primary text-primary-foreground font-extrabold" : "bg-white/5 text-muted-foreground"}`}
                                  >
                                    Winner of
                                  </button>
                                </div>
                              )}
                            </div>

                            {match.teamBSourceType === "manual" || rIdx === 0 ? (
                              <select
                                value={match.teamBSourceValue}
                                onChange={(e) => updateMatchInRound(round.id, match.id, { teamBSourceValue: e.target.value })}
                                className="w-full bg-background border border-border/40 rounded px-2 py-1 text-xs text-foreground focus:outline-none cursor-pointer mt-1"
                              >
                                <option value="">TBD (To Be Decided)</option>
                                {squads.map((s: any) => (
                                  <option key={s.team.id} value={s.team.id}>
                                    {s.team.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                value={match.teamBSourceValue}
                                onChange={(e) => updateMatchInRound(round.id, match.id, { teamBSourceValue: e.target.value })}
                                className="w-full bg-background border border-border/40 rounded px-2 py-1 text-xs text-foreground focus:outline-none cursor-pointer mt-1"
                              >
                                <option value="">Select Previous Match...</option>
                                {prevMatches.map((prev: any) => (
                                  <option key={prev.id} value={prev.id}>
                                    {prev.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add Match Button inside Round */}
                    <button
                      onClick={() => addMatchToRound(round.id)}
                      className="border border-dashed border-border/30 hover:border-primary/40 rounded-xl p-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition bg-white/[0.02] cursor-pointer min-h-[120px]"
                    >
                      <Trophy className="h-4 w-4" /> + Add Match
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Next Round */}
          <Button
            variant="outline"
            className="w-full border-dashed border-border/40 hover:border-primary/40 rounded-2xl py-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer bg-white/[0.01]"
            onClick={addWizardRound}
          >
            + Add Next Round (Round {wizardRounds.length + 1})
          </Button>
        </div>

        {/* Wizard Footer */}
        <div className="border-t border-border/10 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
            Total Matches: {wizardRounds.reduce((acc, r) => acc + r.matches.length, 0)} across {wizardRounds.length} rounds
          </span>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none rounded-xl cursor-pointer text-xs font-bold"
              onClick={() => setIsWizardOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="lime"
              className="flex-1 sm:flex-none rounded-xl cursor-pointer text-xs font-bold shadow-glow"
              onClick={() => {
                // Validate
                let hasErr = false;
                for (const round of wizardRounds) {
                  for (const match of round.matches) {
                    if (!match.label.trim()) {
                      toast.error("All matches must have a name / label.");
                      hasErr = true;
                      break;
                    }
                    if (match.teamASourceType === "node" && !match.teamASourceValue) {
                      toast.error(`Please select source stage for Team A in "${match.label}".`);
                      hasErr = true;
                      break;
                    }
                    if (match.teamBSourceType === "node" && !match.teamBSourceValue) {
                      toast.error(`Please select source stage for Team B in "${match.label}".`);
                      hasErr = true;
                      break;
                    }
                  }
                  if (hasErr) break;
                }
                if (hasErr) return;

                // Build flat nodes list for the backend
                const finalNodes = wizardRounds.flatMap((round) => {
                  return round.matches.map((m: any) => {
                    return {
                      id: m.id,
                      label: m.label.trim(),
                      teamASource: {
                        type: m.teamASourceType,
                        ...(m.teamASourceType === "node" ? { value: m.teamASourceValue } : {})
                      },
                      teamBSource: {
                        type: m.teamBSourceType,
                        ...(m.teamBSourceType === "node" ? { value: m.teamBSourceValue } : {})
                      },
                      teamAId: m.teamASourceType === "manual" ? m.teamASourceValue : "",
                      teamBId: m.teamBSourceType === "manual" ? m.teamBSourceValue : "",
                      matchId: null,
                      winnerId: null
                    };
                  });
                });

                handleSaveRoadmap({ nodes: finalNodes });
                setIsWizardOpen(false);
              }}
            >
              Generate & Save Roadmap
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Custom Reset Confirmation Dialog */}
    <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
      <AlertDialogContent className="glass-card border border-border/40 rounded-3xl max-w-md w-[92%] p-6 text-foreground bg-elevated/95 backdrop-blur-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl text-foreground">Reset Roadmap?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-normal mt-2">
            This will permanently delete all stages, match associations, and progress in the tournament roadmap. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-2">
          <AlertDialogCancel className="rounded-xl border border-border/45 text-foreground hover:bg-white/5 cursor-pointer text-xs font-bold px-4 py-2">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-destructive hover:bg-destructive/95 text-destructive-foreground cursor-pointer text-xs font-bold px-4 py-2 border-0"
            onClick={() => {
              handleSaveRoadmap(null);
              setIsResetDialogOpen(false);
            }}
          >
            Reset Roadmap
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
