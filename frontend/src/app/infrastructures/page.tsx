"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '../../../context/AuthProvider';
import { Plus, MapPin, TrendingUp, AlertCircle, Loader, Eye, Search, LayoutGrid, List, SlidersHorizontal, Download, Upload, Share2, ChevronDown, X } from 'lucide-react';
import InfrastructureGoogleMap from '@/components/Map/InfrastructureGoogleMap';
import { PointSidebar } from '@/components/Map/PointSidebar';
import type { MapDataResponse, MapDataPoint } from '@/types/api';

interface Infrastructure {
  id: string;
  name: string;
  type?: string;
  bbox: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  created_at: string;
  updated_at: string;
}

type Stats = { areaKm2: number; estimatedPoints: number };

export default function InfrastructuresPage() {
  const router = useRouter();
  const { session } = useAuthContext();
  const [infrastructures, setInfrastructures] = useState<Infrastructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [sort, setSort] = useState<'name' | 'area' | 'points' | 'updated'>('updated');
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const [riskFilterOpen, setRiskFilterOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedInfra, setSelectedInfra] = useState<Infrastructure | null>(null);
  const [mapData, setMapData] = useState<MapDataResponse | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MapDataPoint | null>(null);
  const [previewCenter, setPreviewCenter] = useState<{ lat: number; lng: number } | null>(null);
  const previewFetchSeq = useRef(0);
  const [actionOpenId, setActionOpenId] = useState<string | null>(null);
  const [actionMenuPos, setActionMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [actionMenuInfra, setActionMenuInfra] = useState<Infrastructure | null>(null);
  const [editModal, setEditModal] = useState<{ open: boolean; infra: Infrastructure | null }>({ open: false, infra: null });
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; infra: Infrastructure | null }>({ open: false, infra: null });

  const openActionsMenu = (infra: Infrastructure, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const MENU_W = 176; // ~w-44
    const MENU_H = 88; // approx height for two items
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    let x = rect.right - MENU_W;
    x = Math.max(8, Math.min(x, viewportW - MENU_W - 8));
    let y = rect.bottom + 8;
    if (viewportH - rect.bottom < MENU_H + 12) {
      y = Math.max(8, rect.top - MENU_H - 8);
    }
    setActionMenuInfra(infra);
    setActionOpenId(infra.id);
    setActionMenuPos({ x, y });
  };

  const openMap = async (infra: Infrastructure) => {
    setSelectedInfra(infra);
    setMapOpen(true);
    setMapData(null);
    setSelectedPoint(null);
    // Compute initial center from infra bbox
    try {
      const coords = infra.bbox.coordinates[0];
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const minLon = Math.min(...lngs);
      const maxLon = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      setPreviewCenter({ lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 });
    } catch { }
    try {
      const token = localStorage.getItem('token') || (session as any)?.access_token || undefined;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures/${infra.id}/map-data?limit=3000`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setMapData(data);
    } catch { }
  };

  const closeMap = () => {
    setMapOpen(false);
    setSelectedInfra(null);
    setMapData(null);
    setSelectedPoint(null);
  };

  const handleBoundsChanged = useCallback(async (bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => {
    if (!selectedInfra) return;
    const seq = ++previewFetchSeq.current;
    try {
      const token = localStorage.getItem('token') || (session as any)?.access_token || undefined;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const qs = new URLSearchParams({
        limit: '5000',
        minLat: String(bbox.minLat),
        maxLat: String(bbox.maxLat),
        minLon: String(bbox.minLon),
        maxLon: String(bbox.maxLon),
      }).toString();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures/${selectedInfra.id}/map-data?${qs}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      // Only apply if most recent
      if (seq === previewFetchSeq.current) {
        setMapData(data);
      }
    } catch { }
  }, [selectedInfra, session]);

  useEffect(() => {
    fetchInfrastructures();
    // re-fetch when auth session token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const fetchInfrastructures = async () => {
    try {
      setIsLoading(true);
      // Prefer any explicit app token, otherwise fallback to Supabase session token
      const token = localStorage.getItem('token') || (session as any)?.access_token || undefined;

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures`, { headers });

      if (!response.ok) {
        // If unauthorized/forbidden/not found, behave like empty state
        if ([401, 403, 404].includes(response.status)) {
          setInfrastructures([]);
          setError(null);
          return;
        }
        throw new Error('Failed to fetch infrastructures');
      }

      const data = await response.json();
      setInfrastructures(data.infrastructures || []);
    } catch (err) {
      // On network or unexpected error, fall back to empty state UI
      setInfrastructures([]);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  };

  const patchInfra = async (id: string, body: { name?: string; type?: string | null }) => {
    const token = localStorage.getItem('token') || (session as any)?.access_token || undefined;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Update failed');
    return res.json();
  };

  const deleteInfra = async (id: string) => {
    const token = localStorage.getItem('token') || (session as any)?.access_token || undefined;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok && res.status !== 204) throw new Error('Delete failed');
  };

  const calculateStats = (bbox: Infrastructure['bbox']) => {
    const coords = bbox.coordinates[0];
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const minLon = Math.min(...lngs);
    const maxLon = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Rough calculation of area in km²
    const latDiff = maxLat - minLat;
    const lonDiff = maxLon - minLon;
    const areaKm2 = latDiff * lonDiff * 111 * 111;

    return {
      areaKm2: Math.round(areaKm2 * 100) / 100,
      // 5m x 5m grid => ~40,000 points per km²
      estimatedPoints: Math.round(areaKm2 * 40000),
    };
  };

  const withStats: Array<Infrastructure & { stats: Stats }> = infrastructures.map((i) => ({
    ...i,
    stats: calculateStats(i.bbox),
  }));

  // Extract all unique types from infrastructures
  const allTypes = Array.from(new Set(infrastructures.map(i => i.type).filter(Boolean) as string[])).sort();

  const filtered = withStats.filter((i) => {
    const matchesQuery = i.name.toLowerCase().includes(query.toLowerCase());
    const matchesType = selectedTypes.size === 0 || !i.type || selectedTypes.has(i.type);
    return matchesQuery && matchesType;
  });

  const sorted: Array<Infrastructure & { stats: Stats }> = [...filtered].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'area') return (b.stats?.areaKm2 || 0) - (a.stats?.areaKm2 || 0);
    if (sort === 'points') return (b.stats?.estimatedPoints || 0) - (a.stats?.estimatedPoints || 0);
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const totals = sorted.reduce(
    (acc, i) => {
      acc.area += i.stats?.areaKm2 || 0;
      acc.points += i.stats?.estimatedPoints || 0;
      return acc;
    },
    { area: 0, points: 0 }
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Infrastructures</h1>
            <p className="text-sm text-neutral-500 mt-1">Create, organize and monitor all your assets</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/onboarding')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-semibold">
              <Plus className="h-4 w-4" /> New Infrastructure
            </button>
            <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-sm">
              <Upload className="h-4 w-4" /> Import GeoJSON
            </button>
            <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-sm">
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-sm">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="text-xs text-neutral-500 mb-1">Total infrastructures</div>
            <div className="text-2xl font-semibold text-neutral-900">{infrastructures.length}</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="text-xs text-neutral-500 mb-1">Estimated coverage</div>
            <div className="text-2xl font-semibold text-neutral-900">{Math.round(totals.area).toLocaleString()} km²</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="text-xs text-neutral-500 mb-1">Estimated points</div>
            <div className="text-2xl font-semibold text-neutral-900">{totals.points.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="text-xs text-neutral-500 mb-1">Active alerts</div>
            <div className="text-2xl font-semibold text-neutral-900">—</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search infrastructures" className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900" />
          </div>
          <div className="relative">
            <button onClick={() => setTypeFilterOpen((v) => !v)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-sm">
              <SlidersHorizontal className="h-4 w-4" /> Type {selectedTypes.size > 0 && `(${selectedTypes.size})`} <ChevronDown className="h-4 w-4 text-neutral-500" />
            </button>
            {typeFilterOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 rounded-lg border border-neutral-200 bg-white shadow-xl z-50 max-h-96 overflow-y-auto">
                <div className="p-2">
                  <div className="flex items-center justify-between mb-2 px-2 py-1">
                    <span className="text-xs font-semibold text-neutral-700">Filter by type</span>
                    {selectedTypes.size > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTypes(new Set());
                        }}
                        className="text-xs text-neutral-500 hover:text-neutral-900"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {allTypes.length === 0 ? (
                    <div className="px-2 py-4 text-xs text-neutral-500 text-center">No types available</div>
                  ) : (
                    <div className="space-y-1">
                      {allTypes.map((type) => {
                        const isSelected = selectedTypes.has(type);
                        return (
                          <label
                            key={type}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-neutral-50 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                const newSet = new Set(selectedTypes);
                                if (e.target.checked) {
                                  newSet.add(type);
                                } else {
                                  newSet.delete(type);
                                }
                                setSelectedTypes(newSet);
                              }}
                              className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
                            />
                            <span className="text-sm text-neutral-700 flex-1">{type}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setRiskFilterOpen((v) => !v)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-sm">
            <AlertCircle className="h-4 w-4" /> Risk <ChevronDown className="h-4 w-4 text-neutral-500" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-neutral-200 bg-white text-sm">
                <option value="updated">Last updated</option>
                <option value="name">Name</option>
                <option value="area">Area</option>
                <option value="points">Points</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
            </div>
            <div className="flex items-center gap-1 border border-neutral-200 rounded-lg p-1">
              <button onClick={() => setView('table')} className={`h-8 w-8 grid place-content-center rounded ${view === 'table' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}><List className="h-4 w-4" /></button>
              <button onClick={() => setView('grid')} className={`h-8 w-8 grid place-content-center rounded ${view === 'grid' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600 hover:bg-neutral-50'}`}><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Loader className="w-12 h-12 text-neutral-400 animate-spin mx-auto mb-4" />
              <p className="text-neutral-500">Loading infrastructures...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 rounded-lg bg-red-50 border border-red-200 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        ) : infrastructures.length === 0 ? (
          <div className="text-center py-24">
            <MapPin className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">No infrastructures yet</h3>
            <p className="text-neutral-500 mb-6">Create your first infrastructure to start monitoring</p>
            <button onClick={() => router.push('/onboarding')} className="px-6 py-3 rounded-lg bg-black text-white font-semibold inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Infrastructure
            </button>
          </div>
        ) : view === 'table' ? (
          <div className="rounded-xl border border-neutral-200 overflow-visible">
            <div className="grid grid-cols-[2fr,1fr,1fr,1fr,1fr,40px] bg-neutral-50 text-xs text-neutral-500 px-4 py-2">
              <div>Name</div>
              <div className="text-center">Type</div>
              <div className="text-center">Area</div>
              <div className="text-center">Points</div>
              <div className="text-center">Updated</div>
              <div></div>
            </div>
            <div className="divide-y">
              {sorted.map((infra) => (
                <div key={infra.id} className="grid grid-cols-[2fr,1fr,1fr,1fr,1fr,40px] items-center px-4 py-3 text-sm hover:bg-neutral-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-neutral-100 border border-neutral-200 grid place-content-center text-xs text-neutral-700" onClick={() => openMap(infra)}>
                      {infra.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="truncate text-neutral-900" onClick={() => openMap(infra)}>{infra.name}</div>
                  </div>
                  <div className="text-center text-neutral-700">{infra.type || '—'}</div>
                  <div className="text-center text-neutral-900">{infra.stats?.areaKm2?.toLocaleString()} km²</div>
                  <div className="text-center text-neutral-900">{infra.stats?.estimatedPoints?.toLocaleString()}</div>
                  <div className="text-center text-neutral-700">{new Date(infra.updated_at).toLocaleDateString()}</div>
                  <div className="relative flex justify-end">
                    <button onClick={(e) => { e.stopPropagation(); openActionsMenu(infra, e.currentTarget as HTMLElement); }} className="h-8 w-8 grid place-content-center rounded hover:bg-neutral-100">⋮</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sorted.map((infra) => (
              <div key={infra.id} className="group p-5 rounded-xl border border-neutral-200 bg-white hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0">
                    <div className="text-sm text-neutral-500">{infra.type || '—'}</div>
                    <div className="truncate text-lg font-semibold text-neutral-900">{infra.name}</div>
                  </div>
                  <Eye className="w-5 h-5 text-neutral-400" />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg border border-neutral-200">
                    <div className="text-xs text-neutral-500 mb-1">Area</div>
                    <div className="text-neutral-900">{infra.stats?.areaKm2?.toLocaleString()} km²</div>
                  </div>
                  <div className="p-3 rounded-lg border border-neutral-200">
                    <div className="text-xs text-neutral-500 mb-1">Points</div>
                    <div className="text-neutral-900">{infra.stats?.estimatedPoints?.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-neutral-500">Updated {new Date(infra.updated_at).toLocaleDateString()}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); openMap(infra); }} className="px-3 py-2 rounded-lg border border-neutral-200 text-sm">Map</button>
                    <button onClick={(e) => { e.stopPropagation(); router.push(`/infrastructure/${infra.id}`); }} className="px-3 py-2 rounded-lg bg-black text-white text-sm">Open</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Right Map Panel */}
        {mapOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={closeMap} />
            <div className="fixed top-0 right-0 h-full w-full sm:w-[520px] md:w-[640px] lg:w-[760px] bg-white border-l border-neutral-200 z-50 flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div>
                  <div className="text-xs text-neutral-500">Map preview</div>
                  <div className="text-sm font-semibold text-neutral-900 truncate max-w-[420px]">{selectedInfra?.name}</div>
                </div>
                <div className="flex items-center gap-3">
                  {mapData?.metadata?.totalPoints && mapData?.features?.length && mapData.metadata.totalPoints > mapData.features.length ? (
                    <div className="text-xs text-neutral-500">Showing {mapData.features.length.toLocaleString()} of {mapData.metadata.totalPoints.toLocaleString()}</div>
                  ) : null}
                  <button onClick={closeMap} className="h-9 w-9 grid place-content-center rounded-lg border border-neutral-200 hover:bg-neutral-50"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                {mapData ? (
                  <InfrastructureGoogleMap
                    data={mapData}
                    onPointClick={(p) => setSelectedPoint(p)}
                    onBoundsChanged={handleBoundsChanged}
                    initialCenter={previewCenter || undefined}
                    className="h-full"
                  />
                ) : (
                  <div className="h-full grid place-content-center text-neutral-500">Loading map...</div>
                )}
              </div>
            </div>
            <PointSidebar point={selectedPoint} onClose={() => setSelectedPoint(null)} infrastructureId={selectedInfra?.id} />
          </>
        )}

        {/* Edit Modal */}
        {editModal.open && editModal.infra && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30" onClick={() => setEditModal({ open: false, infra: null })} />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
              <div className="text-sm font-semibold mb-3">Edit infrastructure</div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-neutral-600 mb-1">Name</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-600 mb-1">Type</label>
                  <input value={editType} onChange={(e) => setEditType(e.target.value)} placeholder="pipeline, dam, bridge…" className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setEditModal({ open: false, infra: null })} className="px-3 py-2 rounded-lg border border-neutral-200 text-sm">Cancel</button>
                  <button
                    onClick={async () => {
                      if (!editModal.infra) return;
                      try {
                        await patchInfra(editModal.infra.id, { name: editName.trim(), type: editType.trim() || null });
                        setEditModal({ open: false, infra: null });
                        fetchInfrastructures();
                      } catch { }
                    }}
                    className="px-3 py-2 rounded-lg bg-black text-white text-sm"
                  >Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {confirmDelete.open && confirmDelete.infra && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30" onClick={() => setConfirmDelete({ open: false, infra: null })} />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
              <div className="text-sm font-semibold mb-2">Delete infrastructure</div>
              <p className="text-sm text-neutral-600">This action will remove the infrastructure, its points, jobs and measurements. This cannot be undone.</p>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setConfirmDelete({ open: false, infra: null })} className="px-3 py-2 rounded-lg border border-neutral-200 text-sm">Cancel</button>
                <button
                  onClick={() => {
                    if (!confirmDelete.infra) return;
                    const id = confirmDelete.infra.id;
                    // Optimistic UI: close modal and remove row immediately
                    setConfirmDelete({ open: false, infra: null });
                    setInfrastructures((prev) => prev.filter((i) => i.id !== id));
                    // Fire-and-forget delete, then background refresh to reconcile
                    deleteInfra(id)
                      .then(() => fetchInfrastructures())
                      .catch(() => fetchInfrastructures());
                  }}
                  className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm"
                >Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Close type filter when clicking outside */}
        {typeFilterOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setTypeFilterOpen(false)} />
        )}

        {/* Global Actions Menu Portal */}
        {actionOpenId && actionMenuInfra && actionMenuPos && (
          <div className="fixed inset-0 z-[9999]" onClick={() => { setActionOpenId(null); setActionMenuInfra(null); setActionMenuPos(null); }}>
            <div
              className="absolute w-44 rounded-lg border border-neutral-200 bg-white shadow-xl"
              style={{ left: actionMenuPos.x, top: actionMenuPos.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => {
                  const infra = actionMenuInfra;
                  setActionOpenId(null);
                  setActionMenuInfra(null);
                  setActionMenuPos(null);
                  if (!infra) return;
                  setEditName(infra.name);
                  setEditType(infra.type || '');
                  setEditModal({ open: true, infra });
                }}
              >Edit name/type</button>
              <button
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  const infra = actionMenuInfra;
                  setActionOpenId(null);
                  setActionMenuInfra(null);
                  setActionMenuPos(null);
                  if (!infra) return;
                  setConfirmDelete({ open: true, infra });
                }}
              >Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
