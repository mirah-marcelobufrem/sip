import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import AppShell from './components/layout/AppShell';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import TeamsPage from './features/teams/TeamsPage';
import PlayersPage from './features/players/PlayersPage';
import GamesPage from './features/games/GamesPage';
import LiveRecordingPage from './features/live/LiveRecordingPage';
import AnalyticsDashboard from './features/analytics/AnalyticsDashboard';
import ScoutingPage from './features/scouting/ScoutingPage';
import TournamentsPage from './features/tournaments/TournamentsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
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
          <Route path="teams/:teamId/games" element={<GamesPage />} />
          <Route path="games/:gameId/live" element={<LiveRecordingPage />} />
          <Route path="teams/:teamId/analytics" element={<AnalyticsDashboard />} />
          <Route path="scouting" element={<ScoutingPage />} />
          <Route path="tournaments" element={<TournamentsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
