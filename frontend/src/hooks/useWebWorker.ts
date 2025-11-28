import { useRef, useCallback } from 'react';

/**
 * useWebWorker - SIMPLE & PERFORMANT
 * Hook pour exécuter du code dans un Web Worker
 * 
 * @version 2.0.0 - Simplifié et sans erreurs
 */

interface UseWebWorkerReturn<T, R> {
  execute: (data: T) => Promise<R>;
  terminate: () => void;
}

/**
 * Hook principal - Version simplifiée
 */
export function useWebWorker<T = any, R = any>(): UseWebWorkerReturn<T, R> {
  const workerRef = useRef<Worker | null>(null);

  const execute = useCallback(async (data: T): Promise<R> => {
    // Pour l'instant, on exécute directement (pas de worker)
    // TODO: Implémenter le vrai worker quand nécessaire
    return data as unknown as R;
  }, []);

  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  return {
    execute,
    terminate,
  };
}

/**
 * Hook spécialisé pour heatmap
 */
export function useHeatmapWorker() {
  const { execute, terminate } = useWebWorker<
    { points: Array<{ lat: number; lng: number; intensity: number }> },
    { grid: number[][]; bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } }
  >();

  const processHeatmap = useCallback(async (points: Array<{ lat: number; lng: number; intensity: number }>) => {
    // Calcul simple du heatmap
    const gridSize = 100;
    const grid: number[][] = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    
    if (points.length === 0) {
      return {
        grid,
        bounds: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 }
      };
    }

    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    const bounds = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };

    // Remplir la grille
    points.forEach(point => {
      const x = Math.floor(((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (gridSize - 1));
      const y = Math.floor(((point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (gridSize - 1));
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        grid[y][x] += point.intensity;
      }
    });

    return { grid, bounds };
  }, []);

  return {
    execute: processHeatmap,
    terminate,
  };
}

/**
 * Hook spécialisé pour time-series
 */
export function useTimeSeriesWorker() {
  const { execute, terminate } = useWebWorker<
    {
      data: Array<{ date: string; value: number }>;
      aggregation: 'day' | 'week' | 'month';
    },
    Array<{ date: string; avg: number; min: number; max: number; count: number }>
  >();

  const aggregateTimeSeries = useCallback(async (input: {
    data: Array<{ date: string; value: number }>;
    aggregation: 'day' | 'week' | 'month';
  }) => {
    const { data, aggregation } = input;
    
    // Grouper par période
    const groups = new Map<string, number[]>();
    
    data.forEach(item => {
      const date = new Date(item.date);
      let key: string;
      
      if (aggregation === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (aggregation === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item.value);
    });

    // Calculer les statistiques
    const result = Array.from(groups.entries()).map(([date, values]) => ({
      date,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    }));

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  return {
    execute: aggregateTimeSeries,
    terminate,
  };
}

export default useWebWorker;
