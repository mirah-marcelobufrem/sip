import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; email: string; displayName: string; avatarUrl: string | null } | null;
  _hasHydrated: boolean;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  setUser: (user: AuthState['user']) => void;
  refresh: () => Promise<boolean>;
  logout: () => void;
}

let refreshPromise: Promise<boolean> | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      _hasHydrated: false,

      setTokens: (tokens) => set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      setUser: (user) => set({ user }),

      refresh: async () => {
        if (refreshPromise) return refreshPromise;

        const { refreshToken } = get();
        if (!refreshToken) return false;

        refreshPromise = (async () => {
          try {
            const res = await fetch('/api/v1/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });
            if (!res.ok) {
              set({ accessToken: null, refreshToken: null, user: null });
              return false;
            }
            const data = await res.json() as { accessToken: string; refreshToken: string };
            set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
            return true;
          } catch {
            set({ accessToken: null, refreshToken: null, user: null });
            return false;
          } finally {
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },

      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'sip-auth',
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) state._hasHydrated = true;
      },
    },
  ),
);
