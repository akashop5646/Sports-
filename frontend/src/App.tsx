import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { CricketLoading } from "@/components/CricketLoading";

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

export default function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="min-h-screen bg-background flex items-center justify-center">
            <CricketLoading />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toaster position="top-center" theme="dark" />
    </BrowserRouter>
  );
}
