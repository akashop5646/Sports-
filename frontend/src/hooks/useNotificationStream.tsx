import { createContext, useContext, useEffect, useRef, ReactNode } from "react";
import { useQueryClient } from "@/hooks/useApi";

const NotificationStreamContext = createContext<void>(undefined);

interface ProviderProps {
  clientKey: string | undefined;
  children: ReactNode;
}

export function NotificationStreamProvider({ clientKey, children }: ProviderProps) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!clientKey) return;

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
          if (data.type === "connected") return;

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
          if (data.type === "tournament_created" || data.type === "tournament_joined") {
            queryClient.invalidateQueries({ queryKey: ["tournaments"] });
            if (data.tournamentId) {
              queryClient.invalidateQueries({ queryKey: ["tournament", data.tournamentId] });
              queryClient.invalidateQueries({ queryKey: ["tournament-squads", data.tournamentId] });
              queryClient.invalidateQueries({ queryKey: ["points-table", data.tournamentId] });
            }
          }
          if (data.type === "team_joined") {
            queryClient.invalidateQueries({ queryKey: ["teams"] });
            if (data.teamId) {
              queryClient.invalidateQueries({ queryKey: ["team", data.teamId] });
              queryClient.invalidateQueries({ queryKey: ["team-players", data.teamId] });
            }
            if (data.tournamentId) {
              queryClient.invalidateQueries({ queryKey: ["tournament", data.tournamentId] });
              queryClient.invalidateQueries({ queryKey: ["tournament-squads", data.tournamentId] });
              queryClient.invalidateQueries({ queryKey: ["points-table", data.tournamentId] });
            }
          }
        } catch (e) {
          console.error("Error parsing notification stream data:", e);
        }
      };

      es.onerror = () => {
        es.close();
        retryTimeout = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [clientKey, queryClient]);

  return <NotificationStreamContext.Provider value={undefined}>{children}</NotificationStreamContext.Provider>;
}

export function useNotificationStream() {
  return useContext(NotificationStreamContext);
}
