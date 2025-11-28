'use client';

import { useInfrastructures } from '@/hooks/useInfrastructures';
import { useGlobalStats, useGlobalTimeSeries, useCriticalInfrastructures } from '@/hooks/useGlobalStats';
import { useInfrastructureStats } from '@/hooks/useInfrastructureStats';
import PageHeader from '@/components/Shell/PageHeader';
import StatCard from '@/components/KPI/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import OnboardingModal from '@/components/Onboarding/OnboardingModal';
import { Loader, AlertCircle } from 'lucide-react';

interface Infrastructure {
  id: string;
  name: string;
}

interface CriticalInfra { 
  name: string; 
  risk: 'Critical' | 'High' | 'Medium' | 'Low'; 
  latestDisp: string; 
  velocity: string; 
}

export default function DashboardPage() {
  const { data, isLoading: isLoadingInfras, error: errorInfras } = useInfrastructures();
  const infrastructures: Infrastructure[] = (data as any) || [];
  const { data: globalStats, isLoading: isLoadingStats, error: errorStats } = useGlobalStats();
  const { data: timeSeriesData, isLoading: isLoadingTimeSeries } = useGlobalTimeSeries();
  const { data: criticalInfrasData, isLoading: isLoadingCritical } = useCriticalInfrastructures();
  const { data: infraStats, isLoading: isLoadingInfraStats } = useInfrastructureStats();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const isOnboarding = searchParams?.get('onboarding') === '1';
    if (isOnboarding) setShowOnboarding(true);
  }, [searchParams]);

  const closeOnboarding = () => {
    setShowOnboarding(false);
    // remove query param without full reload
    const url = new URL(window.location.href);
    url.searchParams.delete('onboarding');
    router.replace(url.pathname + (url.search ? `?${url.searchParams.toString()}` : ''));
  };

  // Real KPIs from global stats - only show if there's real data
  const kpis = useMemo(() => {
    const hasRealData = globalStats && globalStats.activePoints > 0;
    return {
      infrastructures: globalStats?.totalInfrastructures || infrastructures.length,
      maxDeformationMm: hasRealData && globalStats.maxDeformationMm !== null && globalStats.maxDeformationMm !== 0 
        ? globalStats.maxDeformationMm 
        : null,
      avgCoherence: hasRealData && globalStats.avgCoherence !== null 
        ? globalStats.avgCoherence 
        : null,
      runningJobs: globalStats?.activeJobs || 0,
    };
  }, [globalStats, infrastructures.length]);

  // Real time series data
  const series = useMemo(() => {
    if (!timeSeriesData?.timeSeries || timeSeriesData.timeSeries.length === 0) {
      return [];
    }
    return timeSeriesData.timeSeries.map((ts, i) => ({
      t: new Date(ts.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      avg: ts.avgDisplacement ?? 0,
      max: ts.maxDisplacement ?? 0,
    }));
  }, [timeSeriesData]);


  // Real alert distribution from risk distribution
  const alertDistribution = useMemo(() => {
    if (!globalStats?.riskDistribution) {
      return [];
    }
    const dist = globalStats.riskDistribution;
    return [
      { name: 'Critical', value: dist.critical, color: '#ef4444' },
      { name: 'High', value: dist.high, color: '#f59e0b' },
      { name: 'Medium', value: dist.medium, color: '#eab308' },
      { name: 'Low', value: dist.low, color: '#22c55e' },
      { name: 'Stable', value: dist.stable, color: '#10b981' },
    ].filter(item => item.value > 0);
  }, [globalStats]);

  // Real data quality metrics
  const dataQuality = useMemo(() => {
    if (!globalStats) return [];
    const activePercent = globalStats.totalPoints > 0 
      ? Math.round((globalStats.activePoints / globalStats.totalPoints) * 100) 
      : 0;
    return [
      { 
        label: 'Active points', 
        value: `${activePercent}%`, 
        hint: `${globalStats.activePoints.toLocaleString()} of ${globalStats.totalPoints.toLocaleString()}` 
      },
      { 
        label: 'Avg coherence', 
        value: globalStats.avgCoherence !== null ? globalStats.avgCoherence.toFixed(2) : 'N/A', 
        hint: 'across all points' 
      },
      { 
        label: 'Total points', 
        value: globalStats.totalPoints.toLocaleString(), 
        hint: 'monitoring points' 
      },
      { 
        label: 'Infrastructures', 
        value: globalStats.totalInfrastructures.toLocaleString(), 
        hint: 'monitored sites' 
      },
    ];
  }, [globalStats]);

  // Use time series for throughput chart (jobs per period)
  const throughput = useMemo(() => {
    if (!timeSeriesData?.timeSeries || timeSeriesData.timeSeries.length === 0) {
      return [];
    }
    return timeSeriesData.timeSeries.map((ts, i) => ({
      t: new Date(ts.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      measurements: ts.count,
    }));
  }, [timeSeriesData]);

  // Real critical infrastructures
  const criticalInfras: CriticalInfra[] = useMemo(() => {
    if (!criticalInfrasData || criticalInfrasData.length === 0) {
      return [];
    }
    return criticalInfrasData.map(infra => ({
      name: infra.name,
      risk: infra.risk.charAt(0).toUpperCase() + infra.risk.slice(1) as 'Critical' | 'High' | 'Medium' | 'Low',
      latestDisp: infra.latestDisplacement !== null ? `${infra.latestDisplacement.toFixed(1)} mm` : 'No data',
      velocity: infra.velocity !== null ? `${infra.velocity.toFixed(1)} mm/yr` : 'No data',
    }));
  }, [criticalInfrasData]);


  return (
    <div className="max-w-7xl mx-auto">
      <OnboardingModal open={showOnboarding} onClose={closeOnboarding} />
      <PageHeader title="Dashboard" subtitle="Operations overview and recent activity" />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Max deformation" 
          value={kpis.maxDeformationMm !== null ? `${kpis.maxDeformationMm.toFixed(1)} mm` : 'No data'} 
          highlight 
        />
        <StatCard 
          title="Avg coherence" 
          value={kpis.avgCoherence !== null ? `${Math.round(kpis.avgCoherence * 100)}%` : 'No data'} 
        />
        <StatCard title="Infrastructures" value={kpis.infrastructures.toLocaleString()} />
        <StatCard title="Running jobs" value={kpis.runningJobs} />
      </div>

      {/* Main charts + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Time series */}
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-neutral-700">Evolution (Displacements / Mm)</div>
              <div className="text-xs text-neutral-500">Last 12 measurement periods</div>
            </div>
            <div className="h-64">
              {isLoadingTimeSeries ? (
                <div className="h-full flex items-center justify-center">
                  <Loader className="h-6 w-6 animate-spin text-neutral-400" />
                </div>
              ) : series.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">No data available</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="t" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" label={{ value: 'mm', angle: -90, position: 'insideLeft' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }} />
                    <Line type="monotone" dataKey="avg" stroke="#111111" strokeWidth={2} dot={{ r: 2 }} name="Avg Displacement" />
                    <Line type="monotone" dataKey="max" stroke="#6b7280" strokeWidth={2} dot={{ r: 2 }} name="Max Displacement" />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Latest alerts */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-neutral-700">Latest alerts</div>
              <button className="text-xs font-medium text-neutral-500 hover:text-neutral-900">View all</button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No alerts</p>
                  <p className="text-xs text-neutral-400 mt-1">Alert system coming soon</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs and alerts distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Critical Infrastructures */}
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-neutral-700">Critical infrastructures</div>
              <button className="text-xs font-medium text-neutral-500 hover:text-neutral-900">View all</button>
            </div>
            <div className="text-xs text-neutral-500 grid grid-cols-[2fr,1fr,1fr,1fr] px-3 py-2">
              <div>Name</div>
              <div className="text-right">Risk</div>
              <div className="text-right">Latest disp.</div>
              <div className="text-right">Velocity</div>
            </div>
            {isLoadingCritical ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="h-6 w-6 animate-spin text-neutral-400" />
              </div>
            ) : criticalInfras.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No data available</p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {criticalInfras.map((c) => (
                  <div key={c.name} className="grid grid-cols-[2fr,1fr,1fr,1fr] items-center px-3 py-2 text-sm">
                    <div className="text-neutral-900">{c.name}</div>
                    <div className="text-right">
                      <span className={
                        "px-2 py-1 rounded-full text-xs font-medium " +
                        (c.risk === 'Critical' ? 'bg-red-100 text-red-800' : c.risk === 'High' ? 'bg-orange-100 text-orange-800' : c.risk === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800')
                      }>
                        {c.risk}
                      </span>
                    </div>
                    <div className="text-right text-neutral-900">{c.latestDisp}</div>
                    <div className="text-right text-neutral-900">{c.velocity}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alert Levels distribution */}
        <Card>
          <CardContent>
            <div className="text-sm font-semibold text-neutral-700 mb-3">Alert levels</div>
            <div className="h-64">
              {isLoadingStats ? (
                <div className="h-full flex items-center justify-center">
                  <Loader className="h-6 w-6 animate-spin text-neutral-400" />
                </div>
              ) : alertDistribution.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">No data available</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={alertDistribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                      {alertDistribution.map((e, i) => (
                        <Cell key={`c-${i}`} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data quality and activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="text-sm font-semibold text-neutral-700 mb-3">Data quality</div>
            {isLoadingStats ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="h-6 w-6 animate-spin text-neutral-400" />
              </div>
            ) : dataQuality.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No data available</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {dataQuality.map((q, i) => (
                  <div key={i} className="p-4 rounded-lg border border-neutral-200">
                    <div className="text-xs text-neutral-500 mb-1">{q.label}</div>
                    <div className="text-xl font-semibold text-neutral-900">{q.value}</div>
                    <div className="text-xs text-neutral-500 mt-1">{q.hint}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="text-sm font-semibold text-neutral-700 mb-3">Activity</div>
            <div className="divide-y">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No activity data</p>
                  <p className="text-xs text-neutral-400 mt-1">Activity feed coming soon</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monitoring coverage and scheduled reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-neutral-700">Monitoring coverage</div>
              <div className="text-xs text-neutral-500">km² per period</div>
            </div>
            <div className="h-56">
              {isLoadingTimeSeries ? (
                <div className="h-full flex items-center justify-center">
                  <Loader className="h-6 w-6 animate-spin text-neutral-400" />
                </div>
              ) : throughput.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">No data available</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={throughput}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="t" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" label={{ value: 'Measurements', angle: -90, position: 'insideLeft' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' }} />
                    <Bar dataKey="measurements" fill="#111111" radius={[4, 4, 0, 0]} name="Measurements" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="text-sm font-semibold text-neutral-700 mb-3">Scheduled reports</div>
            <div className="divide-y text-sm">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No scheduled reports</p>
                  <p className="text-xs text-neutral-400 mt-1">Schedule reports coming soon</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary grids: infrastructures & insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Infrastructures overview */}
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-neutral-700">Infrastructures overview</div>
              <button className="text-xs font-medium text-neutral-500 hover:text-neutral-900">Go to list</button>
            </div>
            {infrastructures.length === 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-neutral-200 px-4 py-6">
                <div>
                  <div className="text-sm font-medium text-neutral-900">No infrastructures yet</div>
                  <div className="mt-1 text-xs text-neutral-500">Use the onboarding flow to create your first monitoring project.</div>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-black text-white">Onboarding</span>
              </div>
            ) : (
              isLoadingInfraStats ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="h-6 w-6 animate-spin text-neutral-400" />
                </div>
              ) : !infraStats || infraStats.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">No infrastructure data</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-[2fr,1fr,1fr] text-xs text-neutral-500 mb-1">
                    <div>Name</div>
                    <div className="text-right">Area</div>
                    <div className="text-right">Points</div>
                  </div>
                  {infraStats.slice(0, 5).map((infra) => (
                    <div key={infra.id} className="grid grid-cols-[2fr,1fr,1fr] items-center rounded-lg border border-neutral-200 px-3 py-2">
                      <div className="truncate text-neutral-900 text-sm">{infra.name}</div>
                      <div className="text-right text-xs text-neutral-500">
                        {infra.areaKm2 !== undefined ? `${infra.areaKm2.toFixed(1)} km²` : '—'}
                      </div>
                      <div className="text-right text-xs text-neutral-500">
                        {infra.totalPoints > 0 ? infra.totalPoints.toLocaleString() : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Insights (user-facing) */}
        <Card>
          <CardContent>
            <div className="text-sm font-semibold text-neutral-700 mb-3">Insights</div>
            <div className="divide-y">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No insights available</p>
                  <p className="text-xs text-neutral-400 mt-1">Complete analyses to generate insights</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
