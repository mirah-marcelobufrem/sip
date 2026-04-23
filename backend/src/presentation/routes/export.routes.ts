import { Router } from 'express';
import { getPool } from '../../infrastructure/database/connection.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

// --- CSV: play-by-play ---
router.get('/game/:gameId/csv', async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows: events } = await pool.query(
      `SELECT se.period, se.clock_time_seconds, se.stat_type, se.value,
              p.first_name || ' ' || p.last_name AS player_name,
              p.jersey_number,
              t.name AS team_name,
              se.x_court, se.y_court
       FROM stat_events se
       LEFT JOIN players p ON p.id = se.player_id
       LEFT JOIN teams t ON t.id = se.team_id
       WHERE se.game_id = $1 AND se.deleted_at IS NULL
       ORDER BY se.period, se.clock_time_seconds`,
      [req.params.gameId],
    );

    const header = 'period,clock_seconds,stat_type,value,player_name,jersey_number,team_name,x_court,y_court\n';
    const csv =
      header +
      events
        .map((e: Record<string, unknown>) =>
          [
            e.period,
            e.clock_time_seconds ?? '',
            e.stat_type,
            e.value,
            `"${(e.player_name as string | null) ?? ''}"`,
            e.jersey_number ?? '',
            `"${(e.team_name as string | null) ?? ''}"`,
            e.x_court ?? '',
            e.y_court ?? '',
          ].join(','),
        )
        .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="game-${req.params.gameId}-playbyplay.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// --- JSON: full game export ---
