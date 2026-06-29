import { Link, useParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getPlayer, getTeam, getPlayerCertificates, getFriends, sendFriendRequest, respondFriendRequest, getMutualFriends } from "@/lib/api";
import { useEffect, useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  UserPlus, UserCheck, Send, UserX, Shield, MapPin, Calendar, 
  Award, Trophy, Info, Target, Sparkles, ChevronRight, Users, Loader2 
} from "lucide-react";
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
import { toast } from "sonner";
import { useApp } from "@/lib/store";

export default function PlayerDetail() {
  const { playerId } = useParams<{ playerId: string }>();
  const [confirmUnfriendOpen, setConfirmUnfriendOpen] = useState(false);
  const [statsTab, setStatsTab] = useState<"batting" | "bowling">("batting");

  // Queries
  const { data: p, isLoading: loadingPlayer } = useQuery({
    queryKey: ["player", playerId],
    queryFn: () => getPlayer({ data: playerId }),
  });

  const { data: team } = useQuery({
    queryKey: ["team", p?.teamId],
    queryFn: () => getTeam({ data: p?.teamId }),
    enabled: !!p && !!p.teamId,
  });

  const { data: certs = [] } = useQuery({
    queryKey: ["player-certs", playerId],
    queryFn: () => getPlayerCertificates({ data: playerId }),
  });

  const user = useApp((s) => s.user);
  const queryClient = useQueryClient();

  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: () => getFriends(),
    enabled: !!user,
  });

  const { friends = [], pendingReceived = [], pendingSent = [] } = friendsData || {};

  // ponytail: query mutual friends
  const { data: mutualFriends = [], isLoading: loadingMutual } = useQuery({
    queryKey: ["mutual-friends", playerId || ""],
    queryFn: () => getMutualFriends({ data: playerId || "" }),
    enabled: !!user && user.playerId !== playerId && !!p,
  });

  const isFriend = friends.some((f: any) => f.id === playerId);
  const isRequestSent = pendingSent.some((f: any) => f.id === playerId);
  const isRequestReceived = pendingReceived.some((f: any) => f.id === playerId);

  const sendRequestMutation = useMutation({
    mutationFn: () => sendFriendRequest({ targetPlayerId: playerId || "" }),
    onSuccess: () => {
      toast.success("Friend request sent!");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send request.");
    }
  });

  const respondMutation = useMutation({
    mutationFn: (action: "accept" | "decline" | "cancel" | "unfriend") => respondFriendRequest({ targetPlayerId: playerId || "", action }),
    onSuccess: (_, action) => {
      if (action === "accept") toast.success("Friend request accepted!");
      else if (action === "decline") toast.success("Friend request declined.");
      else if (action === "cancel") toast.success("Friend request cancelled.");
      else if (action === "unfriend") toast.success("Unfriended successfully.");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["mutual-friends", playerId || ""] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to respond.");
    }
  });

  useEffect(() => {
    if (p) {
      document.title = `${p.name} — Stadium Night`;
    } else {
      document.title = "Player Details — Stadium Night";
    }
  }, [p]);

  if (loadingPlayer) {
    return (
      <AppShell title="Player">
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!p) {
    return (
      <AppShell title="Player Not Found">
        <div className="text-center py-24">
          <h2 className="font-display text-2xl text-destructive">Player Not Found</h2>
          <p className="text-muted-foreground text-sm mt-2">The player you are looking for does not exist.</p>
          <Link to="/home" className="inline-block mt-4 text-primary hover:underline">Back to Home</Link>
        </div>
      </AppShell>
    );
  }

  // Calculate stats
  const battingInnings = p.stats?.innings || 0;
  const battingRuns = p.stats?.runs || 0;
  const battingNotOuts = p.stats?.notOuts || 0;
  const battingBalls = p.stats?.ballsFaced || 0;
  
  const avg = battingInnings - battingNotOuts > 0
    ? (battingRuns / (battingInnings - battingNotOuts)).toFixed(2)
    : "—";
    
  const sr = battingBalls > 0 
    ? ((battingRuns / battingBalls) * 100).toFixed(2) 
    : "—";
    
  const econ = p.stats?.ballsBowled && p.stats.ballsBowled > 0 
    ? (p.stats.runsConceded / (p.stats.ballsBowled / 6)).toFixed(2) 
    : "—";

  return (
    <AppShell title="Player Profile">
      {/* Premium Hero Banner Header */}
      <div className="relative rounded-3xl overflow-hidden border border-border/40 bg-elevated/10 shadow-glow shadow-primary/5 p-6 mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5 opacity-40 pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-center gap-6 justify-between relative z-10">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left min-w-0 flex-1">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-primary to-secondary rounded-full blur opacity-40 group-hover:opacity-75 transition duration-300" />
              <Avatar className="h-24 w-24 border border-border/50 bg-elevated/80 relative">
                {p.picture && <AvatarImage src={p.picture} alt={p.name} />}
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-primary text-3xl font-display font-bold">
                  {p.initials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{p.name}</h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5">
                {team ? (
                  <Link
                    to={`/teams/${team.id}`}
                    className="text-xs px-3 py-1 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary font-semibold transition"
                  >
                    {team.name} XI · #{p.jersey || 0}
                  </Link>
                ) : (
                  <span className="text-xs px-3 py-1 rounded-full bg-muted/20 border border-border/40 text-muted-foreground">
                    Free Agent · #{p.jersey || 0}
                  </span>
                )}
                <span className="text-xs px-3 py-1 rounded-full bg-secondary/15 border border-secondary/25 text-secondary font-medium">
                  {p.role}
                </span>
              </div>
            </div>
          </div>

          {/* ponytail: Action buttons for adding friend */}
          {user && user.playerId !== p.id && (
            <div className="shrink-0 flex gap-2 w-full sm:w-auto justify-center">
              {isFriend && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmUnfriendOpen(true)}
                  className="w-full sm:w-auto gap-2 cursor-pointer rounded-2xl border-emerald-500/20 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/30"
                >
                  <UserCheck className="h-4 w-4" /> Friends
                </Button>
              )}
              {isRequestSent && (
                <Button
                  variant="outline"
                  onClick={() => respondMutation.mutate("cancel")}
                  className="w-full sm:w-auto gap-2 cursor-pointer rounded-2xl border-border/40 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition duration-200"
                >
                  <Send className="h-4 w-4 text-primary animate-pulse" /> Request Pending
                </Button>
              )}
              {isRequestReceived && (
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="lime"
                    onClick={() => respondMutation.mutate("accept")}
                    className="flex-1 sm:flex-none rounded-2xl font-bold cursor-pointer px-5"
                    disabled={respondMutation.isPending}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => respondMutation.mutate("decline")}
                    className="flex-1 sm:flex-none rounded-2xl cursor-pointer text-destructive border-destructive/20 hover:bg-destructive/15 px-5"
                    disabled={respondMutation.isPending}
                  >
                    Decline
                  </Button>
                </div>
              )}
              {!isFriend && !isRequestSent && !isRequestReceived && (
                <Button
                  variant="lime"
                  onClick={() => sendRequestMutation.mutate()}
                  className="w-full sm:w-auto gap-2 cursor-pointer rounded-2xl shadow-glow font-bold px-6 py-2.5"
                  disabled={sendRequestMutation.isPending}
                >
                  <UserPlus className="h-4 w-4" /> Add Friend
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bio / Player Passport Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col justify-between transition hover:border-primary/20 hover:bg-elevated/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary" /> Role
          </span>
          <span className="text-sm font-semibold mt-2 text-foreground">{p.role || "Player"}</span>
        </div>
        <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col justify-between transition hover:border-primary/20 hover:bg-elevated/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-secondary" /> Batting
          </span>
          <span className="text-sm font-semibold mt-2 text-foreground">{p.battingStyle || "Right-hand"}</span>
        </div>
        <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col justify-between transition hover:border-primary/20 hover:bg-elevated/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Bowling
          </span>
          <span className="text-sm font-semibold mt-2 text-foreground">{p.bowlingStyle || "Right-arm medium"}</span>
        </div>
        <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col justify-between transition hover:border-primary/20 hover:bg-elevated/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-destructive" /> Location
          </span>
          <span className="text-sm font-semibold mt-2 text-foreground">
            {[p.city, p.country].filter(Boolean).join(", ") || "India"}
          </span>
        </div>
        <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col justify-between transition hover:border-primary/20 hover:bg-elevated/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-sky-400" /> Age
          </span>
          <span className="text-sm font-semibold mt-2 text-foreground">{p.age ? `${p.age} years` : "—"}</span>
        </div>
        <div className="bg-elevated/20 border border-border/30 rounded-2xl p-4 flex flex-col justify-between transition hover:border-primary/20 hover:bg-elevated/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-emerald-500" /> Joined
          </span>
          <span className="text-sm font-semibold mt-2 text-foreground">{p.joinedAt || "—"}</span>
        </div>
      </div>

      {/* ponytail: Mutual Friends section */}
      {user && user.playerId !== p.id && (
        <div className="mb-6 border border-border/30 bg-elevated/15 rounded-3xl p-5 backdrop-blur-md">
          <h3 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" /> Mutual Friends
          </h3>
          {loadingMutual ? (
            <div className="flex gap-2 items-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Finding mutual connections...</span>
            </div>
          ) : mutualFriends.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {mutualFriends.map((f: any) => (
                <Link
                  key={f.id}
                  to={`/players/${f.id}`}
                  className="flex items-center gap-2.5 bg-elevated/30 hover:bg-elevated/75 border border-border/20 hover:border-primary/20 rounded-xl p-2 transition cursor-pointer"
                >
                  <Avatar className="h-8 w-8 border border-border/40">
                    {f.picture && <AvatarImage src={f.picture} alt={f.name} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-display font-bold">
                      {f.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-xs font-semibold text-foreground truncate max-w-[100px]">{f.name}</div>
                    <div className="text-[9px] text-muted-foreground truncate max-w-[100px]">{f.role}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic py-1">No mutual friends between you and {p.name}.</p>
          )}
        </div>
      )}

      {/* Redesigned Career Stats Dashboard */}
      <div className="border border-border/40 bg-elevated/5 rounded-3xl p-5 mb-6 shadow-sm">
        <div className="flex justify-between items-center border-b border-border/20 pb-4 mb-4">
          <h2 className="font-display text-xl font-bold flex items-center gap-2 text-foreground">
            <Trophy className="h-5 w-5 text-amber-500" /> Career Stats
          </h2>
          <div className="flex bg-elevated/40 p-1 rounded-xl border border-border/30">
            <button
              onClick={() => setStatsTab("batting")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition duration-200 cursor-pointer ${
                statsTab === "batting" 
                  ? "bg-primary text-primary-foreground font-bold shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Batting
            </button>
            <button
              onClick={() => setStatsTab("bowling")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition duration-200 cursor-pointer ${
                statsTab === "bowling" 
                  ? "bg-primary text-primary-foreground font-bold shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Bowling & Fielding
            </button>
          </div>
        </div>

        {statsTab === "batting" ? (
          <div className="space-y-4">
            {/* Highlight Batting Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl p-4 border border-border/40 bg-elevated/30 flex flex-col justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Runs</span>
                <span className="font-display text-3xl font-extrabold text-primary mt-2">{p.stats?.runs || 0}</span>
              </div>
              <div className="rounded-2xl p-4 border border-border/40 bg-elevated/30 flex flex-col justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Average</span>
                <span className="font-display text-3xl font-extrabold text-foreground mt-2">{avg}</span>
              </div>
              <div className="rounded-2xl p-4 border border-border/40 bg-elevated/30 flex flex-col justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Strike Rate</span>
                <span className="font-display text-3xl font-extrabold text-foreground mt-2">{sr}</span>
              </div>
              <div className="rounded-2xl p-4 border border-border/40 bg-elevated/30 flex flex-col justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">High Score</span>
                <span className="font-display text-3xl font-extrabold text-foreground mt-2">{p.stats?.highScore || 0}</span>
              </div>
            </div>

            {/* Detailed Batting Metrics */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2">
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Matches</div>
                <div className="font-display text-lg font-bold mt-0.5">{p.stats?.matches || 0}</div>
              </div>
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Innings</div>
                <div className="font-display text-lg font-bold mt-0.5">{p.stats?.innings || 0}</div>
              </div>
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Not Outs</div>
                <div className="font-display text-lg font-bold mt-0.5">{p.stats?.notOuts || 0}</div>
              </div>
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">50s / 100s</div>
                <div className="font-display text-lg font-bold mt-0.5">
                  {p.stats?.fifties || 0} <span className="text-xs text-muted-foreground font-normal">/</span> {p.stats?.hundreds || 0}
                </div>
              </div>
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">4s</div>
                <div className="font-display text-lg font-bold mt-0.5">{p.stats?.fours || 0}</div>
              </div>
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">6s</div>
                <div className="font-display text-lg font-bold mt-0.5">{p.stats?.sixes || 0}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Highlight Bowling Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl p-4 border border-border/40 bg-elevated/30 flex flex-col justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Wickets</span>
                <span className="font-display text-3xl font-extrabold text-primary mt-2">{p.stats?.wickets || 0}</span>
              </div>
              <div className="rounded-2xl p-4 border border-border/40 bg-elevated/30 flex flex-col justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Economy</span>
                <span className="font-display text-3xl font-extrabold text-foreground mt-2">{econ}</span>
              </div>
              <div className="rounded-2xl p-4 border border-border/40 bg-elevated/30 flex flex-col justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Best Bowling</span>
                <span className="font-display text-3xl font-extrabold text-foreground mt-2">{p.stats?.bestBowling || "0/0"}</span>
              </div>
            </div>

            {/* Detailed Bowling & Fielding Metrics */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-2">
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Overs</div>
                <div className="font-display text-lg font-bold mt-0.5">
                  {p.stats?.ballsBowled ? (p.stats.ballsBowled / 6).toFixed(1) : 0}
                </div>
              </div>
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Runs Conc.</div>
                <div className="font-display text-lg font-bold mt-0.5">{p.stats?.runsConceded || 0}</div>
              </div>
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Balls Bowled</div>
                <div className="font-display text-lg font-bold mt-0.5">{p.stats?.ballsBowled || 0}</div>
              </div>
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Catches</div>
                <div className="font-display text-lg font-bold mt-0.5">{p.stats?.catches || 0}</div>
              </div>
              <div className="rounded-xl p-2.5 border border-border/20 bg-elevated/10 text-center">
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Stumpings</div>
                <div className="font-display text-lg font-bold mt-0.5">{p.stats?.stumpings || 0}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Achievements Section */}
      {p.achievements && p.achievements.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Achievements
          </h2>
          <div className="flex flex-wrap gap-2">
            {p.achievements.map((a: string) => (
              <span
                key={a}
                className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium hover:bg-primary/15 transition"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Certificates Section */}
      {certs.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-secondary" /> Issued Certificates
          </h2>
          <div className="grid gap-2">
            {certs.map((c: any) => (
              <div
                key={c.id}
                className="bg-elevated/20 border border-border/40 hover:border-primary/20 rounded-2xl p-4 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-secondary/15 flex items-center justify-center text-secondary">
                    <Award className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-foreground block">{c.type}</span>
                    <span className="text-[10px] text-muted-foreground block">Verified Certificate</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-medium">{c.issuedOn}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unfriend Confirm Dialog */}
      <AlertDialog open={confirmUnfriendOpen} onOpenChange={setConfirmUnfriendOpen}>
        <AlertDialogContent className="glass-card border border-destructive/30 rounded-3xl shadow-2xl max-w-sm p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-lg text-foreground flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              Unfriend {p.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground mt-2">
              Are you sure you want to remove {p.name} from your friends list? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-4">
            <AlertDialogCancel className="rounded-xl border border-border/40 bg-elevated/40 hover:bg-elevated text-foreground cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                respondMutation.mutate("unfriend");
                setConfirmUnfriendOpen(false);
              }}
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold cursor-pointer"
            >
              Unfriend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
