'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader, Sparkles } from 'lucide-react';
import InfrastructureGoogleMap from '@/components/Map/InfrastructureGoogleMap';
import { LaunchAnalysisModal } from '@/components/Map/LaunchAnalysisModal';
import { supabase as importedSupabase } from '../../../../lib/supabaseClient';
const supabase: any = importedSupabase as any;

interface Infrastructure {
  id: string;
  name: string;
  bbox: any;
}

export default function InfrastructurePage() {
  const params = useParams();
  const infrastructureId = params?.id as string;
  const search = useSearchParams();
  const router = useRouter();
  const created = search?.get('created') === '1';

  const [infrastructure, setInfrastructure] = useState<Infrastructure | null>(null);
  const [mapData, setMapData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [infrastructures, setInfrastructures] = useState<Array<{ id: string; name: string; type?: string }>>([]);

  // Helpers: token & authed fetch (align with onboarding)
  const getSupabaseAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      const t = (data?.session as any)?.access_token as string | undefined;
      if (t && t.length > 5000) return null;
      return t ?? null;
    } catch {
      return null;
    }
  }, []);

  const authedFetch = useCallback(async (input: string, init: RequestInit = {}) => {
    let token = await getSupabaseAccessToken();
    if (!token) {
      try { await supabase.auth.refreshSession(); } catch { }
      token = await getSupabaseAccessToken();
    }
    if (!token) token = localStorage.getItem('token') || null;
    if (!token) throw new Error('UNAUTHORIZED');

    const doFetch = (tk: string) => fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${tk}`,
        'Content-Type': (init.headers as any)?.['Content-Type'] || 'application/json',
      },
    });

    let res = await doFetch(token);
    if (res.status === 401) {
      try { await supabase.auth.refreshSession(); } catch { }
      const refreshed = await getSupabaseAccessToken();
      if (refreshed) res = await doFetch(refreshed);
      if (res.status === 401) {
        try { await supabase.auth.signOut(); } catch { }
        throw new Error('UNAUTHORIZED');
      }
    }
    return res;
  }, [getSupabaseAccessToken]);

  useEffect(() => {
    if (!infrastructureId) return;
    fetchAll(0);
  }, [infrastructureId]);

  // Fetch infrastructures list for modal
  useEffect(() => {
    const fetchInfrastructures = async () => {
      try {
        const token = await getSupabaseAccessToken() || localStorage.getItem('token');
        if (!token) return;

        const res = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures`);
        if (res.ok) {
          const data = await res.json();
          setInfrastructures(data.infrastructures || []);
        }
      } catch (err) {
        console.error('Failed to fetch infrastructures:', err);
      }
    };

    fetchInfrastructures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!infrastructureId) return;
    const qJobId = search?.get('jobId');
    const auto = search?.get('autostart');
    if (qJobId && !jobId) {
      setJobId(qJobId);
      setJobStatus('PENDING');
      pollJob(qJobId);
    } else if (auto === '1' && !jobId) {
      startJob();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infrastructureId, search]);

  const fetchAll = async (attempt: number = 0) => {
    try {
      setIsLoading(true);
      const [infraRes, mapRes] = await Promise.all([
        authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures/${infrastructureId}`),
        authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures/${infrastructureId}/map-data?limit=50000`),
      ]);

      if (!infraRes.ok) {
        if (infraRes.status === 401) throw new Error('UNAUTHORIZED');
        if (infraRes.status === 404 && attempt < 2) {
          // Petite latence possible entre création et membership
          setTimeout(() => fetchAll(attempt + 1), 400);
          return;
        }
        throw new Error('Failed to fetch infrastructure');
      }
      if (!mapRes.ok) {
        if (mapRes.status === 401) throw new Error('UNAUTHORIZED');
        if (mapRes.status === 404 && attempt < 2) {
          setTimeout(() => fetchAll(attempt + 1), 400);
          return;
        }
        throw new Error('Failed to fetch map data');
      }

      const infra = await infraRes.json();
      const m = await mapRes.json();
      setInfrastructure(infra);
      setMapData(m);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg === 'UNAUTHORIZED') {
        const next = `/infrastructure/${infrastructureId}`;
        router.replace(`/auth/login?reauth=1&next=${encodeURIComponent(next)}`);
        return;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const startJob = async () => {
    try {
      const res = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/process-insar`, {
        method: 'POST',
        body: JSON.stringify({ infrastructureId }),
      });
      if (!res.ok) throw new Error('Failed to start job');
      const data = await res.json();
      setJobId(data.jobId);
      setJobStatus('PENDING');
      pollJob(data.jobId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (msg === 'UNAUTHORIZED') {
        const next = `/infrastructure/${infrastructureId}`;
        router.replace(`/auth/login?reauth=1&next=${encodeURIComponent(next)}`);
        return;
      }
      setError(msg);
    }
  };

  const handleLaunchAnalysis = useCallback(async (data: {
    infrastructureId: string;
    startDate: string;
    endDate: string;
    analysisCount: number;
  }) => {
    try {
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
          authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/process-insar`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
          }).then(async (res) => {
            if (!res.ok) {
              const error = await res.json().catch(() => ({ error: 'Failed to launch analysis' }));
              throw new Error(error.error || error.message || 'Failed to launch analysis');
            }
            const jobData = await res.json();
            // Track the first job for status polling
            if (i === 0 && jobData.jobId) {
              setJobId(jobData.jobId);
              setJobStatus('PENDING');
              pollJob(jobData.jobId);
            }
            return jobData;
          })
        );
      }

      await Promise.all(promises);

      // Refresh map data after a short delay
      setTimeout(() => {
        fetchAll(0);
      }, 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (msg === 'UNAUTHORIZED') {
        const next = `/infrastructure/${infrastructureId}`;
        router.replace(`/auth/login?reauth=1&next=${encodeURIComponent(next)}`);
        return;
      }
      throw new Error(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infrastructureId, authedFetch]);

  const pollJob = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const r = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${id}`);
        if (!r.ok) throw new Error('Failed to fetch job');
        const j = await r.json();
        setJobStatus(j.status);
        if (j.status === 'SUCCEEDED' || j.status === 'FAILED' || j.status === 'CANCELLED') {
          clearInterval(interval);
          if (j.status === 'SUCCEEDED') {
            // Refresh map data to show latest measurements
            await fetchAll();
          }
        }
      } catch (e) {
        // ignore transient errors
      }
    }, 5000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Chargement de l'infrastructure…</p>
        </div>
      </div>
    );
  }

  if (error || !infrastructure || !mapData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
        <div className="max-w-2xl mx-auto p-6 rounded-lg bg-red-500/10 border border-red-500/50 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-300">Erreur</p>
            <p className="text-sm text-red-200">{error || 'Infrastructure introuvable'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">{infrastructure.name}</h1>
            <p className="text-sm text-neutral-500 mt-1">Infrastructure overview</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLaunchModal(true)}
              className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Launch Analysis
            </button>
            {jobId && (
              <div className="px-3 py-2 rounded-lg border border-neutral-200 text-neutral-800 text-sm bg-white">
                Analysis {jobStatus || '…'} • ETA ~3-5 min
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 h-[calc(100vh-76px)]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500 mb-1">Total points</div>
            <div className="text-xl font-semibold text-neutral-900">{(mapData?.metadata?.totalPoints ?? mapData?.features?.length ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500 mb-1">Active points</div>
            <div className="text-xl font-semibold text-neutral-900">{(mapData?.metadata?.activePoints ?? 0).toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-xs text-neutral-500 mb-1">Status</div>
            <div className="text-xl font-semibold text-neutral-900">{jobStatus || 'Idle'}</div>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden border border-neutral-200 shadow-sm h-[calc(100%-112px)]">
          <InfrastructureGoogleMap data={mapData} className="h-full" />
        </div>
      </div>

      {/* Launch Analysis Modal */}
      <LaunchAnalysisModal
        open={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        infrastructures={infrastructures}
        onLaunch={handleLaunchAnalysis}
      />
    </div>
  );
}
