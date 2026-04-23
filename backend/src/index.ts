import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './presentation/routes/auth.routes.js';
import teamsRoutes from './presentation/routes/teams.routes.js';
import playersRoutes from './presentation/routes/players.routes.js';
import teamGamesRoutes from './presentation/routes/team-games.routes.js';
import gamesRoutes from './presentation/routes/games.routes.js';
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

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

export default app;
