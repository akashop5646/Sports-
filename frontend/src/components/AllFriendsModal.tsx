import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getFriends, respondFriendRequest } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserMinus, Search } from "lucide-react";
import { toast } from "sonner";

interface AllFriendsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AllFriendsModal({ open, onOpenChange }: AllFriendsModalProps) {
  const queryClient = useQueryClient();
  const [friendsSearch, setFriendsSearch] = useState("");
  const [unfriendTarget, setUnfriendTarget] = useState<any>(null);

  const { data: friendsData, isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: () => getFriends(),
    enabled: open,
  });

  const { friends = [] } = friendsData || {};

  const handleUnfriendMutation = useMutation({
    mutationFn: (payload: { targetPlayerId: string; action: "unfriend" }) => respondFriendRequest(payload),
    onSuccess: () => {
      toast.success("Unfriended successfully.");
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      setUnfriendTarget(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to unfriend.");
    }
  });

  const filteredFriends = friends.filter((f: any) =>
    friendsSearch.trim()
      ? f.name?.toLowerCase().includes(friendsSearch.toLowerCase()) ||
        f.role?.toLowerCase().includes(friendsSearch.toLowerCase())
      : true
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(o: boolean) => { onOpenChange(o); if (!o) setFriendsSearch(""); }}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="max-w-md border border-border/40 rounded-3xl p-6 glass-card shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        >
          <DialogTitle className="font-display text-2xl mb-3 text-foreground flex items-center gap-2 border-b border-border/10 pb-3 shrink-0">
            <Users className="h-5 w-5 text-primary" />
            All Friends
          </DialogTitle>
          <div className="shrink-0 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search friends..."
                value={friendsSearch}
                onChange={(e) => setFriendsSearch(e.target.value)}
                className="bg-elevated/20 border-border/60 focus:border-primary h-9 pl-9 pr-3 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
            {filteredFriends.map((f: any) => (
              <div key={f.id} className="bg-elevated/15 border border-border/30 rounded-2xl p-3 flex items-center justify-between gap-3 transition hover:border-border/60">
                <Link
                  to={`/players/${f.id}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-2.5 min-w-0 flex-1"
                >
                  <Avatar className="h-9 w-9 border border-border/40">
                    {f.picture && <AvatarImage src={f.picture} alt={f.name} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-display font-bold">
                      {f.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate text-foreground hover:text-primary">{f.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{f.role}</div>
                  </div>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUnfriendTarget(f)}
                  className="rounded-lg hover:bg-destructive/15 border-destructive/15 text-destructive shrink-0"
                  disabled={handleUnfriendMutation.isPending}
                >
                  <UserMinus className="h-3.5 w-3.5 mr-1" />
                  Unfriend
                </Button>
              </div>
            ))}
            {filteredFriends.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No friends found{friendsSearch.trim() ? ` matching "${friendsSearch}"` : ""}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unfriend Confirmation */}
      <Dialog open={!!unfriendTarget} onOpenChange={(o: boolean) => !o && setUnfriendTarget(null)}>
        <DialogContent className="max-w-sm border border-border/40 rounded-3xl p-6 glass-card shadow-2xl">
          <DialogTitle className="font-display text-xl text-foreground flex items-center gap-2 border-b border-border/10 pb-3">
            <UserMinus className="h-5 w-5 text-destructive" />
            Unfriend
          </DialogTitle>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-border/40">
                {unfriendTarget?.picture && <AvatarImage src={unfriendTarget.picture} alt={unfriendTarget.name} />}
                <AvatarFallback className="bg-destructive/10 text-destructive text-sm font-display font-bold">
                  {unfriendTarget?.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-semibold text-foreground">{unfriendTarget?.name}</div>
                <div className="text-[10px] text-muted-foreground">{unfriendTarget?.role}</div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to unfriend <span className="text-foreground font-medium">{unfriendTarget?.name}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-2.5 justify-end">
              <Button
                variant="outline"
                onClick={() => setUnfriendTarget(null)}
                className="rounded-xl px-4 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (unfriendTarget) {
                    handleUnfriendMutation.mutate({ targetPlayerId: unfriendTarget.id, action: "unfriend" });
                  }
                }}
                className="rounded-xl px-4 cursor-pointer"
                disabled={handleUnfriendMutation.isPending}
              >
                {handleUnfriendMutation.isPending ? "Removing..." : "Unfriend"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
