import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@opencase/shared';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        document.cookie = `token=${token}; path=/; SameSite=Strict`;
        set({
          user,
          token,
          isAuthenticated: true,
        });
      },
      logout: () => {
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'opencase-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // Sync cookie on page load from persisted token
        if (state?.token) {
          document.cookie = `token=${state.token}; path=/; SameSite=Strict`;
        }
      },
    }
  )
);
