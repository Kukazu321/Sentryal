/**
 * Infrastructure Map Page
 * Full-screen interactive map with deformation visualization
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMapData } from '@/hooks/useMapData';
import type { MapDataPoint } from '@/types/api';
import { PointSidebar } from '@/components/Map/PointSidebar';
import { LaunchAnalysisModal } from '@/components/Map/LaunchAnalysisModal';
import { Sparkles } from 'lucide-react';

// Disable SSR for Map components (Mapbox requires window)
const InfrastructureMap = dynamic(
  () => import('@/components/Map/InfrastructureMap').then(mod => ({ default: mod.InfrastructureMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-700 font-medium">Chargement de la carte...</p>
        </div>
      </div>
    ),
  }
);


// ============================================================================
// COMPONENT
// ============================================================================

export default function MapPage() {
  const params = useParams();
  const id = params?.id as string;
  const [mounted, setMounted] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<MapDataPoint | null>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [infrastructures, setInfrastructures] = useState<Array<{ id: string; name: string; type?: string }>>([]);

  // Ensure client-side only rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch infrastructures list
  useEffect(() => {
    if (!mounted) return;

    const fetchInfrastructures = async () => {
      try {
        const token = typeof window !== 'undefined'
          ? (() => {
            const directToken = localStorage.getItem('token');
            if (directToken) return directToken;
            const supabaseKey = Object.keys(localStorage).find(key =>
              key.includes('supabase') && key.includes('auth-token')
            );
            if (supabaseKey) {
              try {
                const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
                return session.access_token || null;
              } catch {
                return null;
              }
            }
            return null;
          })()
          : null;

        if (!token) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setInfrastructures(data.infrastructures || []);
        }
      } catch (err) {
        console.error('Failed to fetch infrastructures:', err);
      }
    };

    fetchInfrastructures();
  }, [mounted]);

  // Get token from localStorage (Supabase auth token)
  const token = typeof window !== 'undefined'
    ? (() => {
      // Try multiple possible token locations
      const directToken = localStorage.getItem('token');
      if (directToken) return directToken;

      // Try Supabase session
      const supabaseKey = Object.keys(localStorage).find(key =>
        key.includes('supabase') && key.includes('auth-token')
      );
      if (supabaseKey) {
        try {
          const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
          return session.access_token || null;
        } catch {
          return null;
        }
      }

      return null;
    })()
    : null;

  // Fetch map data with auto-refresh
  const { data, isLoading, error, refetch } = useMapData(id, token || undefined, {
    refetchInterval: 15000, // Refetch every 15 seconds to catch completed jobs faster
    staleTime: 0, // Always consider data stale to ensure fresh data after job completion
  });

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handlePointClick = (point: MapDataPoint) => {
    console.log('🔵 [PAGE] Point clicked, setting selectedPoint');
    console.log('🔵 [PAGE] Point ID:', point.properties.pointId);
    console.log('🔵 [PAGE] Will render PointSidebar from: @/components/Map/PointSidebar');
    setSelectedPoint(point);
    console.log('🔵 [PAGE] selectedPoint state updated');
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleLaunchAnalysis = useCallback(async (data: {
    infrastructureId: string;
    startDate: string;
    endDate: string;
    analysisCount: number;
  }) => {
    const token = typeof window !== 'undefined'
      ? (() => {
        const directToken = localStorage.getItem('token');
        if (directToken) return directToken;
        const supabaseKey = Object.keys(localStorage).find(key =>
          key.includes('supabase') && key.includes('auth-token')
        );
        if (supabaseKey) {
          try {
            const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
            return session.access_token || null;
          } catch {
            return null;
          }
        }
        return null;
      })()
      : null;

    if (!token) {
      throw new Error('Authentication required');
    }

    // Calculate date range and split into multiple analyses if needed
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysPerAnalysis = Math.ceil(totalDays / data.analysisCount);

    const promises = [];
    for (let i = 0; i < data.analysisCount; i++) {
      const analysisStart = new Date(start);
      analysisStart.setDate(start.getDate() + (i * daysPerAnalysis));
      const analysisEnd = new Date(analysisStart);
      analysisEnd.setDate(analysisStart.getDate() + daysPerAnalysis - 1);
      if (analysisEnd > end) analysisEnd.setTime(end.getTime());

      const requestBody: any = {
        infrastructureId: data.infrastructureId,
        dateRange: {
          start: analysisStart.toISOString().split('T')[0],
          end: analysisEnd.toISOString().split('T')[0],
        },
      };

      promises.push(
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/process-insar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }).then(async (res) => {
          if (!res.ok) {
            const error = await res.json().catch(() => ({ error: 'Failed to launch analysis' }));
            throw new Error(error.error || error.message || 'Failed to launch analysis');
          }
          return res.json();
        })
      );
    }

    await Promise.all(promises);

    // Refresh map data after a short delay
    setTimeout(() => {
      refetch();
    }, 2000);
  }, [refetch]);

  // ==========================================================================
  // CLIENT-SIDE ONLY CHECK
  // ==========================================================================

  if (!mounted) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Initialisation...
          </h2>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Chargement de la carte
          </h2>
          <p className="text-gray-600">
            Récupération des données de déformation...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // ERROR STATE
  // ==========================================================================

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Erreur de chargement
          </h2>
          <p className="text-gray-600 mb-4">
            {error.message || 'Impossible de charger les données de la carte'}
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // NO DATA STATE
  // ==========================================================================

  if (!data || data.features.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Aucune donnée disponible
          </h2>
          <p className="text-gray-600 mb-4">
            Cette infrastructure n'a pas encore de données de déformation.
            Lancez un job InSAR pour commencer.
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour à l'infrastructure
          </button>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // MAP VIEW
  // ==========================================================================

  return (
    <>
      {/* Fullscreen Map */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        <InfrastructureMap
          data={data}
          onPointClick={handlePointClick}
          className="w-full h-full"
        />
      </div>

      {/* Launch Analysis Button - Floating */}
      <button
        onClick={() => setShowLaunchModal(true)}
        className="fixed bottom-6 right-6 z-[100] h-14 px-6 bg-neutral-900 hover:bg-neutral-800 text-white rounded-full shadow-2xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95"
        style={{ boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' }}
      >
        <Sparkles className="h-5 w-5" />
        <span className="font-semibold text-sm">Launch Analysis</span>
      </button>

      {/* Launch Analysis Modal */}
      <LaunchAnalysisModal
        open={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        infrastructures={infrastructures}
        onLaunch={handleLaunchAnalysis}
      />

      {/* Point Sidebar - OVER the map */}
      {(() => {
        console.log('🔵 [PAGE] Render check - selectedPoint exists:', !!selectedPoint);
        if (selectedPoint) {
          console.log('🔵 [PAGE] Rendering PointSidebar component');
          console.log('🔵 [PAGE] Import path: @/components/Map/PointSidebar');
          return (
            <PointSidebar
              point={selectedPoint}
              onClose={() => {
                console.log('🔵 [PAGE] Closing sidebar');
                setSelectedPoint(null);
              }}
              infrastructureId={id}
            />
          );
        }
        return null;
      })()}
    </>
  );
}
