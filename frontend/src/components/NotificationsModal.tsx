import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getNotifications, markNotificationsRead, respondFriendRequest, respondSquadInvite } from "@/lib/api";
import { Bell, Trophy, Calendar, Award, User2, UserCheck, UserX, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import * as React from "react";

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const icons: Record<string, any> = {
  trophy: Trophy,
  calendar: Calendar,
  award: Award,
  user: User2,
};

export function NotificationsModal({ open, onOpenChange }: NotificationsModalProps) {
  const queryClient = useQueryClient();

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const friendRespondMutation = useMutation({
    mutationFn: (payload: { targetPlayerId: string; action: "accept" | "decline" }) => respondFriendRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const squadRespondMutation = useMutation({
    mutationFn: (payload: { inviteId: string; action: "accept" | "decline" }) => respondSquadInvite(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["squad-invites"] });
      queryClient.invalidateQueries({ queryKey: ["tournament-squads"] });
    },
  });

  useEffect(() => {
    if (open) {
      markReadMutation.mutate();
    }
  }, [open]);

  // ponytail: determine if a notification is actionable (pending action, not yet acted on)
  const isActionable = (n: any) => {
    if (n.acted) return false;
    return n.type === "friend_request" || n.type === "squad_invite";
  };

  const renderActions = (n: any) => {
    // ponytail: show acted-on status badge instead of buttons
    if (n.acted) {
      const isAccepted = n.actedAction === "accepted";
      return (
        <div className={`flex items-center gap-1 mt-2 text-[10px] font-semibold ${isAccepted ? "text-emerald-400" : "text-destructive"}`}>
          {isAccepted ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
          {isAccepted ? "Accepted" : "Declined"}
        </div>
      );
    }

    if (n.type === "friend_request" && n.actionData?.senderId) {
      return (
        <div className="flex gap-1.5 mt-2">
          <Button
            variant="lime"
            size="sm"
            className="text-[10px] h-7 px-3 rounded-lg font-semibold cursor-pointer"
            onClick={() => friendRespondMutation.mutate({ targetPlayerId: n.actionData.senderId, action: "accept" })}
            disabled={friendRespondMutation.isPending}
          >
            <UserCheck className="h-3 w-3 mr-1" /> Accept
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[10px] h-7 px-3 rounded-lg font-semibold border-destructive/20 text-destructive hover:bg-destructive/15 cursor-pointer"
            onClick={() => friendRespondMutation.mutate({ targetPlayerId: n.actionData.senderId, action: "decline" })}
            disabled={friendRespondMutation.isPending}
          >
            <UserX className="h-3 w-3 mr-1" /> Decline
          </Button>
        </div>
      );
    }

    if (n.type === "squad_invite" && n.actionData?.inviteId) {
      return (
        <div className="flex gap-1.5 mt-2">
          <Button
            variant="lime"
            size="sm"
            className="text-[10px] h-7 px-3 rounded-lg font-semibold cursor-pointer"
            onClick={() => squadRespondMutation.mutate({ inviteId: n.actionData.inviteId, action: "accept" })}
            disabled={squadRespondMutation.isPending}
          >
            <Check className="h-3 w-3 mr-1" /> Join Team
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[10px] h-7 px-3 rounded-lg font-semibold border-destructive/20 text-destructive hover:bg-destructive/15 cursor-pointer"
            onClick={() => squadRespondMutation.mutate({ inviteId: n.actionData.inviteId, action: "decline" })}
            disabled={squadRespondMutation.isPending}
          >
            <X className="h-3 w-3 mr-1" /> Decline
          </Button>
        </div>
      );
    }

    return null;
  };

  // ponytail: pick accent color per notification type
  const getAccentClass = (type: string) => {
    switch (type) {
      case "friend_request": return "border-blue-500/20 bg-blue-500/5";
      case "friend_accepted": return "border-emerald-500/20 bg-emerald-500/5";
      case "squad_invite": return "border-amber-500/20 bg-amber-500/5";
      case "squad_invite_accepted": return "border-emerald-500/20 bg-emerald-500/5";
      case "squad_invite_declined": return "border-red-500/20 bg-red-500/5";
      default: return "border-border/80 bg-background/40";
    }
  };

  // Format relative time
  const formatTime = (iso: string) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md border-l border-border bg-elevated/95 backdrop-blur-xl overflow-y-auto pb-8"
      >
        <SheetTitle className="font-display text-2xl mb-4 mt-2">Notifications</SheetTitle>
        <div className="grid gap-2">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="h-6 w-6 rounded-full border-t-2 border-primary animate-spin mx-auto" />
            </div>
          ) : notifs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No notifications yet.
            </div>
          ) : (
            notifs.map((n: any) => {
              const I = (n.icon && icons[n.icon]) || Bell;
              const accentClass = getAccentClass(n.type);
              return (
                <div
                  key={n.id}
                  className={`border rounded-xl p-3 flex gap-3 transition-all ${accentClass} ${!n.read ? "ring-1 ring-primary/20" : ""}`}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                    <I className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">{formatTime(n.time)}</div>
                    {renderActions(n)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