router.get('/game/:gameId/json', async (req, res, next) => {
  try {
    const pool = getPool();

    const [gameResult, eventsResult, lineupsResult] = await Promise.all([
      pool.query(
        `SELECT g.*, ht.name AS home_name, at.name AS away_name
         FROM games g
         LEFT JOIN teams ht ON ht.id = g.home_team_id
         LEFT JOIN teams at ON at.id = g.away_team_id
         WHERE g.id = $1`,
        [req.params.gameId],
      ),
      pool.query(
        `SELECT se.*, p.first_name || ' ' || p.last_name AS player_name
         FROM stat_events se
         LEFT JOIN players p ON p.id = se.player_id
         WHERE se.game_id = $1 AND se.deleted_at IS NULL
         ORDER BY se.period, se.clock_time_seconds`,
        [req.params.gameId],
      ),
      pool.query(
        `SELECT ls.*
         FROM lineup_snapshots ls
         WHERE ls.game_id = $1
         ORDER BY ls.period, ls.clock_seconds`,
        [req.params.gameId],
      ),
    ]);

    const game = gameResult.rows[0];
    if (!game) return void res.status(404).json({ error: 'Game not found' });

    res.setHeader('Content-Disposition', `attachment; filename="game-${req.params.gameId}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      game,
      events: eventsResult.rows,
      lineups: lineupsResult.rows,
    });
  } catch (err) { next(err); }
});

// --- PDF: player card ---
router.get('/player/:id/card/pdf', async (req, res, next) => {
  try {
    const pool = getPool();

    const [playerResult, statsResult] = await Promise.all([
      pool.query(
        `SELECT p.*, t.name AS team_name
         FROM players p LEFT JOIN teams t ON t.id = p.team_id
         WHERE p.id = $1`,
        [req.params.id],
      ),
      pool.query(
        `SELECT
           COUNT(CASE WHEN se.stat_type IN ('2PM','3PM') THEN 1 END) AS fgm,
           COUNT(CASE WHEN se.stat_type IN ('2PA','3PA') THEN 1 END) AS fga,
           COUNT(CASE WHEN se.stat_type = '3PM' THEN 1 END) AS threepm,
           COUNT(CASE WHEN se.stat_type = '3PA' THEN 1 END) AS threepa,
           COUNT(CASE WHEN se.stat_type = 'FTM' THEN 1 END) AS ftm,
           COUNT(CASE WHEN se.stat_type = 'FTA' THEN 1 END) AS fta,
           COUNT(CASE WHEN se.stat_type = 'OREB' THEN 1 END) AS oreb,
           COUNT(CASE WHEN se.stat_type = 'DREB' THEN 1 END) AS dreb,
           COUNT(CASE WHEN se.stat_type = 'AST' THEN 1 END) AS ast,
           COUNT(CASE WHEN se.stat_type = 'TO' THEN 1 END) AS turnovers,
           COUNT(CASE WHEN se.stat_type = 'STL' THEN 1 END) AS stl,
           COUNT(CASE WHEN se.stat_type = 'BLK' THEN 1 END) AS blk,
           COUNT(CASE WHEN se.stat_type = 'PF' THEN 1 END) AS pf
         FROM stat_events se
         WHERE se.player_id = $1 AND se.deleted_at IS NULL`,
        [req.params.id],
      ),
    ]);

    const player = playerResult.rows[0];
    if (!player) return void res.status(404).json({ error: 'Player not found' });

    const stats = statsResult.rows[0] ?? {};
    const fgm = Number(stats.fgm ?? 0);
    const fga = Number(stats.fga ?? 0);
    const threepm = Number(stats.threepm ?? 0);
    const ftm = Number(stats.ftm ?? 0);
    const oreb = Number(stats.oreb ?? 0);
    const dreb = Number(stats.dreb ?? 0);
    const pts = fgm * 2 + threepm + ftm;
    const fgPct = fga > 0 ? ((fgm / fga) * 100).toFixed(1) : '0.0';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 32px; color: #111; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 14px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { background: #f5f5f5; text-align: left; padding: 8px 12px; font-weight: 600; color: #444; }
  td { padding: 8px 12px; border-bottom: 1px solid #eee; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .stat-box { background: #f9f9f9; border-radius: 8px; padding: 16px; }
  .label { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .val { font-size: 24px; font-weight: 700; color: #111; }
</style>
</head>
<body>
<h1>${player.first_name} ${player.last_name}</h1>
<div class="sub">${player.position ?? ''} &bull; #${player.jersey_number ?? '—'} &bull; ${player.team_name ?? ''}</div>
<div class="grid">
  <div class="stat-box"><div class="label">PTS</div><div class="val">${pts}</div></div>
  <div class="stat-box"><div class="label">REB</div><div class="val">${oreb + dreb}</div></div>
  <div class="stat-box"><div class="label">AST</div><div class="val">${stats.ast ?? 0}</div></div>
  <div class="stat-box"><div class="label">FG%</div><div class="val">${fgPct}%</div></div>
</div>
<table>
  <tr><th>Stat</th><th>Total</th></tr>
  <tr><td>FGM/FGA</td><td>${fgm}/${fga}</td></tr>
  <tr><td>3PM/3PA</td><td>${stats.threepm ?? 0}/${stats.threepa ?? 0}</td></tr>
  <tr><td>FTM/FTA</td><td>${stats.ftm ?? 0}/${stats.fta ?? 0}</td></tr>
  <tr><td>OREB/DREB</td><td>${oreb}/${dreb}</td></tr>
  <tr><td>AST</td><td>${stats.ast ?? 0}</td></tr>
  <tr><td>TO</td><td>${stats.turnovers ?? 0}</td></tr>
  <tr><td>STL</td><td>${stats.stl ?? 0}</td></tr>
  <tr><td>BLK</td><td>${stats.blk ?? 0}</td></tr>
  <tr><td>PF</td><td>${stats.pf ?? 0}</td></tr>
</table>
<p style="margin-top:32px;font-size:12px;color:#aaa">Generated by SIP Scout &bull; ${new Date().toLocaleDateString()}</p>
</body>
</html>`;

    await renderPdf(html, res, `player-${req.params.id}-card.pdf`);
  } catch (err) { next(err); }
});

// --- PDF: scouting report ---
router.get('/scouting/:id/pdf', async (req, res, next) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT sr.*, u.display_name AS author_name
       FROM scouting_reports sr
       LEFT JOIN users u ON u.id = sr.author_user_id
       WHERE sr.id = $1 AND sr.deleted_at IS NULL`,
      [req.params.id],
    );
    const report = rows[0];
    if (!report) return void res.status(404).json({ error: 'Report not found' });

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 32px; color: #111; }
  h1 { font-size: 24px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 24px; }
  .section { margin-bottom: 20px; }
  .section h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 6px; }
  .section p { white-space: pre-line; line-height: 1.6; font-size: 14px; }
  .rating { display: inline-block; background: #111; color: #fff; border-radius: 4px; padding: 4px 10px; font-weight: 700; font-size: 18px; }
  .badge { display: inline-block; background: #f5f5f5; border-radius: 20px; padding: 3px 10px; font-size: 12px; margin-right: 6px; }
</style>
</head>
<body>
<h1>${report.title}</h1>
<div class="meta">
  By ${report.author_name ?? 'Unknown'} &bull; ${new Date(report.report_date as Date).toLocaleDateString()}
  ${report.overall_rating ? ` &bull; <span class="rating">${report.overall_rating}/10</span>` : ''}
  ${report.recommendation ? ` &bull; <span class="badge">${String(report.recommendation).replace('_', ' ')}</span>` : ''}
</div>
${report.summary ? `<div class="section"><h3>Summary</h3><p>${report.summary}</p></div>` : ''}
${report.strengths ? `<div class="section"><h3>Strengths</h3><p>${report.strengths}</p></div>` : ''}
${report.weaknesses ? `<div class="section"><h3>Weaknesses</h3><p>${report.weaknesses}</p></div>` : ''}
${report.tags ? `<div class="section"><h3>Tags</h3>${(report.tags as string[]).map((t: string) => `<span class="badge">${t}</span>`).join('')}</div>` : ''}
<p style="margin-top:48px;font-size:12px;color:#aaa">Generated by SIP Scout &bull; ${new Date().toLocaleDateString()}</p>
</body>
</html>`;

    await renderPdf(html, res, `scouting-report-${req.params.id}.pdf`);
  } catch (err) { next(err); }
});

async function renderPdf(html: string, res: import('express').Response, filename: string): Promise<void> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
}

export default router;
