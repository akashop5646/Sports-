import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getFriends, searchPlayerByCode, sendFriendRequest, respondFriendRequest } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, Check, Search, UserPlus, UserCheck, UserMinus, X, Loader2, Sparkles, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/store";

interface AddFriendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFriendModal({ open, onOpenChange }: AddFriendModalProps) {
  const user = useApp((s) => s.user);
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [searchedPlayer, setSearchedPlayer] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Queries
  const { data: friendsData, isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: () => getFriends(),
    enabled: open && !!user,
  });

  const { friends = [], pendingReceived = [], pendingSent = [] } = friendsData || {};

  // Copy friend code helper
  const handleCopyCode = () => {
    if (user?.playerCode) {
      navigator.clipboard.writeText(user.playerCode);
      setCopied(true);
      toast.success("Friend code copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Search player mutation
  const searchMutation = useMutation({
    mutationFn: (code: string) => searchPlayerByCode({ data: code }),
    onSuccess: (data) => {
      setSearchedPlayer(data);
    },
    onError: () => {
      setSearchedPlayer(null);
      toast.error("No player found with that friend code.");
    }
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCode.trim()) return;
    setIsSearching(true);
    try {
      await searchMutation.mutate(searchCode.trim());
    } catch {
      // Error handled by mutation onError
    } finally {
      setIsSearching(false);
    }
  };

  // Friend Request Mutations
  const sendRequestMutation = useMutation({
    mutationFn: (payload: { friendCode?: string; targetPlayerId?: string }) => sendFriendRequest(payload),
    onSuccess: () => {
      toast.success("Friend request sent!");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      // Reset search
      setSearchCode("");
      setSearchedPlayer(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send request.");
    }
  });

  const respondMutation = useMutation({
    mutationFn: (payload: { targetPlayerId: string; action: "accept" | "decline" | "cancel" }) => respondFriendRequest(payload),
    onSuccess: (_, variables) => {
      if (variables.action === "accept") {
        toast.success("Friend request accepted!");
      } else if (variables.action === "decline") {
        toast.success("Friend request declined.");
      } else if (variables.action === "cancel") {
        toast.success("Friend request cancelled.");
      }
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to respond.");
    }
  });

  const handleUnfriendMutation = useMutation({
    mutationFn: (payload: { targetPlayerId: string; action: "unfriend" }) => respondFriendRequest(payload),
    onSuccess: () => {
      toast.success("Unfriended successfully.");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to unfriend.");
    }
  });

  // Determine friendship status of the searched player
  const getSearchPlayerStatus = () => {
    if (!searchedPlayer) return null;
    if (friends.some((f: any) => f.id === searchedPlayer.id)) return "friends";
    if (pendingSent.some((p: any) => p.id === searchedPlayer.id)) return "sent";
    if (pendingReceived.some((p: any) => p.id === searchedPlayer.id)) return "received";
    return "none";
  };

  const status = getSearchPlayerStatus();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <DialogTitle className="font-display text-2xl mb-4 text-foreground flex items-center gap-2 border-b border-border/10 pb-3 shrink-0">
          <UserPlus className="h-5 w-5 text-primary" />
          Add a Friend
        </DialogTitle>

        <div className="flex-1 overflow-y-auto pr-1 space-y-5 scrollbar-thin scrollbar-thumb-white/10">
          {/* Your Friend Code display */}
          <div className="gradient-card border border-border/30 rounded-2xl p-4 flex items-center justify-between shadow-card">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Your Friend Code</div>
              <div className="font-display text-2xl font-bold text-primary mt-1 tracking-wider">
                {user?.playerCode || "——"}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              className="gap-1.5 border-border/40 hover:bg-white/5 cursor-pointer rounded-xl"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {/* Search form */}
          <form onSubmit={handleSearch} className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">
              <Search className="h-3 w-3" /> Enter Friend Code
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="e.g. 12345678"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="bg-elevated/20 border-border/60 focus:border-primary h-10 rounded-xl tracking-wider text-center font-display"
                maxLength={8}
              />
              <Button
                type="submit"
                variant="lime"
                className="h-10 px-4 rounded-xl cursor-pointer font-bold shrink-0"
                disabled={isSearching || !searchCode.trim()}
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
          </form>

          {/* Search Result display */}
          {searchedPlayer && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 animate-fade-up space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-primary/20 bg-primary/10">
                  {searchedPlayer.picture && <AvatarImage src={searchedPlayer.picture} alt={searchedPlayer.name} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-display font-bold">
                    {searchedPlayer.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm font-semibold truncate text-foreground">{searchedPlayer.name}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{searchedPlayer.role}</div>
                </div>
              </div>

              <div className="pt-1 flex gap-2">
                {status === "friends" && (
                  <Button variant="outline" className="w-full text-xs font-semibold gap-1.5 cursor-pointer rounded-xl border-emerald-500/20 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10" disabled>
                    <UserCheck className="h-3.5 w-3.5" /> Friends
                  </Button>
                )}
                {status === "sent" && (
                  <div className="flex gap-2 w-full">
                    <Button variant="outline" className="w-full text-xs font-semibold gap-1.5 rounded-xl border-border/40 cursor-default" disabled>
                      <Send className="h-3.5 w-3.5 text-primary" /> Request Pending
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => respondMutation.mutate({ targetPlayerId: searchedPlayer.id, action: "cancel" })}
                      className="px-3 rounded-xl cursor-pointer"
                      disabled={respondMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                {status === "received" && (
                  <div className="flex gap-2 w-full">
                    <Button
                      variant="lime"
                      className="flex-1 text-xs font-semibold gap-1.5 cursor-pointer rounded-xl"
                      onClick={() => respondMutation.mutate({ targetPlayerId: searchedPlayer.id, action: "accept" })}
                      disabled={respondMutation.isPending}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-xs font-semibold gap-1.5 cursor-pointer rounded-xl border-destructive/20 text-destructive hover:bg-destructive/15"
                      onClick={() => respondMutation.mutate({ targetPlayerId: searchedPlayer.id, action: "decline" })}
                      disabled={respondMutation.isPending}
                    >
                      Decline
                    </Button>
                  </div>
                )}
                {status === "none" && (
                  <Button
                    variant="lime"
                    className="w-full text-xs font-semibold gap-1.5 cursor-pointer rounded-xl shadow-glow"
                    onClick={() => sendRequestMutation.mutate({ targetPlayerId: searchedPlayer.id })}
                    disabled={sendRequestMutation.isPending}
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Add Friend
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Pending Invites (Received) */}
          {pendingReceived.length > 0 && (
            <div className="space-y-2 animate-fade-up">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1 border-b border-border/10 pb-1">
                <span>Received Requests ({pendingReceived.length})</span>
              </div>
              <div className="space-y-2">
                {pendingReceived.map((p: any) => (
                  <div key={p.id} className="bg-elevated/20 border border-border/30 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-8 w-8 border border-border/40">
                        {p.picture && <AvatarImage src={p.picture} alt={p.name} />}
                        <AvatarFallback className="text-[10px]">{p.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link to={`/players/${p.id}`} onClick={() => onOpenChange(false)} className="text-xs font-semibold hover:underline block truncate">
                          {p.name}
                        </Link>
                        <span className="text-[9px] text-muted-foreground truncate block">{p.role}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        variant="lime"
                        size="sm"
                        onClick={() => respondMutation.mutate({ targetPlayerId: p.id, action: "accept" })}
                        className="rounded-lg font-semibold"
                        disabled={respondMutation.isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => respondMutation.mutate({ targetPlayerId: p.id, action: "decline" })}
                        className="rounded-lg text-destructive hover:bg-destructive/15 border-destructive/20"
                        disabled={respondMutation.isPending}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Invites (Sent) */}
          {pendingSent.length > 0 && (
            <div className="space-y-2 animate-fade-up">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1 border-b border-border/10 pb-1">
                <span>Sent Requests ({pendingSent.length})</span>
              </div>
              <div className="space-y-2">
                {pendingSent.map((p: any) => (
                  <div key={p.id} className="bg-elevated/20 border border-border/30 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-8 w-8 border border-border/40">
                        {p.picture && <AvatarImage src={p.picture} alt={p.name} />}
                        <AvatarFallback className="text-[10px]">{p.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link to={`/players/${p.id}`} onClick={() => onOpenChange(false)} className="text-xs font-semibold hover:underline block truncate">
                          {p.name}
                        </Link>
                        <span className="text-[9px] text-muted-foreground truncate block">{p.role}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => respondMutation.mutate({ targetPlayerId: p.id, action: "cancel" })}
                      className="rounded-lg hover:bg-destructive/15 border-destructive/15 text-destructive font-semibold"
                      disabled={respondMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1 border-b border-border/10 pb-1">
              <Users className="h-3 w-3" />
              <span>Friends ({friends.length})</span>
            </div>
            {loadingFriends ? (
              <div className="text-center py-4 text-xs text-muted-foreground">Loading friends...</div>
            ) : friends.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground italic">No friends added yet.</div>
            ) : (
              <div className="space-y-2">
                {friends.map((p: any) => (
                  <div key={p.id} className="bg-elevated/15 border border-border/30 rounded-2xl p-3 flex items-center justify-between gap-3 transition hover:border-border/60">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-8 w-8 border border-border/40">
                        {p.picture && <AvatarImage src={p.picture} alt={p.name} />}
                        <AvatarFallback className="text-[10px]">{p.initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link to={`/players/${p.id}`} onClick={() => onOpenChange(false)} className="text-xs font-semibold hover:underline block truncate text-foreground hover:text-primary">
                          {p.name}
                        </Link>
                        <span className="text-[9px] text-muted-foreground truncate block">{p.role}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Are you sure you want to unfriend ${p.name}?`)) {
                          handleUnfriendMutation.mutate({ targetPlayerId: p.id, action: "unfriend" });
                        }
                      }}
                      className="rounded-lg hover:bg-destructive/15 border-destructive/15 text-destructive"
                      disabled={handleUnfriendMutation.isPending}
                    >
                      Unfriend
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
