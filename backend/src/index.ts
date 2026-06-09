import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './presentation/routes/auth.routes.js';
import teamsRoutes from './presentation/routes/teams.routes.js';
import playersRoutes from './presentation/routes/players.routes.js';
import teamGamesRoutes from './presentation/routes/team-games.routes.js';
import gamesRoutes from './presentation/routes/games.routes.js';
import analyticsRoutes from './presentation/routes/analytics.routes.js';
import scoutingRoutes, { publicScoutingRouter } from './presentation/routes/scouting.routes.js';
import tournamentsRoutes, { publicTournamentsRouter } from './presentation/routes/tournaments.routes.js';
import aiRoutes from './presentation/routes/ai.routes.js';
import exportRoutes from './presentation/routes/export.routes.js';
import settingsRoutes from './presentation/routes/settings.routes.js';
import notificationsRoutes from './presentation/routes/notifications.routes.js';
import accountRoutes from './presentation/routes/account.routes.js';
import gameTemplatesRoutes from './presentation/routes/game-templates.routes.js';
import { errorMiddleware } from './presentation/middleware/error.middleware.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/teams', teamsRoutes);
app.use('/api/v1/teams/:teamId/players', playersRoutes);
app.use('/api/v1/teams/:teamId/games', teamGamesRoutes);
app.use('/api/v1/games', gamesRoutes);
app.use('/api/v1', analyticsRoutes);
app.use('/api/v1/scouting-reports', publicScoutingRouter);
app.use('/api/v1/scouting-reports', scoutingRoutes);
app.use('/api/v1/tournaments', tournamentsRoutes);
app.use('/api/v1', publicTournamentsRouter());
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/account', accountRoutes);
app.use('/api/v1/game-templates', gameTemplatesRoutes);

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

export default app;
