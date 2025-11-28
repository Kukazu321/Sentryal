'use client';

/**
 * Esri3DMap Component
 * 
 * High-fidelity 3D visualization of InSAR deformation points using ArcGIS SceneView.
 * Designed for ultra-high realism, perfect structuring, and long-term scalability.
 */

import { useEffect, useRef } from 'react';
import type { MapDataResponse, MapDataPoint } from '@/types/api';

// We import Esri ESM modules lazily inside useEffect to avoid SSR issues in Next.js.
// This keeps the bundle clean and prevents server-side crashes.

export interface Esri3DMapProps {
    data: MapDataResponse;
    onPointClick?: (point: MapDataPoint) => void;
    className?: string;
}

export function Esri3DMap({ data, onPointClick, className = '' }: Esri3DMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Esri3DMap is currently disabled to avoid runtime issues with @arcgis/core
    // in the Next.js bundler. We keep the component and props signature so
    // that it can be re-enabled in a dedicated 3D viewer in the future.
    useEffect(() => {
        return;
    }, [data, onPointClick]);

    return <div ref={containerRef} className={`w-full h-full ${className}`} />;
}

function getRiskColor(risk?: string): number[] {
    switch (risk) {
        case 'critical':
            return [220, 38, 38, 1]; // red-600
        case 'high':
            return [234, 88, 12, 1]; // orange-600
        case 'medium':
            return [245, 158, 11, 1]; // amber-500
        case 'low':
            return [234, 179, 8, 1]; // yellow-500
        case 'stable':
            return [34, 197, 94, 1]; // green-500
        default:
            return [107, 114, 128, 1]; // gray-500
    }
}
