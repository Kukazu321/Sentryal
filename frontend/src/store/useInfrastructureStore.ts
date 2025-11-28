import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * INFRASTRUCTURE STORE - REAL-TIME STATE
 * 
 * Gère l'état des infrastructures avec:
 * - Optimistic updates
 * - Real-time sync via WebSocket
 * - Cache intelligent
 * - Devtools pour debugging
 * 
 * @version 1.0.0
 */

interface Infrastructure {
  id: string;
  user_id: string;
  name: string;
  type: string;
  created_at: string;
  bbox: any; // GeoJSON
  mode_onboarding: 'DRAW' | 'ADDRESS' | 'SHP';
  points_count?: number;
  last_job_status?: string;
}

interface InfrastructureState {
  // State
  infrastructures: Infrastructure[];
  selectedInfrastructure: Infrastructure | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setInfrastructures: (infrastructures: Infrastructure[]) => void;
  addInfrastructure: (infrastructure: Infrastructure) => void;
  updateInfrastructure: (id: string, updates: Partial<Infrastructure>) => void;
  deleteInfrastructure: (id: string) => void;
  selectInfrastructure: (id: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed
  getInfrastructureById: (id: string) => Infrastructure | undefined;
  getTotalPoints: () => number;
}

export const useInfrastructureStore = create<InfrastructureState>()(
  devtools(
    (set, get) => ({
      // Initial state
      infrastructures: [],
      selectedInfrastructure: null,
      isLoading: false,
      error: null,

      // Actions
      setInfrastructures: (infrastructures) => set({ infrastructures, error: null }),
      
      addInfrastructure: (infrastructure) => set((state) => ({
        infrastructures: [infrastructure, ...state.infrastructures],
      })),
      
      updateInfrastructure: (id, updates) => set((state) => ({
        infrastructures: state.infrastructures.map((infra) =>
          infra.id === id ? { ...infra, ...updates } : infra
        ),
        selectedInfrastructure:
          state.selectedInfrastructure?.id === id
            ? { ...state.selectedInfrastructure, ...updates }
            : state.selectedInfrastructure,
      })),
      
      deleteInfrastructure: (id) => set((state) => ({
        infrastructures: state.infrastructures.filter((infra) => infra.id !== id),
        selectedInfrastructure:
          state.selectedInfrastructure?.id === id ? null : state.selectedInfrastructure,
      })),
      
      selectInfrastructure: (id) => set((state) => ({
        selectedInfrastructure: id
          ? state.infrastructures.find((infra) => infra.id === id) || null
          : null,
      })),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),
      
      // Computed
      getInfrastructureById: (id) => get().infrastructures.find((infra) => infra.id === id),
      
      getTotalPoints: () =>
        get().infrastructures.reduce((sum, infra) => sum + (infra.points_count || 0), 0),
    }),
    { name: 'InfrastructureStore' }
  )
);

// Selectors
export const selectInfrastructures = (state: InfrastructureState) => state.infrastructures;
export const selectSelectedInfrastructure = (state: InfrastructureState) => state.selectedInfrastructure;
export const selectIsLoading = (state: InfrastructureState) => state.isLoading;
export const selectError = (state: InfrastructureState) => state.error;
