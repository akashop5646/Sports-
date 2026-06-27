import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useMutation, useQueryClient } from "@/hooks/useApi";
import { getNotifications, markNotificationsRead } from "@/lib/api";
import { Bell, Trophy, Calendar, Award, User2 } from "lucide-react";
import { useEffect } from "react";
import * as React from "react";

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const icons = { trophy: Trophy, calendar: Calendar, award: Award, user: User2 };

export function NotificationsModal({ open, onOpenChange }: NotificationsModalProps) {
  const queryClient = useQueryClient();

  // Query notifications from database
  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    enabled: open,
  });

  // Mark all read mutation
  const markReadMutation = useMutation({
    mutationFn: () => markNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  useEffect(() => {
    if (open) {
      markReadMutation.mutate();
    }
  }, [open]);

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
              const I = (n.icon && icons[n.icon as keyof typeof icons]) || Bell;
              return (
                <div
                  key={n.id}
                  className="bg-background/40 border border-border/80 rounded-xl p-3 flex gap-3"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                    <I className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">{n.time}</div>
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
