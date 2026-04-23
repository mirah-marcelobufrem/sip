import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { initTheme } from './store/theme.store';
import AppShell from './components/layout/AppShell';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import TeamsPage from './features/teams/TeamsPage';
import PlayersPage from './features/players/PlayersPage';
import PlayerCardPage from './features/players/PlayerCardPage';
import GamesPage from './features/games/GamesPage';
import LiveRecordingPage from './features/live/LiveRecordingPage';
import BoxScorePage from './features/games/BoxScorePage';
import AnalyticsDashboard from './features/analytics/AnalyticsDashboard';
import ScoutingPage from './features/scouting/ScoutingPage';
import TournamentsPage from './features/tournaments/TournamentsPage';
import TournamentDetailPage from './features/tournaments/TournamentDetailPage';
import PublicBracketPage from './features/tournaments/PublicBracketPage';
import SettingsPage from './features/settings/SettingsPage';
import AccountPage from './features/settings/AccountPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => { initTheme(); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/bracket/:token" element={<PublicBracketPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/teams" replace />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/:teamId/players" element={<PlayersPage />} />
          <Route path="teams/:teamId/players/:playerId" element={<PlayerCardPage />} />
          <Route path="teams/:teamId/games" element={<GamesPage />} />
          <Route path="games/:gameId/live" element={<LiveRecordingPage />} />
          <Route path="games/:gameId/box-score" element={<BoxScorePage />} />
          <Route path="teams/:teamId/analytics" element={<AnalyticsDashboard />} />
          <Route path="scouting" element={<ScoutingPage />} />
          <Route path="tournaments" element={<TournamentsPage />} />
          <Route path="tournaments/:id" element={<TournamentDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
