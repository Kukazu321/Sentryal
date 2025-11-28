/**
 * New Analysis Page - Professional interface for creating InSAR monitoring analyses
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Calendar, MapPin, Activity, AlertCircle, CheckCircle2, Loader, ArrowLeft } from 'lucide-react';
import { supabase as importedSupabase } from '../../../../lib/supabaseClient';
const supabase: any = importedSupabase as any;

interface Infrastructure {
  id: string;
  name: string;
  type?: string;
}

export default function NewAnalysisPage() {
  const router = useRouter();
  const [infrastructures, setInfrastructures] = useState<Infrastructure[]>([]);
  const [isLoadingInfras, setIsLoadingInfras] = useState(true);
  const [selectedInfra, setSelectedInfra] = useState<string>('');
  const [mode, setMode] = useState<'range' | 'target' | 'specific'>('range');
  // Mode range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [analysisCount, setAnalysisCount] = useState(1);
  // Mode target
  const [targetDate, setTargetDate] = useState('');
  const [imageCount, setImageCount] = useState(3);
  // Mode specific
  const [specificDates, setSpecificDates] = useState<string[]>(['', '']);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [launchedJobs, setLaunchedJobs] = useState<string[]>([]);

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

  // Fetch infrastructures
  useEffect(() => {
    const fetchInfrastructures = async () => {
      try {
        setIsLoadingInfras(true);
        const res = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/infrastructures`);
        if (res.ok) {
          const data = await res.json();
          const infras = data.infrastructures || [];
          setInfrastructures(infras);
          if (infras.length > 0 && !selectedInfra) {
            setSelectedInfra(infras[0].id);
          }
        }
      } catch (err: any) {
        if (err.message === 'UNAUTHORIZED') {
          router.push('/auth/login');
        } else {
          setError('Failed to load infrastructures');
        }
      } finally {
        setIsLoadingInfras(false);
      }
    };

    fetchInfrastructures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set default dates
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const handleLaunch = async () => {
    // Validate based on mode
    if (!selectedInfra) {
      setError('Please select an infrastructure');
      return;
    }

    if (mode === 'range' && (!startDate || !endDate || analysisCount < 1)) {
      setError('Please fill all required fields for date range mode');
      return;
    }

    if (mode === 'target' && !targetDate) {
      setError('Please select a target date');
      return;
    }

    if (mode === 'specific') {
      const validDates = specificDates.filter(d => d);
      if (validDates.length < 2) {
        setError('Please provide at least 2 specific dates');
        return;
      }
    }

    setIsLaunching(true);
    setError(null);
    setSuccess(false);
    setLaunchedJobs([]);

    try {
      const promises = [];
      const jobIds: string[] = [];

      const createJob = async (requestBody: any, jobIds: string[]) => {
        const res = await authedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/process-insar`, {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Failed to launch analysis' }));
          throw new Error(error.error || error.message || 'Failed to launch analysis');
        }
        const jobData = await res.json();
        // Handle both single job and multiple jobs response
        if (jobData.jobs && Array.isArray(jobData.jobs)) {
          // Multiple jobs (specific dates mode)
          jobData.jobs.forEach((job: any) => {
            if (job.jobId) {
              jobIds.push(job.jobId);
            }
          });
        } else if (jobData.jobId) {
          // Single job (legacy format)
          jobIds.push(jobData.jobId);
        }
        return jobData;
      };

      if (mode === 'range') {
        // Mode 1: Date range (existing behavior)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const daysPerAnalysis = Math.ceil(totalDays / analysisCount);

        for (let i = 0; i < analysisCount; i++) {
          const analysisStart = new Date(start);
          analysisStart.setDate(start.getDate() + (i * daysPerAnalysis));
          const analysisEnd = new Date(analysisStart);
          analysisEnd.setDate(analysisStart.getDate() + daysPerAnalysis - 1);
          if (analysisEnd > end) analysisEnd.setTime(end.getTime());

          const requestBody: any = {
            infrastructureId: selectedInfra,
            dateRange: {
              start: analysisStart.toISOString().split('T')[0],
              end: analysisEnd.toISOString().split('T')[0],
            },
          };

          promises.push(createJob(requestBody, jobIds));
        }
      } else if (mode === 'target') {
        // Mode 2: Target date - find N closest images
        const requestBody: any = {
          infrastructureId: selectedInfra,
          targetDate: targetDate,
          imageCount: imageCount,
        };

        promises.push(createJob(requestBody, jobIds));
      } else if (mode === 'specific') {
        // Mode 3: Specific dates - find closest image for each
        const validDates = specificDates.filter(d => d);
        const requestBody: any = {
          infrastructureId: selectedInfra,
          specificDates: validDates,
        };

        promises.push(createJob(requestBody, jobIds));
      }

      const results = await Promise.all(promises);
      setLaunchedJobs(jobIds);
      setSuccess(true);
      
      // Show message about parallel processing if multiple jobs
      const totalJobs = jobIds.length;
      if (totalJobs > 1) {
        console.log(`✅ ${totalJobs} jobs created and will process in parallel`);
      }
      
      // Redirect to infrastructure page after 2 seconds
      setTimeout(() => {
        router.push(`/infrastructure/${selectedInfra}`);
      }, 2000);
    } catch (err: any) {
      const msg = err.message || 'Failed to launch analysis';
      if (msg === 'UNAUTHORIZED') {
        router.push('/auth/login');
      } else {
        setError(msg);
      }
    } finally {
      setIsLaunching(false);
    }
  };

  const addSpecificDate = () => {
    if (specificDates.length < 5) {
      setSpecificDates([...specificDates, '']);
    }
  };

  const removeSpecificDate = (index: number) => {
    if (specificDates.length > 2) {
      setSpecificDates(specificDates.filter((_, i) => i !== index));
    }
  };

  const updateSpecificDate = (index: number, value: string) => {
    const updated = [...specificDates];
    updated[index] = value;
    setSpecificDates(updated);
  };

  const selectedInfraName = infrastructures.find(i => i.id === selectedInfra)?.name || '';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="h-10 w-10 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-neutral-600" />
        </button>
        <div>
          <h1 className="text-3xl font-semibold text-neutral-900">Create Monitoring Analysis</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Launch automated satellite monitoring for your infrastructure
          </p>
        </div>
      </div>

      {/* Main Form */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-8 space-y-6">
          {/* Infrastructure Selection */}
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              Infrastructure
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              {isLoadingInfras ? (
                <div className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center gap-2">
                  <Loader className="h-4 w-4 animate-spin text-neutral-400" />
                  <span className="text-sm text-neutral-500">Loading infrastructures...</span>
                </div>
              ) : (
                <select
                  value={selectedInfra}
                  onChange={(e) => setSelectedInfra(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent appearance-none"
                >
                  {infrastructures.length === 0 ? (
                    <option value="">No infrastructure available</option>
                  ) : (
                    infrastructures.map((infra) => (
                      <option key={infra.id} value={infra.id}>
                        {infra.name} {infra.type ? `(${infra.type})` : ''}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
            {infrastructures.length === 0 && !isLoadingInfras && (
              <p className="text-xs text-neutral-500 mt-2">
                No infrastructures found. <a href="/onboarding" className="text-neutral-900 hover:underline">Create one</a>
              </p>
            )}
          </div>

          {/* Mode Selection */}
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-3">
              Selection Mode
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setMode('range')}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  mode === 'range'
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                Date Range
              </button>
              <button
                type="button"
                onClick={() => setMode('target')}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  mode === 'target'
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                Target Date
              </button>
              <button
                type="button"
                onClick={() => setMode('specific')}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  mode === 'specific'
                    ? 'border-neutral-900 bg-neutral-900 text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                Specific Dates
              </button>
            </div>
          </div>

          {/* Mode: Date Range */}
          {mode === 'range' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 mb-2">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      max={endDate}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 mb-2">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Number of Analyses
                </label>
                <div className="relative">
                  <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={analysisCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setAnalysisCount(Math.max(1, Math.min(10, val)));
                    }}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-neutral-500 mt-1.5">
                  Multiple analyses will be scheduled automatically across the selected period
                </p>
              </div>
            </>
          )}

          {/* Mode: Target Date */}
          {mode === 'target' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Target Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-neutral-500 mt-1.5">
                  System will find the {imageCount} closest satellite images to this date
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Number of Images
                </label>
                <div className="relative">
                  <Activity className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="number"
                    min={2}
                    max={5}
                    value={imageCount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 3;
                      setImageCount(Math.max(2, Math.min(5, val)));
                    }}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-neutral-500 mt-1.5">
                  Number of satellite images to find (2-5). First image will be used as reference.
                </p>
              </div>
            </>
          )}

          {/* Mode: Specific Dates */}
          {mode === 'specific' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Specific Dates
                </label>
                <div className="space-y-3">
                  {specificDates.map((date, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="relative flex-1">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                        <input
                          type="date"
                          value={date}
                          onChange={(e) => updateSpecificDate(index, e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          className="w-full pl-10 pr-4 py-3 rounded-lg border border-neutral-200 bg-white text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                          placeholder="Select date"
                        />
                      </div>
                      {specificDates.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeSpecificDate(index)}
                          className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {specificDates.length < 5 && (
                    <button
                      type="button"
                      onClick={addSpecificDate}
                      className="w-full px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors"
                    >
                      + Add Another Date
                    </button>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-1.5">
                  System will find the closest satellite image for each date (minimum 2 dates required)
                </p>
              </div>
            </>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-blue-900 mb-1">How it works</div>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Satellite data is automatically retrieved from Sentinel-1</li>
                  <li>• Analysis typically completes in 3-5 minutes</li>
                  <li>• Results are automatically processed and stored</li>
                  <li>• You'll receive notifications when analysis is complete</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-red-900">Error</div>
                <div className="text-sm text-red-700 mt-0.5">{error}</div>
              </div>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-green-900">Analysis Launched</div>
                <div className="text-sm text-green-700 mt-0.5">
                  {launchedJobs.length} job{launchedJobs.length > 1 ? 's' : ''} created successfully.
                  {launchedJobs.length > 1 && ' Jobs will process in parallel (up to 5 simultaneously).'}
                  {' Redirecting...'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3">
          <button
            onClick={() => router.back()}
            disabled={isLaunching}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            disabled={
              isLaunching || 
              !selectedInfra || 
              success || 
              infrastructures.length === 0 ||
              (mode === 'range' && (!startDate || !endDate)) ||
              (mode === 'target' && !targetDate) ||
              (mode === 'specific' && specificDates.filter(d => d).length < 2)
            }
            className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {isLaunching ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Launch Analysis
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

