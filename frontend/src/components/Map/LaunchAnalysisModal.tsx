/**
 * Launch Analysis Modal - Enterprise-Grade Professional Design
 * Ultra-clean interface for launching InSAR monitoring analyses
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, MapPin, Activity, Sparkles, Loader, CheckCircle2, AlertCircle } from 'lucide-react';

interface Infrastructure {
  id: string;
  name: string;
  type?: string;
}

interface LaunchAnalysisModalProps {
  open: boolean;
  onClose: () => void;
  infrastructures?: Infrastructure[];
  onLaunch: (data: {
    infrastructureId: string;
    startDate: string;
    endDate: string;
    analysisCount: number;
  }) => Promise<void>;
}

export function LaunchAnalysisModal({ open, onClose, infrastructures = [], onLaunch }: LaunchAnalysisModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedInfra, setSelectedInfra] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [analysisCount, setAnalysisCount] = useState(1);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Set default dates (last 30 days to today)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
    
    // Auto-select first infrastructure
    if (infrastructures.length > 0 && !selectedInfra) {
      setSelectedInfra(infrastructures[0].id);
    }
  }, [infrastructures, selectedInfra]);

  const handleLaunch = async () => {
    if (!selectedInfra || !startDate || !endDate || analysisCount < 1) {
      setError('Please fill all fields');
      return;
    }

    setIsLaunching(true);
    setError(null);
    setSuccess(false);

    try {
      await onLaunch({
        infrastructureId: selectedInfra,
        startDate,
        endDate,
        analysisCount,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setError(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to launch analysis');
    } finally {
      setIsLaunching(false);
    }
  };

  const selectedInfraName = infrastructures.find(i => i.id === selectedInfra)?.name || '';

  if (!open || !mounted) {
    return null;
  }

  const portalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px] max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900">Launch Monitoring Analysis</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Start automated satellite monitoring for your infrastructure
                </p>
              </div>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4 text-neutral-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
            {/* Infrastructure Selection */}
            <div>
              <label className="block text-sm font-semibold text-neutral-900 mb-2">
                Infrastructure
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
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
              </div>
            </div>

            {/* Date Range */}
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

            {/* Analysis Count */}
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
                    Monitoring analysis has been started successfully
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isLaunching}
              className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleLaunch}
              disabled={isLaunching || !selectedInfra || !startDate || !endDate || success}
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
    </>
  );

  return createPortal(portalContent, document.body);
}

