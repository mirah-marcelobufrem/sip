import { get, set, del, keys } from 'idb-keyval';
import { api } from './api';

const QUEUE_PREFIX = 'offline-stat-';

export type QueuedStatEvent = {
  queueId: string;
  gameId: string;
  payload: {
    statType: string;
    playerId: string;
    teamId: string;
    period: number;
    clockTimeSeconds?: number;
    value?: number;
    xCourt?: number;
    yCourt?: number;
  };
  queuedAt: string;
};

export async function enqueueStatEvent(gameId: string, payload: QueuedStatEvent['payload']): Promise<string> {
  const queueId = `${QUEUE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const item: QueuedStatEvent = { queueId, gameId, payload, queuedAt: new Date().toISOString() };
  await set(queueId, item);
  return queueId;
}

export async function flushQueue(): Promise<{ flushed: number; failed: number }> {
  const allKeys = (await keys()).filter((k) => String(k).startsWith(QUEUE_PREFIX));
  let flushed = 0;
  let failed = 0;

  for (const key of allKeys) {
    const item = await get<QueuedStatEvent>(String(key));
    if (!item) continue;
    try {
      await api.post(`/games/${item.gameId}/events`, item.payload);
      await del(key);
      flushed++;
    } catch {
      failed++;
    }
  }

  return { flushed, failed };
}

export async function getPendingCount(): Promise<number> {
  const allKeys = await keys();
  return allKeys.filter((k) => String(k).startsWith(QUEUE_PREFIX)).length;
}

export function watchOnlineStatus(onFlush: (result: { flushed: number; failed: number }) => void) {
  async function handleOnline() {
    const count = await getPendingCount();
    if (count > 0) {
      const result = await flushQueue();
      onFlush(result);
    }
  }

  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}
