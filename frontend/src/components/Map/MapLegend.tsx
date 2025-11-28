/**
 * MapLegend Component
 * Professional legend for risk levels and map controls
 */

'use client';

import type { MapDataResponse } from '@/types/api';

// ============================================================================
// TYPES
// ============================================================================

interface MapLegendProps {
  data: MapDataResponse;
  className?: string;
}

// ============================================================================
// RISK LEVELS
// ============================================================================

const RISK_LEVELS = [
  { key: 'critical', label: 'Critique', color: '#DC2626', description: '< -20mm' },
  { key: 'high', label: 'Élevé', color: '#EA580C', description: '-10 à -20mm' },
  { key: 'medium', label: 'Moyen', color: '#F59E0B', description: '-5 à -10mm' },
  { key: 'low', label: 'Faible', color: '#EAB308', description: '-2 à -5mm' },
  { key: 'stable', label: 'Stable', color: '#22C55E', description: '> -2mm' },
] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export function MapLegend({ data, className = '' }: MapLegendProps) {
  const { metadata } = data;

  return (
    <div className={`bg-white rounded-lg shadow-lg p-4 ${className}`}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">
          Niveau de risque
        </h3>
        <p className="text-xs text-gray-500">
          Basé sur le déplacement vertical
        </p>
      </div>

      {/* Risk Levels */}
      <div className="space-y-2 mb-4">
        {RISK_LEVELS.map((level) => {
          const count = metadata.riskDistribution?.[level.key as keyof typeof metadata.riskDistribution] || 0;

          return (
            <div key={level.key} className="flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-1">
                <div
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: level.color }}
                />
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-700">
                    {level.label}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {level.description}
                  </div>
                </div>
              </div>
              <div className="text-xs font-semibold text-gray-900 ml-2">
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 my-3" />

      {/* Statistics */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-600">Points totaux</span>
          <span className="text-xs font-semibold text-gray-900">
            {metadata.totalPoints}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-600">Points actifs</span>
          <span className="text-xs font-semibold text-gray-900">
            {metadata.activePoints}
          </span>
        </div>
        {metadata.statistics?.averageDisplacement !== undefined && metadata.statistics.averageDisplacement !== null && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Dépl. moyen</span>
            <span className="text-xs font-semibold text-gray-900">
              {metadata.statistics.averageDisplacement.toFixed(2)} mm
            </span>
          </div>
        )}
        {metadata.statistics?.maxDisplacement !== undefined && metadata.statistics.maxDisplacement !== null && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Dépl. max</span>
            <span className="text-xs font-semibold text-gray-900">
              {metadata.statistics.maxDisplacement.toFixed(2)} mm
            </span>
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-[10px] text-gray-400">
          Mis à jour: {metadata.dateRange.latest ? new Date(metadata.dateRange.latest).toLocaleString('fr-FR') : 'N/A'}
        </p>
      </div>
    </div>
  );
}
