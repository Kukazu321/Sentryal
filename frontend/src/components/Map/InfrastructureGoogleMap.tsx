'use client';

import React, { useMemo } from 'react';
import type { MapDataResponse, MapDataPoint } from '@/types/api';
import DeckGLMap from '@/components/Map/DeckGLMap';

interface Props {
    data?: MapDataResponse;
    onPointClick?: (point: MapDataPoint) => void;
    onBoundsChanged?: (bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => void;
    initialCenter?: { lat: number; lng: number };
    className?: string;
}

export default function InfrastructureGoogleMap({ data, onPointClick, onBoundsChanged, initialCenter, className = '' }: Props) {
    const features = data?.features || [];

    const center = useMemo(() => {
        if (initialCenter) return initialCenter;
        if (features.length) {
            const f = features[0];
            return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
        }
        return { lat: 48.8566, lng: 2.3522 };
    }, [features, data, initialCenter]);

    const points = useMemo(() => {
        return features.map((f) => ({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            color: (f.properties as any).color,
            pid: (f.properties as any).pointId as string | undefined,
            point: f, // Pass full feature for heatmap data extraction
            properties: f.properties, // Direct access to properties
        }));
    }, [features]);

    const byPid = useMemo(() => {
        const m = new Map<string, MapDataPoint>();
        features.forEach((f) => {
            const pid = (f.properties as any).pointId as string | undefined;
            if (pid) m.set(pid, f as any);
        });
        return m;
    }, [features]);

    return (
        <DeckGLMap
            lat={center.lat}
            lng={center.lng}
            zoom={12}
            className={className}
            points={points}
            onPointClick={(p: any) => {
                if (!onPointClick) return;
                const pid = p?.pid as string | undefined;
                if (pid && byPid.has(pid)) {
                    onPointClick(byPid.get(pid)!);
                } else {
                    // Fallback: construct minimal MapDataPoint-like object
                    onPointClick({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [p?.lng, p?.lat] },
                        properties: { pointId: pid || '', color: p?.color || '#111' } as any,
                    } as any);
                }
            }}
        />
    );
}
