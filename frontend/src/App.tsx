import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import IndexRedirect from "./pages/index";
import OnboardingPage from "./pages/onboarding";
import LoginPage from "./pages/login";
import AuthCallbackPage from "./pages/auth.callback";
import HomePage from "./pages/home";
import TournamentsPage from "./pages/tournaments";
import TournamentDetailPage from "./pages/tournaments.$tournamentId";
import TeamsPage from "./pages/teams";
import TeamDetailPage from "./pages/teams.$teamId";
import PlayerDetailPage from "./pages/players.$playerId";
import MatchesPage from "./pages/matches";
import MatchDetailPage from "./pages/matches.$matchId";
import MatchScoringPage from "./pages/matches.$matchId.score";
import CertificatesPage from "./pages/certificates";
import ProfilePage from "./pages/profile";

export default function App() {
  return (
    <BrowserRouter>
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
      <Toaster position="top-center" theme="dark" />
    </BrowserRouter>
  );
}
