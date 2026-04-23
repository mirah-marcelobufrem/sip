import { useState, useEffect } from 'react';
import { api } from '../lib/api';

async function getVapidKey(): Promise<string | null> {
  try {
    const res = await api.get<{ key: string }>('/notifications/vapid-public-key');
    return res.key || null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushStatus = 'unsupported' | 'denied' | 'granted' | 'prompt' | 'subscribing';

export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('prompt');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    const perm = Notification.permission;
    if (perm === 'denied') setStatus('denied');
    else if (perm === 'granted') setStatus('granted');
    else setStatus('prompt');
  }, []);

  async function subscribe(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;
    setStatus('subscribing');
    try {
      const vapidKey = await getVapidKey();
      if (!vapidKey) { setStatus('prompt'); return false; }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus('denied'); return false; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.post('/notifications/subscribe', { endpoint, keys });

      setSubscription(sub);
      setStatus('granted');
      return true;
    } catch {
      setStatus('prompt');
      return false;
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!subscription) return;
    const { endpoint } = subscription;
    await subscription.unsubscribe();
    await api.delete('/notifications/subscribe', { body: JSON.stringify({ endpoint }) } as never);
    setSubscription(null);
    setStatus('prompt');
  }

  return { status, subscription, subscribe, unsubscribe };
}
