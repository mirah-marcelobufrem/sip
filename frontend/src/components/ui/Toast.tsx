import { useState, useCallback, useRef } from 'react';
import type { AlertLevel } from '../../hooks/useGameAlerts';

export type ToastItem = {
  id: string;
  level: AlertLevel;
  message: string;
};

const COLORS: Record<AlertLevel, string> = {
  info: 'bg-blue-600',
  warning: 'bg-amber-500',
  danger: 'bg-red-600',
};

export function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${COLORS[t.level]} text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 pointer-events-auto`}
          role="alert"
        >
          <span className="flex-1 text-sm font-medium">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-white/80 hover:text-white text-lg leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const addToast = useCallback((item: ToastItem, autoClose = 6000) => {
    setToasts((prev) => {
      if (prev.some((t) => t.id === item.id)) return prev;
      return [...prev, item];
    });
    if (autoClose > 0) {
      timers.current[item.id] = setTimeout(() => dismiss(item.id), autoClose);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismiss };
}
