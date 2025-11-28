'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronRight, MapPin, Zap, TrendingUp, AlertCircle, CheckCircle2, Loader } from 'lucide-react';
import { supabase as importedSupabase } from '../../../lib/supabaseClient';
const supabase: any = importedSupabase as any;

// Google Maps Drawing: we'll lazy-load the script and use window.google

interface BboxCoordinates {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface DrawingState {
  isDrawing: boolean;
  points: [number, number][];
  bbox: BboxCoordinates | null;
  closed: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapContainer = useRef<HTMLDivElement>(null);
  const gmap = useRef<any>(null);
  const drawingManager = useRef<any>(null);
  const drawnPolygon = useRef<any>(null);
  const vertexMarkers = useRef<any[]>([]);
  const [step, setStep] = useState<'name' | 'draw' | 'estimate' | 'generate'>('name');
  const [mode, setMode] = useState<'DRAW' | 'ADDRESS' | 'SHP'>('DRAW');
  const [infrastructureName, setInfrastructureName] = useState('');
  const [drawing, setDrawing] = useState<DrawingState>({
    isDrawing: false,
    points: [],
    bbox: null,
    closed: false,
  });
  const [estimation, setEstimation] = useState<{
    estimatedPoints: number;
    surfaceKm2: number;
    monthlyCostEur: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infrastructureId, setInfrastructureId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [searchCoords, setSearchCoords] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<[number, number] | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [addressBbox, setAddressBbox] = useState<BboxCoordinates | null>(null);
  const [shpFile, setShpFile] = useState<File | null>(null);
  const drawingRef = useRef(drawing);

  // Keep ref in sync
  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  // Centralized auth token retrieval and auto-refresh
  const getSupabaseAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = (data?.session as any)?.access_token as string | undefined;
      if (token && token.length > 5000) return null; // corrupted guard
      return token ?? null;
    } catch {
      return null;
    }
  }, []);

  const authedFetch = useCallback(async (input: string, init: RequestInit = {}) => {
    // Prefer Supabase session token (fresh), then refresh, then fallback to legacy local token
    let token = await getSupabaseAccessToken();
    if (!token) {
      try { await supabase.auth.refreshSession(); } catch { }
      token = await getSupabaseAccessToken();
    }
    if (!token) {
      token = localStorage.getItem('token') || null;
    }
    if (!token) throw new Error('UNAUTHORIZED');

    const doFetch = (t: string) => fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${t}`,
        'Content-Type': (init.headers as any)?.['Content-Type'] || 'application/json',
      },
    });

    let res = await doFetch(token);
    if (res.status === 401) {
      // One more attempt with a forced refresh
      try { await supabase.auth.refreshSession(); } catch { }
      const refreshed = await getSupabaseAccessToken();
      if (refreshed) {
        res = await doFetch(refreshed);
      }
      if (res.status === 401) {
        // Avoid loop: sign out so login page doesn't immediately bounce back
        try { await supabase.auth.signOut(); } catch { }
      }
    }
    return res;
  }, [getSupabaseAccessToken]);

  // Initialize mode from query param
  useEffect(() => {
    const m = (searchParams?.get('mode') || '').toLowerCase();
    if (m === 'draw') setMode('DRAW');
    else if (m === 'address') setMode('ADDRESS');
    else if (m === 'shp') setMode('SHP');
  }, [searchParams]);

  // Initialize Google Maps with DrawingManager
  useEffect(() => {
    if (step !== 'draw' || !mapContainer.current) return;

    const loadGoogle = () => new Promise<void>((resolve, reject) => {
      const w: any = window as any;
      if (w.google?.maps) {
        // Ensure drawing library is available even if maps already loaded elsewhere
        if (w.google.maps.drawing) return resolve();
        if (typeof w.google.maps.importLibrary === 'function') {
          w.google.maps.importLibrary('drawing').then(() => resolve()).catch(reject);
          return;
        }
        return resolve();
      }
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=drawing`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });

    let mounted = true;

    loadGoogle().then(() => {
      if (!mounted || !mapContainer.current) return;
      const g = (window as any).google;
      gmap.current = new g.maps.Map(mapContainer.current, {
        center: { lat: 25.5, lng: -97.5 },
        zoom: 12,
        mapTypeId: 'satellite',
        tilt: 0,
        disableDefaultUI: false,
        gestureHandling: 'greedy',
        draggableCursor: 'crosshair',
      });

      drawingManager.current = new g.maps.drawing.DrawingManager({
        drawingMode: g.maps.drawing.OverlayType.POLYGON,
        drawingControl: true,
        drawingControlOptions: {
          drawingModes: [g.maps.drawing.OverlayType.POLYGON],
          position: g.maps.ControlPosition.TOP_CENTER,
        },
        polygonOptions: {
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
          strokeColor: '#3b82f6',
          strokeWeight: 3,
          clickable: true,
          editable: true,
          zIndex: 1,
        },
      });
      drawingManager.current.setMap(gmap.current);

      const clearVertexMarkers = () => {
        vertexMarkers.current.forEach(m => m.setMap(null));
        vertexMarkers.current = [];
      };

      const updateVertexMarkers = (poly: any) => {
        clearVertexMarkers();
        const path = poly.getPath().getArray();
        path.forEach((p: any) => {
          const marker = new g.maps.Marker({
            position: p,
            clickable: false,
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: 4,
              fillColor: '#111',
              fillOpacity: 1,
              strokeWeight: 0,
            },
            map: gmap.current,
          });
          vertexMarkers.current.push(marker);
        });
      };

      const onComplete = (poly: any) => {
        drawnPolygon.current?.setMap(null);
        drawnPolygon.current = poly;
        const path = poly.getPath().getArray();
        if (!path || path.length < 3) return;
        const lngs = path.map((p: any) => p.lng());
        const lats = path.map((p: any) => p.lat());
        const bbox = {
          minLon: Math.min(...lngs),
          maxLon: Math.max(...lngs),
          minLat: Math.min(...lats),
          maxLat: Math.max(...lats),
        };
        const pts: [number, number][] = path.map((p: any) => [p.lng(), p.lat()]);
        setDrawing({ isDrawing: false, points: pts, bbox, closed: true });
        updateVertexMarkers(poly);

        // Keep markers in sync if user edits vertices
        const sync = () => updateVertexMarkers(poly);
        poly.getPath().addListener('set_at', sync);
        poly.getPath().addListener('insert_at', sync);
        poly.getPath().addListener('remove_at', sync);
      };

      const completeListener = (window as any).google.maps.event.addListener(
        drawingManager.current,
        'polygoncomplete',
        onComplete
      );

      // cleanup
      return () => {
        (window as any).google?.maps?.event?.removeListener?.(completeListener);
        drawnPolygon.current?.setMap?.(null);
        drawingManager.current?.setMap?.(null);
        clearVertexMarkers();
      };
    }).catch((e) => {
      setError(e?.message || 'Failed to load Google Maps');
    });

    return () => {
      mounted = false;
    };
  }, [step]);

  const handleEstimateAddress = async () => {
    if (!addressInput.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/onboarding/estimate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: 'ADDRESS', address: addressInput }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to estimate address');
      }

      const data = await response.json();
      setEstimation({
        estimatedPoints: data.estimatedPoints,
        surfaceKm2: data.surfaceKm2,
        monthlyCostEur: data.monthlyCostEur,
      });
      setAddressBbox(data.bbox);
      setStep('estimate');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (msg === 'UNAUTHORIZED') {
        try { await supabase.auth.signOut(); } catch { }
        const next = typeof window !== 'undefined' ? window.location.pathname : '/';
        router.push(`/auth/login?reauth=1&next=${encodeURIComponent(next)}`);
        return;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInfraAddressAndGenerate = async () => {
    if (!infrastructureName || !addressInput.trim() || !addressBbox) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      // Create infrastructure from bbox
      const infraRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/infrastructures`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: infrastructureName,
          bbox: addressBbox,
          mode_onboarding: 'ADDRESS',
        }),
      });
      if (!infraRes.ok) {
        const err = await infraRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create infrastructure');
      }
      const infra = await infraRes.json();

      // Generate grid by ADDRESS mode
      const genRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/onboarding/generate-grid`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'ADDRESS',
          infrastructureId: infra.id,
          address: addressInput,
        }),
      });
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate grid');
      }

      // Auto-start sample job then redirect
      try {
        const jobRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/jobs/process-insar`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ infrastructureId: infra.id }),
        });
        if (jobRes.ok) {
          const job = await jobRes.json();
          router.push(`/infrastructure/${infra.id}?jobId=${job.jobId}`);
          return;
        }
      } catch { }
      router.push(`/infrastructure/${infra.id}?autostart=1&created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadShapefileAndGenerate = async () => {
    if (!infrastructureName || !shpFile) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const form = new FormData();
      form.append('shapefile', shpFile);
      form.append('name', infrastructureName);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/onboarding/generate-grid-shp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate from shapefile');
      }
      const data = await res.json();
      const infraId = data.infrastructureId as string;

      try {
        const jobRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/jobs/process-insar`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ infrastructureId: infraId }),
        });
        if (jobRes.ok) {
          const job = await jobRes.json();
          router.push(`/infrastructure/${infraId}?jobId=${job.jobId}`);
          return;
        }
      } catch { }
      router.push(`/infrastructure/${infraId}?autostart=1&created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Mapbox-specific overlay logic removed; Google DrawingManager handles rendering

  const handleMapMouseMove = (_e: any) => {
    // Google Maps handles cursor; no-op kept for compatibility
  };

  const handleMapClick = (_e: any) => {
    // Drawing handled by DrawingManager; no-op
  };

  const handleUndoPoint = () => {
    drawnPolygon.current?.setMap?.(null);
    drawnPolygon.current = null;
    setDrawing({ isDrawing: false, points: [], bbox: null, closed: false });
    // Clear vertex markers
    try {
      vertexMarkers.current.forEach(m => m.setMap(null));
      vertexMarkers.current = [];
    } catch { }
  };

  const handleEstimate = async () => {
    if (!drawing.bbox) return;

    setIsLoading(true);
    setError(null);

    try {
      const ring = drawing.points.length > 0
        ? (() => {
          const r = [...drawing.points];
          const first = r[0];
          const last = r[r.length - 1];
          if (!last || last[0] !== first[0] || last[1] !== first[1]) r.push(first);
          return r;
        })()
        : [
          [
            [drawing.bbox.minLon, drawing.bbox.minLat],
            [drawing.bbox.maxLon, drawing.bbox.minLat],
            [drawing.bbox.maxLon, drawing.bbox.maxLat],
            [drawing.bbox.minLon, drawing.bbox.maxLat],
            [drawing.bbox.minLon, drawing.bbox.minLat],
          ],
        ][0];

      const response = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/onboarding/estimate`, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'DRAW',
          polygon: {
            type: 'Polygon',
            coordinates: [ring],
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Estimation error:', errorData);
        if (response.status === 401) throw new Error('UNAUTHORIZED');
        throw new Error(errorData.error || 'Failed to estimate grid');
      }

      const data = await response.json();
      setEstimation(data);
      setStep('estimate');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg === 'UNAUTHORIZED') {
        setError('Your session expired. Please log in again.');
        try { await supabase.auth.signOut(); } catch { }
        const next = typeof window !== 'undefined' ? window.location.pathname : '/';
        setTimeout(() => router.push(`/auth/login?reauth=1&next=${encodeURIComponent(next)}`), 50);
        return;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInfrastructure = async () => {
    if (!infrastructureName || !drawing.bbox) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/infrastructures`, {
        method: 'POST',
        body: JSON.stringify({
          name: infrastructureName,
          bbox: {
            minLat: drawing.bbox.minLat,
            maxLat: drawing.bbox.maxLat,
            minLon: drawing.bbox.minLon,
            maxLon: drawing.bbox.maxLon,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Create infrastructure error:', errorData);
        throw new Error(errorData.error || 'Failed to create infrastructure');
      }

      const infra = await response.json();
      setInfrastructureId(infra.id);
      setStep('generate');
      // Generate grid then redirect to infrastructure page
      const ok = await handleGenerateGrid(infra.id);
      if (ok) {
        router.push(`/infrastructure/${infra.id}?created=1`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg === 'UNAUTHORIZED') {
        const next = typeof window !== 'undefined' ? window.location.pathname : '/';
        router.push(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchCoordinates = async () => {
    setSearchError(null);

    // Parse coordinates (format: "lat,lng" or "lat, lng")
    const coords = searchCoords.trim().split(',').map((c) => parseFloat(c.trim()));

    if (coords.length !== 2 || coords.some(isNaN)) {
      setSearchError('Invalid format. Use: latitude,longitude (e.g., 25.5,-97.5)');
      return;
    }

    const [lat, lng] = coords;

    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setSearchError('Coordinates out of range. Latitude: -90 to 90, Longitude: -180 to 180');
      return;
    }

    // Center map on coordinates (Google Maps)
    if (gmap.current) {
      gmap.current.setCenter({ lat, lng });
      gmap.current.setZoom(15);
    }

    setSearchCoords('');
  };

  const handleGenerateGrid = async (infraId: string) => {
    if (!drawing.bbox) return;

    setIsLoading(true);
    setError(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setGenerationProgress((prev) => Math.min(prev + Math.random() * 30, 90));
      }, 500);

      const response = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/onboarding/generate-grid`, {
        method: 'POST',
        body: JSON.stringify({
          infrastructureId: infraId,
          mode: 'DRAW',
          polygon: {
            type: 'Polygon',
            coordinates: [
              (() => {
                const r = [...drawing.points];
                const first = r[0];
                const last = r[r.length - 1];
                if (!last || last[0] !== first[0] || last[1] !== first[1]) r.push(first);
                return r;
              })(),
            ],
          },
        }),
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      if (!response.ok) {
        throw new Error('Failed to generate grid');
      }

      // No redirect here; caller will navigate (and possibly autostart job)
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="relative z-10">
        {/* Header removed: App TopBar is already providing global chrome */}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-12">
          {step === 'name' && (
            <div className="max-w-3xl mx-auto">
              {/* Form card */}
              <div className="p-6 sm:p-8 rounded-2xl bg-white border border-neutral-200 shadow-sm">
                <div className="mb-5 flex items-center gap-2 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-50 border border-neutral-200 text-neutral-700">1 • Create</span>
                  <span className="px-2 py-1">→</span>
                  <span className="px-2 py-1">2 • Define</span>
                  <span className="px-2 py-1">3 • Estimate</span>
                  <span className="px-2 py-1">4 • Generate</span>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Infrastructure name</label>
                    <input
                      type="text"
                      value={infrastructureName}
                      onChange={(e) => setInfrastructureName(e.target.value)}
                      placeholder="e.g., Texas Pipeline, Bridge A1"
                      className="w-full px-4 py-2.5 rounded-lg bg-white border border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-all text-sm"
                    />
                    <p className="mt-1 text-xs text-neutral-500">Use a unique, descriptive name. You can change it later.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {['A1 Bridge', 'East Dam', 'North Pipeline'].map((s) => (
                        <button key={s} onClick={() => setInfrastructureName(s)} className="px-2.5 py-1 rounded-md border border-neutral-200 text-xs text-neutral-700 hover:bg-neutral-50">{s}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Method</label>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {[
                        { key: 'DRAW', label: 'Draw', desc: 'Sketch on satellite map', Icon: Zap },
                        { key: 'ADDRESS', label: 'Address', desc: 'Search and define by address', Icon: MapPin },
                        { key: 'SHP', label: 'Shapefile', desc: 'Upload .shp/.zip boundary', Icon: TrendingUp },
                      ].map((m) => (
                        <button
                          key={m.key}
                          onClick={() => setMode(m.key as any)}
                          className={`text-left p-4 rounded-xl border transition-colors ${mode === m.key ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:bg-neutral-50'}`}
                        >
                          <div className="h-8 w-8 rounded-lg bg-neutral-100 text-neutral-900 grid place-content-center mb-2">
                            <m.Icon className="h-4 w-4" />
                          </div>
                          <div className="text-sm font-semibold text-neutral-900">{m.label}</div>
                          <div className="text-xs text-neutral-600">{m.desc}</div>
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">Choose how you want to define the monitoring boundary.</p>
                  </div>

                  {mode === 'DRAW' && (
                    <button
                      onClick={() => setStep('draw')}
                      disabled={!infrastructureName || isLoading}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-black hover:bg-neutral-900 disabled:bg-neutral-200 disabled:text-neutral-500 text-white font-semibold transition-all inline-flex items-center justify-center gap-2"
                    >
                      Continue to Draw <ChevronRight className="w-4 h-4" />
                    </button>
                  )}

                  {mode === 'ADDRESS' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">Address</label>
                        <input
                          type="text"
                          value={addressInput}
                          onChange={(e) => setAddressInput(e.target.value)}
                          placeholder="12 Rue Exemple, Paris"
                          className="w-full px-4 py-2.5 rounded-lg bg-white border border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-all text-sm"
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <button
                          onClick={handleEstimateAddress}
                          disabled={!infrastructureName || !addressInput.trim() || isLoading}
                          className="px-6 py-2.5 rounded-lg bg-black hover:bg-neutral-900 disabled:bg-neutral-200 disabled:text-neutral-500 text-white font-semibold transition-all"
                        >
                          Estimate
                        </button>
                        <button
                          onClick={handleCreateInfraAddressAndGenerate}
                          disabled={!infrastructureName || !addressInput.trim() || !addressBbox || isLoading}
                          className="px-6 py-2.5 rounded-lg bg-black hover:bg-neutral-900 disabled:bg-neutral-200 disabled:text-neutral-500 text-white font-semibold transition-all"
                        >
                          Create & Generate
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === 'SHP' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">.shp or .zip</label>
                        <input
                          type="file"
                          accept=".shp,.zip"
                          onChange={(e) => setShpFile(e.target.files?.[0] || null)}
                          className="w-full text-sm text-neutral-700"
                        />
                      </div>
                      <button
                        onClick={handleUploadShapefileAndGenerate}
                        disabled={!infrastructureName || !shpFile || isLoading}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-black hover:bg-neutral-900 disabled:bg-neutral-200 disabled:text-neutral-500 text-white font-semibold transition-all"
                      >
                        Upload & Generate
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <div className="pt-2 text-xs text-neutral-500">Your assets and boundaries remain private by default. You control sharing at any time.</div>
                  <div className="pt-3 text-xs text-neutral-600">Need help? <a href="/help" className="underline hover:text-neutral-900">Open the documentation</a>.</div>
                </div>
              </div>
            </div>
          )}

          {step === 'draw' && (
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-50 border border-neutral-200 text-neutral-700">1 • Create</span>
                  <span className="px-2 py-1">→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black text-white">2 • Define</span>
                  <span className="px-2 py-1">3 • Estimate</span>
                  <span className="px-2 py-1">4 • Generate</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-1">Define monitoring boundary</h2>
                    <p className="text-neutral-600 text-sm">Click on the map to draw your area. Minimum 3 points required.</p>
                  </div>
                  <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md border border-neutral-200 text-xs text-neutral-700">Method: Draw</span>
                </div>
              </div>

              {/* Search bar */}
              <div className="p-4 rounded-xl bg-white border border-neutral-200">
                <label className="block text-sm font-medium text-neutral-700 mb-3">Jump to Coordinates</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchCoords}
                    onChange={(e) => {
                      setSearchCoords(e.target.value);
                      setSearchError(null);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchCoordinates();
                      }
                    }}
                    placeholder="e.g., 25.5,-97.5 (latitude,longitude)"
                    className="flex-1 px-4 py-2 rounded-lg bg-white border border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 transition-all text-sm"
                  />
                  <button
                    onClick={handleSearchCoordinates}
                    className="px-6 py-2 rounded-lg bg-black hover:bg-neutral-900 text-white font-medium transition-all text-sm"
                  >
                    Go
                  </button>
                </div>
                {searchError && (
                  <p className="text-xs text-red-600 mt-2">{searchError}</p>
                )}
                <div className="mt-3 text-xs text-neutral-600">
                  Tips: Zoom with mouse wheel or trackpad. Pan by dragging the map. Drag vertices to adjust the shape.
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Map */}
                <div className="lg:col-span-2">
                  <div
                    ref={mapContainer}
                    className="w-full h-96 rounded-xl overflow-hidden border border-neutral-200 shadow-sm"
                  />
                </div>

                {/* Info Panel */}
                <div className="space-y-4">
                  <div className="p-6 rounded-xl bg-white border border-neutral-200">
                    <h3 className="font-semibold text-neutral-900 mb-4">Drawing Info</h3>

                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-neutral-600">Points</p>
                        <p className="text-2xl font-bold text-neutral-900">{drawing.points.length}</p>
                      </div>

                      {drawing.bbox && (
                        <>
                          <div className="pt-3 border-t border-neutral-200">
                            <p className="text-neutral-600 mb-2">Bounding Box</p>
                            <div className="space-y-1 text-xs font-mono text-neutral-700">
                              <p>Lat: {drawing.bbox.minLat.toFixed(4)} → {drawing.bbox.maxLat.toFixed(4)}</p>
                              <p>Lon: {drawing.bbox.minLon.toFixed(4)} → {drawing.bbox.maxLon.toFixed(4)}</p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="flex gap-2 mt-6">
                      <button
                        onClick={handleUndoPoint}
                        disabled={drawing.points.length === 0}
                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 text-neutral-900 text-sm font-medium transition-all"
                      >
                        Undo
                      </button>
                      <button
                        onClick={() => {
                          setDrawing({ isDrawing: false, points: [], bbox: null, closed: false });
                          setStep('name');
                        }}
                        className="flex-1 px-3 py-2 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-900 text-sm font-medium transition-all"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleEstimate}
                    disabled={drawing.points.length < 3 || isLoading}
                    className="w-full px-6 py-3 rounded-lg bg-black hover:bg-neutral-900 disabled:bg-neutral-200 disabled:text-neutral-500 text-white font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Estimating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Estimate Grid
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'estimate' && estimation && (
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs text-neutral-600">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-50 border border-neutral-200 text-neutral-700">1 • Create</span>
                  <span className="px-2 py-1">→</span>
                  <span className="px-2 py-1">2 • Define</span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black text-white">3 • Estimate</span>
                  <span className="px-2 py-1">4 • Generate</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-900 mb-1">Grid estimation</h2>
                    <p className="text-neutral-600 text-sm">Review the parameters before generation.</p>
                  </div>
                  <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md border border-neutral-200 text-xs text-neutral-700">Method: {mode === 'DRAW' ? 'Draw' : mode === 'ADDRESS' ? 'Address' : 'Shapefile'}</span>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { label: 'Estimated Points', value: estimation.estimatedPoints.toLocaleString(), icon: '📍' },
                  { label: 'Surface Area', value: `${estimation.surfaceKm2.toFixed(2)} km²`, icon: '📐' },
                  { label: 'Monthly Cost', value: `€${estimation.monthlyCostEur.toFixed(2)}`, icon: '💶' },
                ].map((stat, i) => (
                  <div key={i} className="p-6 rounded-xl bg-white border border-neutral-200">
                    <p className="text-3xl mb-2">{stat.icon}</p>
                    <p className="text-neutral-600 text-sm mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(mode === 'DRAW' ? 'draw' : 'name')}
                  className="flex-1 px-6 py-3 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-900 font-semibold transition-all"
                >
                  Back
                </button>
                {mode === 'DRAW' ? (
                  <button
                    onClick={handleCreateInfrastructure}
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 rounded-lg bg-black hover:bg-neutral-900 disabled:bg-neutral-200 disabled:text-neutral-500 text-white font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Create Infrastructure
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleCreateInfraAddressAndGenerate}
                    disabled={!addressBbox || isLoading}
                    className="flex-1 px-6 py-3 rounded-lg bg-black hover:bg-neutral-900 disabled:bg-neutral-200 disabled:text-neutral-500 text-white font-semibold transition-all"
                  >
                    {isLoading ? 'Processing...' : 'Créer & Générer'}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'generate' && (
            <div className="max-w-md mx-auto space-y-8 py-12">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-neutral-900 mb-2">Generating Grid</h2>
                <p className="text-neutral-600">Creating monitoring points with 5-meter precision...</p>
              </div>

              <div className="p-8 rounded-2xl bg-white border border-neutral-200">
                {/* Progress bar */}
                <div className="mb-6">
                  <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
                    <div
                      className="h-full bg-black transition-all duration-300"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-neutral-600 mt-3">{Math.round(generationProgress)}%</p>
                </div>

                {/* Status */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-neutral-600">Infrastructure created</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {generationProgress < 100 ? (
                      <Loader className="w-4 h-4 text-neutral-900 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                    <span className="text-neutral-600">Generating grid points</span>
                  </div>
                </div>
              </div>

              <p className="text-center text-xs text-neutral-500">
                Redirecting to dashboard...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
