import { useEffect, useRef } from "react";
import { useQueryClient } from "@/hooks/useApi";
import { toast } from "sonner";

// ponytail: simple SSE hook, no external libraries
export function useNotificationStream(playerId: string | undefined) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!playerId) return;

    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      const apiHost = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
      const token = localStorage.getItem("sn_token");
      const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
      const es = new EventSource(`${apiHost}/api/notifications/stream${tokenParam}`, { withCredentials: true });
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connected") return; // handshake, ignore

          // Show toast for all notification types
          const notif = data.notification;
          if (notif) {
            const icon = getToastIcon(data.type);
            toast(notif.title, {
              description: notif.body,
              icon,
            });
          }

          // Invalidate relevant queries based on event type
          queryClient.invalidateQueries({ queryKey: ["notifications"] });

          if (data.type === "friend_request" || data.type === "friend_accepted") {
            queryClient.invalidateQueries({ queryKey: ["friends"] });
          }
          if (data.type === "squad_invite" || data.type === "squad_invite_accepted" || data.type === "squad_invite_declined") {
            queryClient.invalidateQueries({ queryKey: ["squad-invites"] });
            queryClient.invalidateQueries({ queryKey: ["tournament-squads"] });
          }
          if (data.type === "match_scheduled" || data.type === "match_completed") {
            queryClient.invalidateQueries({ queryKey: ["matches"] });
            queryClient.invalidateQueries({ queryKey: ["home-data"] });
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        // ponytail: simple reconnect with 3s delay
        retryTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimeout);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [playerId, queryClient]);
}

function getToastIcon(type: string): string {
  switch (type) {
    case "friend_request": return "👤";
    case "friend_accepted": return "🤝";
    case "squad_invite": return "🏏";
    case "squad_invite_accepted": return "✅";
    case "squad_invite_declined": return "❌";
    case "match_scheduled": return "📅";
    case "match_completed": return "🏆";
    default: return "🔔";
  }
}
