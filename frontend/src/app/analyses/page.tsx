/**
 * Analyses Page - Track and monitor InSAR analysis jobs
 * Real-time status updates for all analyses
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Loader,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Filter,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { supabase as importedSupabase } from '../../../lib/supabaseClient';
const supabase: any = importedSupabase as any;

interface Job {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  hy3_job_id: string | null;
  infrastructure_id: string;
  infrastructure_name?: string;
  created_at: string;
  completed_at: string | null;
  error_message?: string | null;
  retry_count?: number;
  processing_time_ms?: number | null;
  hy3_product_urls?: any;
}

interface Infrastructure {
  id: string;
  name: string;
}

export default function AnalysesPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [infrastructures, setInfrastructures] = useState<Infrastructure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [infraFilter, setInfraFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get token helper
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
    const method = init.method || 'GET';
    console.log(`[${method}] authedFetch START:`, input);

    let token = await getSupabaseAccessToken();
    if (!token) {
      try { await supabase.auth.refreshSession(); } catch { }
      token = await getSupabaseAccessToken();
    }
    if (!token) token = localStorage.getItem('token') || null;
    console.log(`[${method}] Token:`, token?.substring(0, 20) + '...');
    if (!token) throw new Error('UNAUTHORIZED');

    const doFetch = (tk: string) => fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${tk}`,
        'Content-Type': (init.headers as any)?.['Content-Type'] || 'application/json',
      },
    });

    console.log(`[${method}] Avant fetch`);
    let res = await doFetch(token);
    console.log(`[${method}] Après fetch:`, res.status, res.statusText);
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

  // Fetch infrastructures
  const fetchInfrastructures = useCallback(async () => {
    try {
      const res = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures`);
      if (res.ok) {
        const data = await res.json();
        setInfrastructures(data.infrastructures || []);
      }
    } catch (err) {
      console.error('Failed to fetch infrastructures:', err);
    }
  }, [authedFetch]);

  // Fetch all jobs from all infrastructures
  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First get all infrastructures
      await fetchInfrastructures();
      const res = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures`);
      if (!res.ok) throw new Error('Failed to fetch infrastructures');
      const infraData = await res.json();
      const infras = infraData.infrastructures || [];

      // Then fetch jobs for each infrastructure
      const allJobs: Job[] = [];
      for (const infra of infras) {
        try {
          const jobsRes = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs?infrastructureId=${infra.id}`);
          if (jobsRes.ok) {
            const jobsData = await jobsRes.json();
            const infraJobs = (jobsData.jobs || []).map((job: any) => ({
              ...job,
              infrastructure_name: infra.name,
            }));
            allJobs.push(...infraJobs);
          }
        } catch (err) {
          console.error(`Failed to fetch jobs for ${infra.id}:`, err);
        }
      }

      // Sort by created_at descending (newest first)
      allJobs.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setJobs(allJobs);
    } catch (err: any) {
      const msg = err.message || 'Failed to load analyses';
      if (msg === 'UNAUTHORIZED') {
        router.push('/auth/login');
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, fetchInfrastructures, router]);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh for active jobs
  useEffect(() => {
    const activeJobs = jobs.filter(j =>
      j.status === 'PENDING' || j.status === 'RUNNING' || j.status === 'PROCESSING'
    );

    if (activeJobs.length === 0) return;

    const interval = setInterval(() => {
      fetchJobs();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    let filtered = [...jobs];

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(j =>
        j.status === 'PENDING' || j.status === 'RUNNING' || j.status === 'PROCESSING'
      );
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(j => j.status === 'SUCCEEDED');
    } else if (statusFilter === 'failed') {
      filtered = filtered.filter(j => j.status === 'FAILED' || j.status === 'CANCELLED');
    }

    // Infrastructure filter
    if (infraFilter !== 'all') {
      filtered = filtered.filter(j => j.infrastructure_id === infraFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(j =>
        j.id.toLowerCase().includes(query) ||
        j.infrastructure_name?.toLowerCase().includes(query) ||
        (j.hy3_job_id && j.hy3_job_id.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [jobs, statusFilter, infraFilter, searchQuery]);

  // Calculate elapsed time
  const getElapsedTime = (createdAt: string) => {
    const start = new Date(createdAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  // Get status config
  const getStatusConfig = (status: Job['status']) => {
    switch (status) {
      case 'PENDING':
        return { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Pending', icon: Clock };
      case 'RUNNING':
      case 'PROCESSING':
        return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Processing', icon: Loader };
      case 'SUCCEEDED':
        return { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Completed', icon: CheckCircle2 };
      case 'FAILED':
      case 'CANCELLED':
        return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: status === 'FAILED' ? 'Failed' : 'Cancelled', icon: XCircle };
      default:
        return { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', label: status, icon: AlertCircle };
    }
  };

  const activeCount = jobs.filter(j =>
    j.status === 'PENDING' || j.status === 'RUNNING' || j.status === 'PROCESSING'
  ).length;
  const completedCount = jobs.filter(j => j.status === 'SUCCEEDED').length;
  const failedCount = jobs.filter(j => j.status === 'FAILED' || j.status === 'CANCELLED').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Analyses</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Monitor and track your InSAR monitoring analyses
          </p>
        </div>
        <button
          onClick={() => router.push('/analyses/new')}
          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          New Analysis
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="text-xs font-medium text-neutral-500 mb-1">Total</div>
          <div className="text-2xl font-semibold text-neutral-900">{jobs.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="text-xs font-medium text-neutral-500 mb-1">Active</div>
          <div className="text-2xl font-semibold text-amber-600">{activeCount}</div>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="text-xs font-medium text-neutral-500 mb-1">Completed</div>
          <div className="text-2xl font-semibold text-green-600">{completedCount}</div>
        </div>
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <div className="text-xs font-medium text-neutral-500 mb-1">Failed</div>
          <div className="text-2xl font-semibold text-red-600">{failedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by ID or infrastructure..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-neutral-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={infraFilter}
            onChange={(e) => setInfraFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          >
            <option value="all">All Infrastructures</option>
            {infrastructures.map(infra => (
              <option key={infra.id} value={infra.id}>{infra.name}</option>
            ))}
          </select>
          <button
            onClick={fetchJobs}
            disabled={isLoading}
            className="h-9 w-9 rounded-lg border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-neutral-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Jobs List */}
      {isLoading && jobs.length === 0 ? (
        <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
          <Loader className="h-8 w-8 animate-spin text-neutral-400 mx-auto mb-4" />
          <p className="text-sm text-neutral-500">Loading analyses...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-900">Error</div>
            <div className="text-sm text-red-700 mt-0.5">{error}</div>
          </div>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white rounded-lg border border-neutral-200 p-12 text-center">
          <Sparkles className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
          <p className="text-sm font-medium text-neutral-900 mb-1">No analyses found</p>
          <p className="text-xs text-neutral-500">
            {searchQuery || statusFilter !== 'all' || infraFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first analysis to get started'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const statusConfig = getStatusConfig(job.status);
            const StatusIcon = statusConfig.icon;
            const isActive = job.status === 'PENDING' || job.status === 'RUNNING' || job.status === 'PROCESSING';

            return (
              <div
                key={job.id}
                className="bg-white rounded-lg border border-neutral-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`${statusConfig.bg} ${statusConfig.border} border rounded-lg p-2`}>
                        <StatusIcon className={`h-5 w-5 ${statusConfig.color} ${isActive ? 'animate-spin' : ''}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                          {isActive && (
                            <span className="text-xs text-neutral-500">
                              • {getElapsedTime(job.created_at)} elapsed
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {job.infrastructure_name || 'Unknown Infrastructure'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <div className="text-neutral-500 mb-0.5">Job ID</div>
                        <div className="text-neutral-900 font-mono truncate" title={job.id}>{job.id}</div>
                      </div>
                      <div>
                        <div className="text-neutral-500 mb-0.5">Started</div>
                        <div className="text-neutral-900">
                          {new Date(job.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      {job.completed_at ? (
                        <div>
                          <div className="text-neutral-500 mb-0.5">Completed</div>
                          <div className="text-neutral-900">
                            {new Date(job.completed_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      ) : job.processing_time_ms ? (
                        <div>
                          <div className="text-neutral-500 mb-0.5">Processing Time</div>
                          <div className="text-neutral-900">
                            {Math.round(job.processing_time_ms / 1000)}s
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Error Message */}
                    {job.error_message && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex gap-2">
                          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-red-900 mb-1">Error</div>
                            <div className="text-xs text-red-700 whitespace-pre-wrap">{job.error_message}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Additional Info */}
                    {(job.retry_count !== undefined && job.retry_count > 0) && (
                      <div className="mt-2 text-xs text-neutral-500">
                        Retry count: {job.retry_count}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {isActive && (
                      <button
                        onClick={async () => {
                          console.log('Cancel clicked', job.id);
                          if (!confirm(`Are you sure you want to cancel this analysis?`)) return;

                          try {
                            console.log('Appel DELETE', `${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${job.id}`);
                            const res = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${job.id}`, {
                              method: 'DELETE',
                            });
                            console.log('Réponse DELETE', res);
                            if (res.ok) {
                              // Refresh jobs list
                              await fetchJobs();
                            } else {
                              const error = await res.json().catch(() => ({ error: 'Failed to cancel job' }));
                              alert(error.error || error.message || 'Failed to cancel job');
                            }
                          } catch (err: any) {
                            console.log('Erreur DELETE', err);
                            console.error('Failed to cancel job:', err);
                            alert(err.message || 'Failed to cancel job');
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                        title="Cancel this analysis"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </button>
                    )}
                    {!isActive && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to delete this analysis?`)) return;

                          try {
                            const res = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${job.id}`, {
                              method: 'DELETE',
                            });
                            if (res.ok) {
                              // Refresh jobs list
                              await fetchJobs();
                            } else {
                              const error = await res.json().catch(() => ({ error: 'Failed to delete job' }));
                              alert(error.error || error.message || 'Failed to delete job');
                            }
                          } catch (err: any) {
                            console.error('Failed to delete job:', err);
                            alert(err.message || 'Failed to delete job');
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1"
                        title="Delete this analysis"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          const res = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${job.id}`);
                          if (res.ok) {
                            const jobDetails = await res.json();
                            console.log('Job Details:', jobDetails);
                            // You could open a modal here with full details
                            alert(`Job Details:\n\nStatus: ${jobDetails.status}\n${jobDetails.error_message ? `Error: ${jobDetails.error_message}` : ''}\nRetry Count: ${jobDetails.retry_count || 0}`);
                          }
                        } catch (err) {
                          console.error('Failed to fetch job details:', err);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                      title="View full job details"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => router.push(`/infrastructure/${job.infrastructure_id}`)}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Infrastructure
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

