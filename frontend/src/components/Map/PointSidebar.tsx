/**
 * Point Sidebar - Enterprise-Grade Professional Design
 * Ultra-clean, minimal, professional UI
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { MapDataPoint } from '@/types/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { X, TrendingUp, TrendingDown, Minus, Calendar, MapPin, Activity, AlertCircle, Download, ExternalLink } from 'lucide-react';
import { supabase as importedSupabase } from '../../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

// Cast supabase to proper type
const supabase = importedSupabase as SupabaseClient;

interface PointSidebarProps {
  point: MapDataPoint | null;
  onClose: () => void;
  infrastructureId?: string;
}

export function PointSidebar({ point, onClose, infrastructureId }: PointSidebarProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const [series, setSeries] = useState<Array<{ date: string; value: number | null; coherence: number | null }>>([]);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Extract data safely with proper typing
  const properties = point?.properties ?? {
    pointId: '',
    latestDisplacement: null,
    latestVelocity: null,
    latestCoherence: null,
    measurementCount: 0,
    latestDate: null,
    color: '#999',
    riskLevel: 'unknown' as const,
    trend: 'unknown' as const,
  };
  const displacement = properties.latestDisplacement ?? 0;
  const velocity = properties.latestVelocity ?? 0;
  const coherence = properties.latestCoherence ?? 0;
  const lastUpdate = properties.latestDate ? new Date(properties.latestDate) : new Date();
  const riskLevel = properties.riskLevel ?? 'unknown';
  const trend = properties.trend ?? 'unknown';

  // Fetch time-series
  useEffect(() => {
    if (!point?.properties?.pointId) {
      setSeries([]);
      return;
    }

    let cancelled = false;
    setIsLoadingSeries(true);

    async function fetchSeries(pointId: string) {
      try {
        // Get Supabase access token (same method as other components)
        const getSupabaseAccessToken = async (): Promise<string | null> => {
          try {
            const { data } = await supabase.auth.getSession();
            const token = (data?.session as { access_token?: string })?.access_token;
            if (token && token.length > 5000) return null; // corrupted guard
            return token ?? null;
          } catch {
            return null;
          }
        };

        let token = await getSupabaseAccessToken();
        if (!token) {
          try { await supabase.auth.refreshSession(); } catch { /* ignore */ }
          token = await getSupabaseAccessToken();
        }
        if (!token) {
          token = localStorage.getItem('token') || null;
        }
        if (!token) {
          console.error('[PointSidebar] No token available');
          if (!cancelled) setSeries([]);
          return;
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
        const url = `${process.env.NEXT_PUBLIC_API_URL}/deformations/time-series/${pointId}`;
        console.log('[PointSidebar] Fetching time series:', url);
        const res = await fetch(url, { headers });
        console.log('[PointSidebar] Response status:', res.status, res.statusText);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[PointSidebar] Error response:', errorText);
          if (!cancelled) setSeries([]);
          return;
        }
        const json = await res.json();
        console.log('[PointSidebar] Received data:', json);
        let data = (json.timeSeries || []).map((d: any) => ({
          date: d.date,
          dateObj: new Date(d.date), // Keep Date object for sorting
          value: typeof d.displacement_mm === 'number' ? d.displacement_mm : (d.displacement_mm !== null ? Number(d.displacement_mm) : null),
          coherence: d.coherence ?? null,
        }));

        // Define type for entries
        type TimeSeriesEntry = { date: string; dateObj: Date; value: number | null; coherence: number | null };

        // Sort by date to ensure correct chronological order
        (data as TimeSeriesEntry[]).sort((a, b) => {
          const timeA = a.dateObj.getTime();
          const timeB = b.dateObj.getTime();
          console.log(`[PointSidebar] Sorting: ${a.date} (${timeA}) vs ${b.date} (${timeB})`);
          return timeA - timeB;
        });

        // Remove dateObj before setting state
        const cleanedData = (data as TimeSeriesEntry[]).map(({ dateObj, ...rest }) => rest);
        console.log('[PointSidebar] Formatted data (sorted):', cleanedData);
        if (!cancelled) setSeries(cleanedData);
      } catch (error) {
        console.error('[PointSidebar] Fetch error:', error);
        if (!cancelled) setSeries([]);
      } finally {
        if (!cancelled) setIsLoadingSeries(false);
      }
    }
    fetchSeries(point.properties.pointId);
    return () => { cancelled = true; };
  }, [point?.properties?.pointId]);

  // Sort chart data by date to ensure correct chronological order
  // IMPORTANT: Use index for X-axis to preserve order, display dates as labels
  const chartData = useMemo(() => {
    const mapped = series
      .map(d => {
        const dateObj = new Date(d.date);
        if (isNaN(dateObj.getTime())) {
          console.warn('[PointSidebar] Invalid date:', d.date);
          return null;
        }
        return {
          date: d.date, // Keep original date string for sorting
          dateObj: dateObj,
          value: d.value !== null && Number.isFinite(d.value) ? Number(d.value.toFixed(2)) : 0,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    // Sort by actual date timestamp, not by formatted string
    mapped.sort((a, b) => {
      const timeA = a.dateObj.getTime();
      const timeB = b.dateObj.getTime();
      return timeA - timeB; // Ascending: oldest first
    });

    // Map to chart format - use date string as key but keep chronological order
    // Recharts will use the data array order, so we ensure it's sorted correctly
    const formatted = mapped.map(({ dateObj, date: originalDate, value }) => {
      const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD for consistent sorting
      // Include year in display date to avoid confusion
      const displayDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return {
        date: dateStr, // Use ISO date string for consistent sorting
        displayDate, // Formatted date for display with year
        value,
        timestamp: dateObj.getTime(), // Keep timestamp for debugging
        _originalDate: originalDate, // Keep for debugging
      };
    });

    // Double-check sort by timestamp
    formatted.sort((a, b) => a.timestamp - b.timestamp);

    console.log('[PointSidebar] Chart data (final, sorted chronologically):', formatted.map(d => ({
      date: d.date,
      displayDate: d.displayDate,
      value: d.value
    })));
    return formatted;
  }, [series]);

  const riskConfig = {
    critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Critical' },
    high: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'High' },
    medium: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Medium' },
    low: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Low' },
    stable: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Stable' },
    unknown: { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', label: 'Unknown' },
  };

  const TrendIcon = trend === 'accelerating' ? TrendingUp : trend === 'decelerating' ? TrendingDown : Minus;
  const trendColor = trend === 'accelerating' ? 'text-red-600' : trend === 'decelerating' ? 'text-green-600' : 'text-gray-600';

  if (!point || !mounted) {
    return null;
  }

  const portalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[9998]"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-white shadow-2xl z-[9999] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-neutral-900 truncate">
              {point.properties.pointId || 'Point Details'}
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              Monitoring Point
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 h-8 w-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-neutral-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-100">
                <div className="text-xs font-medium text-neutral-500 mb-1">Displacement</div>
                <div className="text-xl font-semibold text-neutral-900">
                  {displacement.toFixed(1)} <span className="text-sm font-normal text-neutral-500">mm</span>
                </div>
              </div>
              <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-100">
                <div className="text-xs font-medium text-neutral-500 mb-1">Velocity</div>
                <div className="text-xl font-semibold text-neutral-900">
                  {velocity.toFixed(1)} <span className="text-sm font-normal text-neutral-500">mm/yr</span>
                </div>
              </div>
              <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-100">
                <div className="text-xs font-medium text-neutral-500 mb-1">Coherence</div>
                <div className="text-xl font-semibold text-neutral-900">
                  {(coherence * 100).toFixed(0)}<span className="text-sm font-normal text-neutral-500">%</span>
                </div>
              </div>
            </div>

            {/* Risk & Trend */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-lg p-4 border ${riskConfig[riskLevel as keyof typeof riskConfig]?.border || riskConfig.unknown.border} ${riskConfig[riskLevel as keyof typeof riskConfig]?.bg || riskConfig.unknown.bg}`}>
                <div className="text-xs font-medium text-neutral-600 mb-1">Risk Level</div>
                <div className={`text-base font-semibold ${riskConfig[riskLevel as keyof typeof riskConfig]?.color || riskConfig.unknown.color}`}>
                  {riskConfig[riskLevel as keyof typeof riskConfig]?.label || 'Unknown'}
                </div>
              </div>
              <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-100">
                <div className="text-xs font-medium text-neutral-600 mb-1">Trend</div>
                <div className={`text-base font-semibold flex items-center gap-1.5 ${trendColor}`}>
                  <TrendIcon className="h-4 w-4" />
                  <span className="capitalize">{trend}</span>
                </div>
              </div>
            </div>

            {/* Time Series Chart */}
            <div className="bg-white rounded-lg border border-neutral-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-900">Deformation History</h3>
                <button className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  Export
                </button>
              </div>
              <div ref={chartRef} className="h-64">
                {isLoadingSeries ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-sm text-neutral-500">Loading data...</div>
                  </div>
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    // Ensure data is not re-sorted by Recharts
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="date"
                        type="category"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={(dateStr) => {
                          const item = chartData.find(d => d.date === dateStr);
                          return item ? item.displayDate : dateStr;
                        }}
                        // Don't let Recharts reorder
                        allowDuplicatedCategory={false}
                      />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                        labelFormatter={(dateStr) => {
                          const item = chartData.find(d => d.date === dateStr);
                          return item ? item.displayDate : dateStr;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#111827"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        // Connect points in data order
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-sm text-neutral-500">No data available</div>
                  </div>
                )}
              </div>
            </div>

            {/* Location Info */}
            <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-100">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-neutral-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-neutral-500 mb-2">Coordinates</div>
                  <div className="text-sm text-neutral-900 font-mono space-y-1">
                    <div>Lat: {point.geometry.coordinates[1].toFixed(6)}</div>
                    <div>Lon: {point.geometry.coordinates[0].toFixed(6)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Last Update</span>
                <span className="text-neutral-900 font-medium">
                  {lastUpdate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Measurements</span>
                <span className="text-neutral-900 font-medium">{properties.measurementCount || series.length}</span>
              </div>
            </div>

            {/* Actions */}
            {infrastructureId && (
              <div className="pt-4 border-t border-neutral-100">
                <button
                  onClick={() => router.push(`/infrastructure/${infrastructureId}/3d`)}
                  className="w-full px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  View in 3D
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(portalContent, document.body);
}
