import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * AUTH STORE - ULTRA-PERFORMANT
 * 
 * Architecture:
 * - Zustand pour state management (plus léger que Redux)
 * - Persist middleware pour localStorage
 * - Type-safe avec TypeScript
 * - Optimistic updates
 * 
 * Scalabilité:
 * - Pas de re-renders inutiles
 * - Sélecteurs optimisés
 * - Middleware composable
 * 
 * @version 1.0.0
 */

interface User {
  id: string;
  email: string;
  supabase_id: string;
  created_at: string;
}

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  
  // Computed
  getUserId: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      
      login: (token, user) => set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false,
      }),
      
      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      }),
      
      // Computed
      getUserId: () => get().user?.id || null,
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors (pour éviter les re-renders)
export const selectUser = (state: AuthState) => state.user;
export const selectToken = (state: AuthState) => state.token;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
