import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../../infrastructure/database/connection.js';
import { users, userTeamRoles, refreshTokens } from '../../infrastructure/database/schema/users.schema.js';
import { scoutingReports } from '../../infrastructure/database/schema/scouting.schema.js';
import { developmentEntries } from '../../infrastructure/database/schema/development.schema.js';
import { settings } from '../../infrastructure/database/schema/settings.schema.js';
import { pushSubscriptions } from '../../infrastructure/database/schema/push-subscriptions.schema.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/export', authenticate, async (req, res, next) => {
  try {
    const userId = req.userId;
    const db = getDb();

    const [userData, teamRoles, reports, devEntries, prefs] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      db.select().from(userTeamRoles).where(eq(userTeamRoles.userId, userId)),
      db.select().from(scoutingReports).where(eq(scoutingReports.authorUserId, userId)),
      db.select().from(developmentEntries).where(eq(developmentEntries.coachUserId, userId)),
      db.select().from(settings).where(eq(settings.userId, userId)).limit(1),
    ]);

    const user = userData[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      teamMemberships: teamRoles,
      scoutingReports: reports,
      developmentCoachEntries: devEntries,
      preferences: prefs[0]?.preferences ?? {},
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="sip-export-${userId}.json"`);
    res.json(exportPayload);
  } catch (err) {
    next(err);
  }
});

router.delete('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.userId;
    const db = getDb();

    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    await db.delete(settings).where(eq(settings.userId, userId));
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    await db.delete(userTeamRoles).where(eq(userTeamRoles.userId, userId));
    await db.update(users)
      .set({ deletedAt: new Date(), email: `deleted-${userId}@deleted.invalid`, passwordHash: null })
      .where(eq(users.id, userId));

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
