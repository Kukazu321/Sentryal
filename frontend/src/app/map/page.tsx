'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { MapDataResponse, MapDataPoint, Infrastructure } from '@/types/api';
import { PointSidebar } from '@/components/Map/PointSidebar';
import { supabase as importedSupabase } from '../../../lib/supabaseClient';

const Google3DMap = dynamic(() => import('@/components/Map/Google3DMap'), { ssr: false });

const supabase: any = importedSupabase as any;

export default function MapPage() {
    const [infrastructures, setInfrastructures] = useState<Infrastructure[]>([]);
    const [selectedInfraId, setSelectedInfraId] = useState<string>('');
    const [mapData, setMapData] = useState<MapDataResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedPoint, setSelectedPoint] = useState<MapDataPoint | null>(null);

    // Load infrastructures
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setError(null);
                const token = await getAccessToken();
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/infrastructures`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!res.ok) throw new Error(`Failed to load infrastructures (${res.status})`);
                const data = await res.json();
                if (!mounted) return;
                const arr = Array.isArray(data?.infrastructures) ? data.infrastructures : (Array.isArray(data) ? data : []);
                setInfrastructures(arr);
                if (arr.length > 0) {
                    setSelectedInfraId(arr[0].id);
                }
            } catch (e: any) {
                if (!mounted) return;
                setError(e?.message || 'Failed to load infrastructures');
            }
        })();
        return () => { mounted = false; }
    }, []);

    // Load map-data when infra changes
    useEffect(() => {
        if (!selectedInfraId) return;
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                setSelectedPoint(null);
                const token = await getAccessToken();
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/infrastructures/${selectedInfraId}/map-data`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!res.ok) throw new Error(`Failed to load map-data (${res.status})`);
                const json: MapDataResponse = await res.json();
                if (cancelled) return;
                setMapData(json);
            } catch (e: any) {
                if (cancelled) return;
                setMapData(null);
                setError(e?.message || 'Failed to load map data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; }
    }, [selectedInfraId]);

    const center = useMemo(() => {
        if (mapData?.features?.length) {
            const f = mapData.features[0];
            return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
        }
        return { lat: 48.8566, lng: 2.3522 };
    }, [mapData]);

    const points = useMemo(() => {
        if (!mapData?.features) return [] as Array<{ lat: number; lng: number; color?: string; point?: any }>;
        return mapData.features.map((f) => ({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            color: (f.properties as any).color || riskColor(f.properties.riskLevel),
            point: f,
        }));
    }, [mapData]);

    return (
        <div className="relative h-[calc(100vh-80px)] -mx-8 -mt-8">
            {/* Controls Card */}
            <div className="absolute top-6 left-6 z-20 bg-white/95 backdrop-blur-md border border-neutral-200 rounded-xl p-4 shadow-lg min-w-[320px]">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">Infrastructure</label>
                        <select
                            value={selectedInfraId}
                            onChange={(e) => setSelectedInfraId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                        >
                            {infrastructures.map((i) => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="text-xs text-neutral-600">
                        <span className="font-semibold">Legend</span>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {legendItems.map((l) => (
                                <div key={l.label} className="flex items-center gap-2">
                                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                                    <span>{l.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="text-xs text-red-600">{error}</div>
                    )}
                </div>
            </div>

            {/* Map */}
            <Google3DMap
                lat={center.lat}
                lng={center.lng}
                zoom={12}
                pitch={60}
                bearing={0}
                className="h-full"
                points={points}
                onPointClick={(p: any) => setSelectedPoint(p as MapDataPoint)}
            />

            {/* Sidebar */}
            <PointSidebar point={selectedPoint} onClose={() => setSelectedPoint(null)} infrastructureId={selectedInfraId} />

            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 grid place-content-center bg-white/40">
                    <div className="text-neutral-700 text-sm">Loading map data…</div>
                </div>
            )}
        </div>
    );
}

async function getAccessToken(): Promise<string | null> {
    try {
        const { data } = await supabase.auth.getSession();
        return data?.session?.access_token ?? null;
    } catch {
        return null;
    }
}

function riskColor(level: MapDataPoint['properties']['riskLevel']): string {
    switch (level) {
        case 'critical':
            return '#FF3333';
        case 'high':
            return '#FF9933';
        case 'medium':
            return '#FFCC00';
        case 'low':
            return '#33CCFF';
        case 'stable':
            return '#22C55E';
        default:
            return '#111827';
    }
}

const legendItems = [
    { label: 'Critical', color: '#FF3333' },
    { label: 'High', color: '#FF9933' },
    { label: 'Medium', color: '#FFCC00' },
    { label: 'Low', color: '#33CCFF' },
    { label: 'Stable', color: '#22C55E' },
];
