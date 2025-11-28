/**
 * MapFilters Component - BILLION-DOLLAR LEVEL
 * Advanced filtering system for map visualization
 * 
 * Features:
 * - Risk level filtering
 * - Displacement range filtering
 * - View mode switching (Points/Heatmap/Clusters)
 * - Smooth animations
 * - Real-time updates
 */

'use client';

import { useState } from 'react';
import { Layers, Filter, Eye, EyeOff } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface MapFilterState {
  riskLevels: Set<string>;
  displacementRange: [number, number];
  viewMode: 'points' | 'heatmap' | 'clusters';
  showLabels: boolean;
  minCoherence?: number | null;
}

interface MapFiltersProps {
  onFilterChange: (filters: MapFilterState) => void;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RISK_LEVELS = [
  { key: 'critical', label: 'Critique', color: '#DC2626' },
  { key: 'high', label: 'Élevé', color: '#EA580C' },
  { key: 'medium', label: 'Moyen', color: '#F59E0B' },
  { key: 'low', label: 'Faible', color: '#EAB308' },
  { key: 'stable', label: 'Stable', color: '#22C55E' },
] as const;

const VIEW_MODES = [
  { key: 'points', label: 'Points', icon: '⚫' },
  { key: 'heatmap', label: 'Heatmap', icon: '🔥' },
  { key: 'clusters', label: 'Clusters', icon: '🔵' },
] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export function MapFilters({ onFilterChange, className = '' }: MapFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filters, setFilters] = useState<MapFilterState>({
    riskLevels: new Set(['critical', 'high', 'medium', 'low', 'stable']),
    displacementRange: [-100, 100],
    viewMode: 'points',
    showLabels: false,
    minCoherence: 0.3,
  });

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const toggleRiskLevel = (level: string) => {
    const newRiskLevels = new Set(filters.riskLevels);
    if (newRiskLevels.has(level)) {
      newRiskLevels.delete(level);
    } else {
      newRiskLevels.add(level);
    }

    const newFilters = { ...filters, riskLevels: newRiskLevels };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const setViewMode = (mode: 'points' | 'heatmap' | 'clusters') => {
    const newFilters = { ...filters, viewMode: mode };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleLabels = () => {
    const newFilters = { ...filters, showLabels: !filters.showLabels };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const setMinCoherence = (value: number) => {
    const newFilters = { ...filters, minCoherence: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const selectAllRiskLevels = () => {
    const newFilters = {
      ...filters,
      riskLevels: new Set(['critical', 'high', 'medium', 'low', 'stable']),
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearAllRiskLevels = () => {
    const newFilters = { ...filters, riskLevels: new Set<string>() };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className={`bg-white rounded-xl shadow-2xl border-2 border-gray-200 overflow-hidden transition-all duration-300 ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-700" />
          <h3 className="text-sm font-bold text-gray-900">Filtres & Affichage</h3>
        </div>
        <button className="text-gray-500 hover:text-gray-700 transition-colors">
          <svg
            className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div
        className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="p-4 space-y-4">
          {/* View Mode */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                Mode d'affichage
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => setViewMode(mode.key as any)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${filters.viewMode === mode.key
                      ? 'bg-gradient-to-b from-gray-800 to-black text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-102'
                    }`}
                >
                  <span className="mr-1.5">{mode.icon}</span>
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Risk Levels */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-gray-900 uppercase tracking-wide">
                Niveaux de risque
              </label>
              <div className="flex gap-1">
                <button
                  onClick={selectAllRiskLevels}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Tout
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={clearAllRiskLevels}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Aucun
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {RISK_LEVELS.map((level) => {
                const isActive = filters.riskLevels.has(level.key);
                return (
                  <button
                    key={level.key}
                    onClick={() => toggleRiskLevel(level.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${isActive
                        ? 'bg-gray-50 border-2 border-gray-300 shadow-sm'
                        : 'bg-white border-2 border-gray-200 hover:border-gray-300 opacity-50'
                      }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 border-white shadow-md transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'
                        }`}
                      style={{ backgroundColor: level.color }}
                    />
                    <span className="text-sm font-semibold text-gray-900 flex-1 text-left">
                      {level.label}
                    </span>
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${isActive
                          ? 'bg-blue-600 border-blue-600'
                          : 'bg-white border-gray-300'
                        }`}
                    >
                      {isActive && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Options */}
          <div>
            <label className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3 block">
              Options
            </label>
            <button
              onClick={toggleLabels}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 ${filters.showLabels
                  ? 'bg-gray-50 border-2 border-gray-300 shadow-sm'
                  : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center gap-2">
                {filters.showLabels ? (
                  <Eye className="w-4 h-4 text-blue-600" />
                ) : (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-sm font-semibold text-gray-900">
                  Afficher les labels
                </span>
              </div>
              <div
                className={`w-11 h-6 rounded-full transition-all duration-200 ${filters.showLabels ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 mt-0.5 ${filters.showLabels ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                />
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Coherence filter */}
          <div>
            <label className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3 block">
              Qualité (cohérence minimale)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={filters.minCoherence ?? 0}
                onChange={(e) => setMinCoherence(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-xs font-semibold text-gray-700 w-10 text-right">
                {(filters.minCoherence ?? 0).toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">0.00 = tout afficher, 1.00 = seulement haute qualité</p>
          </div>

          {/* Active Filters Count */}
          <div className="pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Filtres actifs</span>
              <span className="font-bold text-gray-900">
                {filters.riskLevels.size} / {RISK_LEVELS.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
