import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { Toaster } from "sonner";
import { CricketLoading } from "@/components/CricketLoading";
import { useApp } from "@/lib/store";
import { NotificationStreamProvider } from "@/hooks/useNotificationStream";
import { Home, Trophy, Users, User2, Plus } from "lucide-react";

// Lazy-loaded pages
const IndexRedirect = lazy(() => import("./pages/index"));
const OnboardingPage = lazy(() => import("./pages/onboarding"));
const LoginPage = lazy(() => import("./pages/login"));
const AuthCallbackPage = lazy(() => import("./pages/auth.callback"));
const HomePage = lazy(() => import("./pages/home"));
const TournamentsPage = lazy(() => import("./pages/tournaments"));
const TournamentDetailPage = lazy(() => import("./pages/tournaments.$tournamentId"));
const TeamsPage = lazy(() => import("./pages/teams"));
const TeamDetailPage = lazy(() => import("./pages/teams.$teamId"));
const PlayerDetailPage = lazy(() => import("./pages/players.$playerId"));
const MatchesPage = lazy(() => import("./pages/matches"));
const MatchDetailPage = lazy(() => import("./pages/matches.$matchId"));
const MatchScoringPage = lazy(() => import("./pages/matches.$matchId.score"));
const CertificatesPage = lazy(() => import("./pages/certificates"));
const ProfilePage = lazy(() => import("./pages/profile"));
const AdminPanelPage = lazy(() => import("./pages/admin"));

export default function App() {
  const user = useApp((s) => s.user);

  return (
    <BrowserRouter>
      <NotificationStreamProvider clientKey={user?.playerId || user?.id}>
        <Suspense
          fallback={
            <div className="min-h-screen bg-background flex flex-col justify-between pb-24 relative overflow-hidden">
              <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/30 border-b-2 border-b-primary shadow-[0_4px_12px_rgba(195,244,0,0.35)] rounded-b-3xl">
                <div className="mx-auto max-w-2xl flex items-center gap-3 px-4 py-3">
                  <div className="h-9 w-9 rounded-xl gradient-lime grid place-items-center font-display text-lg text-primary-foreground shadow-glow">
                    CL
                  </div>
                  <div className="leading-tight">
                    <div className="font-display text-lg">CreaseLive</div>
                    <div className="text-[10px] uppercase tracking-widest text-primary font-bold">
                      Loading...
                    </div>
                  </div>
                </div>
              </header>

              <main className="flex-1 flex items-center justify-center py-5">
                <CricketLoading />
              </main>

              <nav className="fixed bottom-0 inset-x-0 z-40">
                <div className="absolute inset-0 bg-background/70 backdrop-blur-2xl border-t border-border/30 rounded-t-3xl -z-10" />
                <div className="mx-auto max-w-2xl px-3 pb-3 pt-2">
                  <div className="bg-elevated/50 backdrop-blur-xl border border-border/50 rounded-2xl shadow-card flex items-center justify-around p-1.5">
                    <Link
                      to="/home"
                      className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-muted-foreground hover:text-foreground"
                    >
                      <Home className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Home</span>
                    </Link>
                    <Link
                      to="/tournaments"
                      className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-muted-foreground hover:text-foreground"
                    >
                      <Trophy className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Tournaments</span>
                    </Link>
                    <div className="-mt-7">
                      <div className="h-14 w-14 rounded-2xl gradient-lime grid place-items-center shadow-glow border-4 border-background">
                        <Plus className="h-6 w-6 text-primary-foreground" />
                      </div>
                    </div>
                    <Link
                      to="/teams"
                      className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-muted-foreground hover:text-foreground"
                    >
                      <Users className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Teams</span>
                    </Link>
                    <Link
                      to="/profile"
                      className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-muted-foreground hover:text-foreground"
                    >
                      <User2 className="h-5 w-5" />
                      <span className="text-[10px] font-medium">Profile</span>
                    </Link>
                  </div>
                </div>
              </nav>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<IndexRedirect />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournaments/:tournamentId" element={<TournamentDetailPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamDetailPage />} />
            <Route path="/players/:playerId" element={<PlayerDetailPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/:matchId" element={<MatchDetailPage />} />
            <Route path="/matches/:matchId/score" element={<MatchScoringPage />} />
            <Route path="/certificates" element={<CertificatesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPanelPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </NotificationStreamProvider>
      <Toaster position="top-center" theme="dark" />
    </BrowserRouter>
  );
}
