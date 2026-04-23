import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { PushSubscriptionRepository } from '../../infrastructure/database/repositories/push-subscription.repository.js';
import { getVapidPublicKey } from '../../infrastructure/push/webpush.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

router.get('/vapid-public-key', (_req, res) => {
  res.json({ key: getVapidPublicKey() });
});

router.post('/subscribe', authenticate, async (req, res, next) => {
  try {
    const parsed = SubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid subscription', details: parsed.error.flatten() });
    }
    const { endpoint, keys } = parsed.data;
    const userAgent = req.headers['user-agent'];
    const repo = new PushSubscriptionRepository(getDb());
    await repo.save(req.userId, endpoint, keys.p256dh, keys.auth, userAgent);
    res.status(201).json({ message: 'Subscribed' });
  } catch (err) {
    next(err);
  }
});

router.delete('/subscribe', authenticate, async (req, res, next) => {
  try {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
    const repo = new PushSubscriptionRepository(getDb());
    await repo.remove(req.userId, endpoint);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
