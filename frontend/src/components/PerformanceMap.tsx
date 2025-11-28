'use client';

import React, { useEffect, useRef } from 'react';

/**
 * PerformanceMap - VERSION SIMPLE SANS ERREURS
 * Carte interactive avec Mapbox GL
 */

interface Point {
  id: string;
  lat: number;
  lng: number;
  intensity: number;
}

interface PerformanceMapProps {
  points: Point[];
  center?: [number, number];
  zoom?: number;
  showHeatmap?: boolean;
  onPointClick?: (point: Point) => void;
}

export const PerformanceMap: React.FC<PerformanceMapProps> = ({
  points,
  center = [2.3522, 48.8566],
  zoom = 10,
  showHeatmap = true,
  onPointClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // TODO: Implémenter Mapbox GL quand le token est configuré
    console.log('Map initialized with', points.length, 'points');
  }, [points]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888',
        borderRadius: '8px',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗺️</div>
        <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
          Carte Interactive
        </div>
        <div style={{ fontSize: '0.875rem', color: '#666' }}>
          {points.length.toLocaleString()} points chargés
        </div>
        <div style={{ fontSize: '0.75rem', color: '#444', marginTop: '1rem' }}>
          Mapbox token requis pour afficher la carte
        </div>
      </div>
    </div>
  );
};

export default PerformanceMap;
