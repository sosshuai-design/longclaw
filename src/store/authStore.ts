import { create } from 'zustand';
import { User } from '../types';
import { loadAuth, logout as authLogout, saveAuth } from '../services/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setAuth: (token: string, user: User) => void;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: (token, user) => {
    set({ token, user, isAuthenticated: true });
    saveAuth(token, user).catch(console.error);
  },

  logout: async () => {
    await authLogout();
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadStoredAuth: async () => {
    set({ isLoading: true });
    try {
      const stored = await loadAuth();
      if (stored) {
        set({ token: stored.token, user: stored.user, isAuthenticated: true });
      }
    } catch {
      // 忽略
    } finally {
      set({ isLoading: false });
    }
  },
}));
