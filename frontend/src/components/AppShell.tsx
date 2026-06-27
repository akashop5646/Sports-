import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, Users, Bell, User2, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/AuthModal";
import { CreateModal } from "@/components/CreateModal";
import { NotificationsModal } from "@/components/NotificationsModal";
import { getCurrentUser } from "@/lib/auth";

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { label: "Create", icon: Plus, primary: true },
  { to: "/teams", label: "Teams", icon: Users },
  { to: "/profile", label: "Profile", icon: User2 },
];

export function AppShell({
  children,
  title,
  action,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useApp((s) => s.user);
  const unread = useApp((s) => s.notifications.filter((n) => !n.read).length);

  const authModalOpen = useApp((s) => s.authModalOpen);
  const setAuthModalOpen = useApp((s) => s.setAuthModalOpen);

  const createModalOpen = useApp((s) => s.createModalOpen);
  const setCreateModalOpen = useApp((s) => s.setCreateModalOpen);

  const notificationsModalOpen = useApp((s) => s.notificationsModalOpen);
  const setNotificationsModalOpen = useApp((s) => s.setNotificationsModalOpen);

  const setUser = useApp((s) => s.setUser);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (e) {
        console.error("Error checking session:", e);
      }
    };
    checkSession();
  }, [setUser]);

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="mx-auto max-w-2xl flex items-center gap-3 px-4 py-3">
          <Link to="/home" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl gradient-lime grid place-items-center font-display text-lg text-primary-foreground shadow-glow">
              SN
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg">{title || "Stadium Night"}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Cricket League
              </div>
            </div>
          </Link>
          <div className="flex-1" />
          {action}
          <button
            onClick={() => setNotificationsModalOpen(true)}
            className="relative h-9 w-9 grid place-items-center rounded-full bg-elevated hover:bg-muted transition cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
                {unread}
              </span>
            )}
          </button>
          {user ? (
            <Link to="/profile">
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-elevated text-foreground text-xs">
                  {user.avatar}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Button size="sm" variant="lime" onClick={() => setAuthModalOpen(true)}>
              Sign in
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5 animate-fade-in">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40">
        <div className="mx-auto max-w-2xl px-3 pb-3">
          <div className="bg-elevated/95 backdrop-blur-xl border border-border rounded-2xl shadow-card flex items-center justify-around p-1.5">
            {tabs.map((t) => {
              const active = t.to ? pathname.startsWith(t.to) : false;
              const Icon = t.icon;
              if (t.primary) {
                return (
                  <button
                    key={t.label}
                    onClick={() => setCreateModalOpen(true)}
                    className="-mt-7 cursor-pointer border-none bg-transparent"
                  >
                    <div className="h-14 w-14 rounded-2xl gradient-lime grid place-items-center shadow-glow border-4 border-background">
                      <Icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                  </button>
                );
              }
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{t.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      <CreateModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
      <NotificationsModal open={notificationsModalOpen} onOpenChange={setNotificationsModalOpen} />
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-3 mt-6 first:mt-0">
      <h2 className="font-display text-2xl">{children}</h2>
      {action}
    </div>
  );
}

export function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 border ${accent ? "border-primary/40 bg-primary/10" : "border-border bg-elevated"}`}
    >
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}
