import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/store";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useQuery, useMutation } from "@/hooks/useApi";
import { Trophy, Award, Calendar, MapPin, Users, UserPlus, Check, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getFriends, sendSquadInvite } from "@/lib/api";
import * as React from "react";

interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateModal({ open, onOpenChange }: CreateModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createTournament = useApp((s) => s.createTournament);
  const joinTournament = useApp((s) => s.joinTournament);
  const joinTeam = useApp((s) => s.joinTeam);
  const user = useApp((s) => s.user);

  // Tournament Form Mode ("quick" or "detailed")
  const [tMode, setTMode] = useState<"quick" | "detailed">("quick");

  const [tName, setTName] = useState("");
  const [prizePool, setPrizePool] = useState("");
  const [tDate, setTDate] = useState(new Date().toISOString().slice(0, 10));
  const [city, setCity] = useState("");
  const [joinTCode, setJoinTCode] = useState("");
  const [joinTeamCode, setJoinTeamCode] = useState("");

  const [loading, setLoading] = useState(false);

  // ponytail: invite friends step state
  const [inviteStep, setInviteStep] = useState(false);
  const [joinedTeamId, setJoinedTeamId] = useState<string | null>(null);
  const [joinedTournamentName, setJoinedTournamentName] = useState("");
  const [joinedTournamentId, setJoinedTournamentId] = useState<string | null>(null);
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());

  // Fetch friends only when invite step is active
  const { data: friendsData, isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: () => getFriends(),
    enabled: inviteStep && !!user,
  });
  const friends = friendsData?.friends || [];

  const inviteMutation = useMutation({
    mutationFn: (payload: { teamId: string; targetPlayerId: string }) => sendSquadInvite(payload),
    onSuccess: (_, variables) => {
      setSentInvites(prev => new Set(prev).add(variables.targetPlayerId));
      toast.success("Squad invite sent!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send invite");
    },
  });

  const resetState = () => {
    setInviteStep(false);
    setJoinedTeamId(null);
    setJoinedTournamentName("");
    setJoinedTournamentId(null);
    setSentInvites(new Set());
  };

  const handleClose = (o: boolean) => {
    if (!o) resetState();
    onOpenChange(o);
  };

  const handleCreateTournament = async () => {
    if (!tName.trim()) {
      toast.error("Please enter a tournament name.");
      return;
    }
    setLoading(true);
    try {
      const isQuick = tMode === "quick";
      const id = await createTournament({
        name: tName.trim(),
        ...(isQuick ? {} : {
          format: "T20",
          prizePool: prizePool.trim() || undefined,
          startDate: tDate || undefined,
          city: city.trim() || undefined,
        }),
        detailed: !isQuick,
      });
      toast.success("Tournament created successfully!");
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      handleClose(false);
      setTName("");
      setPrizePool("");
      setTDate(new Date().toISOString().slice(0, 10));
      setCity("");
      navigate(`/tournaments/${id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to create tournament.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTournament = async () => {
    if (!joinTCode.trim()) {
      toast.error("Please enter an invite code.");
      return;
    }
    setLoading(true);
    try {
      const t = await joinTournament(joinTCode.trim());
      toast.success(`Successfully joined tournament ${t.name}!`);
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournament", t.id] });
      queryClient.invalidateQueries({ queryKey: ["tournament-squads", t.id] });

      // ponytail: find the team the user just created to enable invite step
      const teamsRes = await fetch(`/api/tournaments/${t.id}/squads`);
      const squads = await teamsRes.json();
      const myTeam = squads.find((sq: any) => sq.captainId === user?.playerId);

      if (myTeam) {
        setJoinedTeamId(myTeam.id);
        setJoinedTournamentName(t.name);
        setJoinedTournamentId(t.id);
        setInviteStep(true);
        setJoinTCode("");
      } else {
        handleClose(false);
        setJoinTCode("");
        navigate(`/tournaments/${t.id}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Invalid tournament code.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!joinTeamCode.trim()) {
      toast.error("Please enter a team code.");
      return;
    }
    setLoading(true);
    try {
      const team = await joinTeam(joinTeamCode.trim());
      toast.success(`Successfully joined squad of ${team.name}!`);
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team", team.id] });
      queryClient.invalidateQueries({ queryKey: ["team-players", team.id] });
      queryClient.invalidateQueries({ queryKey: ["tournament-squads", team.tournamentId] });
      handleClose(false);
      setJoinTeamCode("");
      navigate(`/teams/${team.id}`);
    } catch (e: any) {
      toast.error(e.message || "Invalid team invite code.");
    } finally {
      setLoading(false);
    }
  };

  const handleDoneInviting = () => {
    const tid = joinedTournamentId;
    handleClose(false);
    if (tid) navigate(`/tournaments/${tid}`);
  };

  // ponytail: invite friends step UI
  if (inviteStep && joinedTeamId) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl animate-scale-in max-h-[85vh] flex flex-col">
          <DialogTitle className="font-display text-xl mb-2 text-foreground flex items-center gap-2 border-b border-border/10 pb-3 shrink-0">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite Friends to Squad
          </DialogTitle>

          <p className="text-xs text-muted-foreground mb-3 shrink-0">
            You joined <span className="text-foreground font-semibold">{joinedTournamentName}</span> as captain. Invite friends to your team!
          </p>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
            {loadingFriends ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No friends yet. Share your team code or add friends first!
              </div>
            ) : (
              friends.map((f: any) => {
                const invited = sentInvites.has(f.id);
                return (
                  <div
                    key={f.id}
                    className="bg-elevated/15 border border-border/30 rounded-2xl p-3 flex items-center justify-between gap-3 transition hover:border-border/60"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Avatar className="h-9 w-9 border border-border/40">
                        {f.picture && <AvatarImage src={f.picture} alt={f.name} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-display font-bold">
                          {f.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate text-foreground">{f.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{f.role}</div>
                      </div>
                    </div>
                    {invited ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-xs font-semibold gap-1 border-emerald-500/20 bg-emerald-500/5 text-emerald-500 cursor-default shrink-0"
                        disabled
                      >
                        <Check className="h-3.5 w-3.5" /> Invited
                      </Button>
                    ) : (
                      <Button
                        variant="lime"
                        size="sm"
                        className="rounded-lg text-xs font-semibold gap-1 cursor-pointer shrink-0"
                        onClick={() => inviteMutation.mutate({ teamId: joinedTeamId, targetPlayerId: f.id })}
                        disabled={inviteMutation.isPending}
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Invite
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex gap-2 mt-3 shrink-0">
            <Button
              variant="lime"
              className="flex-1 rounded-xl cursor-pointer font-display"
              onClick={handleDoneInviting}
            >
              {sentInvites.size > 0 ? `Done (${sentInvites.size} invited)` : "Skip & Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl animate-scale-in">
        <DialogTitle className="font-display text-2xl mb-3 text-foreground flex items-center gap-2 border-b border-border/10 pb-3">
          <Trophy className="h-6 w-6 text-muted-foreground" />
          Create or Join
        </DialogTitle>
        <Tabs defaultValue="tournament" className="w-full">
          <TabsList className="grid grid-cols-3 w-full bg-elevated/40 backdrop-blur-md border border-border/40 rounded-xl p-1 mb-2">
            <TabsTrigger value="tournament" className="text-xs font-semibold">Tournament</TabsTrigger>
            <TabsTrigger value="join-team" className="text-xs font-semibold">Join Team</TabsTrigger>
            <TabsTrigger value="join-t" className="text-xs font-semibold">Join League</TabsTrigger>
          </TabsList>

          {/* Create Tournament */}
          <TabsContent value="tournament" className="mt-3 space-y-4">
            
            {/* Mode Selector */}
            <div className="flex bg-elevated/55 p-1 rounded-xl border border-border/20">
              <button
                type="button"
                onClick={() => setTMode("quick")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition duration-200 cursor-pointer ${
                  tMode === "quick"
                    ? "bg-primary text-primary-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Quick Create (Name only)
              </button>
              <button
                type="button"
                onClick={() => setTMode("detailed")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition duration-200 cursor-pointer ${
                  tMode === "detailed"
                    ? "bg-primary text-primary-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Detailed (Full info)
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <div className="space-y-1 animate-fade-up" style={{ animationDelay: "60ms" }}>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-primary" /> Tournament Name
                </label>
                <Input
                  placeholder="e.g. Winter Cricket League"
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                  disabled={loading}
                  className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
                />
              </div>

              {/* Animated expand for detailed fields */}
              <div
                className="overflow-hidden"
                style={{
                  display: "grid",
                  gridTemplateRows: tMode === "detailed" ? "1fr" : "0fr",
                  transition: "grid-template-rows 0.38s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <div className="min-h-0">
                  <div
                    className="space-y-3 pt-1"
                    style={{
                      opacity: tMode === "detailed" ? 1 : 0,
                      transform: tMode === "detailed" ? "translateY(0)" : "translateY(-8px)",
                      transition: "opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1) 0.05s, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1) 0.05s",
                    }}
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                        <Award className="h-3 w-3 text-primary" /> Prize Money
                      </label>
                      <Input
                        placeholder="e.g. ₹50,000 or ₹1 Lakh"
                        value={prizePool}
                        onChange={(e) => setPrizePool(e.target.value)}
                        disabled={loading}
                        className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-primary" /> Start Date
                      </label>
                      <Input
                        type="date"
                        value={tDate}
                        onChange={(e) => setTDate(e.target.value)}
                        disabled={loading}
                        className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-primary" /> Location
                      </label>
                      <Input
                        placeholder="e.g. Mumbai, India"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        disabled={loading}
                        className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button variant="lime" className="w-full cursor-pointer mt-2 shadow-sm rounded-xl py-2 font-display" onClick={handleCreateTournament} disabled={loading}>
              {loading ? "Creating…" : "Create Tournament"}
            </Button>
          </TabsContent>

          {/* Join Team (Player) */}
          <TabsContent value="join-team" className="mt-3 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                <Users className="h-3 w-3 text-primary" /> Team Invite Code
              </label>
              <Input
                placeholder="e.g. MMV429"
                value={joinTeamCode}
                onChange={(e) => setJoinTeamCode(e.target.value)}
                disabled={loading}
                className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
              />
            </div>
            <Button variant="lime" className="w-full cursor-pointer mt-2 shadow-sm rounded-xl py-2 font-display" onClick={handleJoinTeam} disabled={loading}>
              {loading ? "Joining…" : "Join Team Squad"}
            </Button>
          </TabsContent>

          {/* Join Tournament (Captain) */}
          <TabsContent value="join-t" className="mt-3 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
                <Trophy className="h-3 w-3 text-primary" /> Tournament Invite Code
              </label>
              <Input
                placeholder="e.g. TRN100"
                value={joinTCode}
                onChange={(e) => setJoinTCode(e.target.value)}
                disabled={loading}
                className="bg-elevated/20 border-border/40 hover:border-border/80 focus:border-primary transition-all duration-300 rounded-xl"
              />
            </div>
            <Button variant="lime" className="w-full cursor-pointer mt-2 shadow-sm rounded-xl py-2 font-display" onClick={handleJoinTournament} disabled={loading}>
              {loading ? "Joining…" : "Join Tournament"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
