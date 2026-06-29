import { Link, useParams } from "react-router-dom";
import { AppShell, StatPill } from "@/components/AppShell";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getPlayer, getTeam, getPlayerCertificates, getFriends, sendFriendRequest, respondFriendRequest } from "@/lib/api";
import { useEffect, useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/store";

export default function PlayerDetail() {
  const { playerId } = useParams<{ playerId: string }>();

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

  const isFriend = friends.some((f: any) => f.id === playerId);
  const isRequestSent = pendingSent.some((f: any) => f.id === playerId);
  const isRequestReceived = pendingReceived.some((f: any) => f.id === playerId);

  const sendRequestMutation = useMutation({
    mutationFn: () => sendFriendRequest({ targetPlayerId: playerId }),
    onSuccess: () => {
      toast.success("Friend request sent!");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send request.");
    }
  });

  const respondMutation = useMutation({
    mutationFn: (action: "accept" | "decline" | "cancel" | "unfriend") => respondFriendRequest({ targetPlayerId: playerId, action }),
    onSuccess: (_, action) => {
      if (action === "accept") toast.success("Friend request accepted!");
      else if (action === "decline") toast.success("Friend request declined.");
      else if (action === "cancel") toast.success("Friend request cancelled.");
      else if (action === "unfriend") toast.success("Unfriended successfully.");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
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
          <div className="h-10 w-10 rounded-full border-t-2 border-primary animate-spin" />
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

  const avg =
    p.stats && p.stats.innings - p.stats.notOuts > 0
      ? (p.stats.runs / (p.stats.innings - p.stats.notOuts)).toFixed(2)
      : "—";
  const sr = p.stats && p.stats.ballsFaced > 0 ? ((p.stats.runs / p.stats.ballsFaced) * 100).toFixed(2) : "—";
  const econ =
    p.stats && p.stats.ballsBowled > 0 ? (p.stats.runsConceded / (p.stats.ballsBowled / 6)).toFixed(2) : "—";

  return (
    <AppShell title="Player">
      <div className="gradient-card border border-border rounded-2xl p-5 shadow-card">
        <div className="flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Avatar className="h-16 w-16 border border-border/40 shrink-0">
              {p.picture && <AvatarImage src={p.picture} alt={p.name} />}
              <AvatarFallback className="bg-primary/15 text-primary text-xl font-display flex items-center justify-center h-full w-full font-bold">
                {p.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl truncate">{p.name}</h1>
              {team ? (
                <Link
                  to={`/teams/${team.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  {team.name} · #{p.jersey || 0}
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground">Unassigned · #{p.jersey || 0}</span>
              )}
              <div className="text-xs text-muted-foreground mt-0.5">
                {p.role} · {p.battingStyle} · {p.bowlingStyle}
              </div>
            </div>
          </div>

          {/* ponytail: Show add friend actions on visiting other players' profiles */}
          {user && user.playerId !== p.id && (
            <div className="shrink-0 flex gap-2">
              {isFriend && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Are you sure you want to unfriend ${p.name}?`)) {
                      respondMutation.mutate("unfriend");
                    }
                  }}
                  className="gap-1.5 cursor-pointer rounded-xl border-emerald-500/20 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10"
                >
                  <UserCheck className="h-3.5 w-3.5" /> Friends
                </Button>
              )}
              {isRequestSent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => respondMutation.mutate("cancel")}
                  className="gap-1.5 cursor-pointer rounded-xl border-border/40 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                >
                  <Send className="h-3.5 w-3.5 text-primary animate-pulse" /> Pending
                </Button>
              )}
              {isRequestReceived && (
                <div className="flex gap-1.5">
                  <Button
                    variant="lime"
                    size="sm"
                    onClick={() => respondMutation.mutate("accept")}
                    className="rounded-xl font-bold cursor-pointer"
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => respondMutation.mutate("decline")}
                    className="rounded-xl cursor-pointer text-destructive border-destructive/20 hover:bg-destructive/15"
                  >
                    Decline
                  </Button>
                </div>
              )}
              {!isFriend && !isRequestSent && !isRequestReceived && (
                <Button
                  variant="lime"
                  size="sm"
                  onClick={() => sendRequestMutation.mutate()}
                  className="gap-1.5 cursor-pointer rounded-xl shadow-glow font-bold"
                  disabled={sendRequestMutation.isPending}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add Friend
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 mt-4">
          <StatPill label="Matches" value={p.stats?.matches || 0} />
          <StatPill label="Runs" value={p.stats?.runs || 0} accent />
          <StatPill label="Wkts" value={p.stats?.wickets || 0} />
          <StatPill label="HS" value={p.stats?.highScore || 0} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <StatPill label="Avg" value={avg} />
          <StatPill label="SR" value={sr} />
          <StatPill label="Econ" value={econ} />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <StatPill label="50s" value={p.stats?.fifties || 0} />
          <StatPill label="100s" value={p.stats?.hundreds || 0} />
          <StatPill label="4s" value={p.stats?.fours || 0} />
          <StatPill label="6s" value={p.stats?.sixes || 0} />
        </div>
      </div>

      {p.achievements && p.achievements.length > 0 && (
        <>
          <h2 className="font-display text-2xl mt-6 mb-3">Achievements</h2>
          <div className="flex flex-wrap gap-2">
            {p.achievements.map((a: string) => (
              <span
                key={a}
                className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/30"
              >
                {a}
              </span>
            ))}
          </div>
        </>
      )}

      {certs.length > 0 && (
        <>
          <h2 className="font-display text-2xl mt-6 mb-3">Certificates</h2>
          <div className="grid gap-2">
            {certs.map((c: any) => (
              <div
                key={c.id}
                className="bg-elevated border border-border rounded-xl p-3 flex items-center justify-between"
              >
                <span className="font-medium">{c.type}</span>
                <span className="text-xs text-muted-foreground">{c.issuedOn}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
