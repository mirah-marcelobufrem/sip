import { Router } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getPool } from '../../infrastructure/database/connection.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic({ apiKey: key });
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const client = getClient();
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });
  const block = msg.content[0];
  return block?.type === 'text' ? block.text : '';
}

// POST /ai/game-recap/:gameId
router.post('/game-recap/:gameId', async (req, res, next) => {
  try {
    const { style } = z.object({ style: z.enum(['formal', 'casual', 'social']).default('casual') }).parse(req.body);
    const pool = getPool();

    const [eventsResult, gameResult] = await Promise.all([
      pool.query(
        `SELECT se.stat_type, se.value, se.period,
                p.first_name || ' ' || p.last_name AS player_name,
                t.name AS team_name
         FROM stat_events se
         LEFT JOIN players p ON p.id = se.player_id
         LEFT JOIN teams t ON t.id = se.team_id
         WHERE se.game_id = $1 AND se.deleted_at IS NULL
         ORDER BY se.period, se.clock_time_seconds`,
        [req.params.gameId],
      ),
      pool.query(
        `SELECT g.*, ht.name AS home_name, at.name AS away_name
         FROM games g
         LEFT JOIN teams ht ON ht.id = g.home_team_id
         LEFT JOIN teams at ON at.id = g.away_team_id
         WHERE g.id = $1`,
        [req.params.gameId],
      ),
    ]);

    const game = gameResult.rows[0];
    if (!game) return void res.status(404).json({ error: 'Game not found' });

    const systemPrompt = `You are a basketball analyst writing a game recap. Style: ${style}.
Be concise (3-4 paragraphs max). Focus on key moments, standout performances, and final result.`;

    const userMessage = `Game: ${game.home_name} vs ${game.away_name}
Final score: ${game.final_score_home ?? '?'} - ${game.final_score_away ?? '?'}
Stat events summary:
${JSON.stringify(eventsResult.rows.slice(0, 50), null, 2)}

Write the game recap.`;

    const recap = await callClaude(systemPrompt, userMessage);
    res.json({ recap, gameId: req.params.gameId });
  } catch (err) { next(err); }
});

// POST /ai/scouting-assist
router.post('/scouting-assist', async (req, res, next) => {
  try {
    const { prompt, context } = z.object({
      prompt: z.string().min(1).max(1000),
      context: z.string().max(2000).optional(),
    }).parse(req.body);

    const systemPrompt = `You are an expert basketball scout. Help coaches write professional scouting notes.
Provide structured, actionable observations. Be specific about basketball skills and tendencies.`;

    const userMessage = context
      ? `Context about the player/team:\n${context}\n\nCoach's notes to expand: ${prompt}`
      : prompt;

    const result = await callClaude(systemPrompt, userMessage);
    res.json({ result });
  } catch (err) { next(err); }
});

// POST /ai/lineup-recommendation/:teamId
router.post('/lineup-recommendation/:teamId', async (req, res, next) => {
  try {
    const pool = getPool();

    const [playersResult] = await Promise.all([
      pool.query(
        `SELECT p.id, p.first_name || ' ' || p.last_name AS name, p.position,
                COUNT(CASE WHEN se.stat_type IN ('2PM','3PM','FTM') THEN 1 END) * 2 AS pts_approx,
                COUNT(CASE WHEN se.stat_type = 'AST' THEN 1 END) AS ast,
                COUNT(CASE WHEN se.stat_type IN ('OREB','DREB') THEN 1 END) AS reb
         FROM players p
         LEFT JOIN stat_events se ON se.player_id = p.id AND se.deleted_at IS NULL
         WHERE p.team_id = $1 AND p.deleted_at IS NULL
         GROUP BY p.id, p.first_name, p.last_name, p.position`,
        [req.params.teamId],
      ),
    ]);

    const { opponent, situation } = z.object({
      opponent: z.string().max(200).optional(),
      situation: z.string().max(500).optional(),
    }).parse(req.body);

    const systemPrompt = `You are an expert basketball coach. Recommend an optimal starting lineup and rotation.
Focus on positional balance, synergies, and matchup advantages. Be concise and specific.`;

    const userMessage = `Team players and stats:
${JSON.stringify(playersResult.rows, null, 2)}
${opponent ? `\nOpponent: ${opponent}` : ''}
${situation ? `\nSituation: ${situation}` : ''}

Recommend the best starting 5 and key rotation players with reasoning.`;

    const recommendation = await callClaude(systemPrompt, userMessage);
    res.json({ recommendation, teamId: req.params.teamId });
  } catch (err) { next(err); }
});

// POST /ai/development-insights/:playerId
router.post('/development-insights/:playerId', async (req, res, next) => {
  try {
    const pool = getPool();

    const [devResult, playerResult] = await Promise.all([
      pool.query(
        `SELECT category, metric_name, metric_value, recorded_at, notes
         FROM development_entries
         WHERE player_id = $1 AND deleted_at IS NULL
         ORDER BY recorded_at DESC
         LIMIT 30`,
        [req.params.playerId],
      ),
      pool.query(
        `SELECT first_name || ' ' || last_name AS name, position, height_cm, weight_kg
         FROM players WHERE id = $1`,
        [req.params.playerId],
      ),
    ]);

    const player = playerResult.rows[0];

    const systemPrompt = `You are a basketball development coach. Analyze player development data and provide:
1. Progress summary (2-3 sentences)
2. Top 2-3 strengths emerging from the data
3. Top 2-3 priority areas to improve
4. One concrete drill or exercise recommendation per priority area
Keep it practical and motivating.`;

    const userMessage = `Player: ${player?.name ?? 'Unknown'} | Position: ${player?.position ?? 'N/A'}
Development log (most recent first):
${JSON.stringify(devResult.rows, null, 2)}`;

    const insights = await callClaude(systemPrompt, userMessage);
    res.json({ insights, playerId: req.params.playerId });
  } catch (err) { next(err); }
});

export default router;
