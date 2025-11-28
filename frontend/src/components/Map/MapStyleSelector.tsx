/**
 * MapStyleSelector Component - BILLION-DOLLAR LEVEL
 * Advanced Mapbox style selector with 3D terrain, buildings, and premium styles
 * 
 * Features:
 * - 8+ premium Mapbox styles
 * - 3D terrain with exaggeration
 * - 3D buildings
 * - Smooth transitions
 * - Modern UI with previews
 */

'use client';

import { useState } from 'react';
import { Map, Layers } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface MapStyle {
  id: string;
  name: string;
  url: string;
  preview: string;
  description: string;
  category: 'satellite' | 'street' | 'dark' | 'terrain' | 'artistic';
}

export interface MapSettings {
  styleUrl: string;
  terrain3D: boolean;
  buildings3D: boolean;
  terrainExaggeration: number;
}

interface MapStyleSelectorProps {
  currentSettings: MapSettings;
  onSettingsChange: (settings: MapSettings) => void;
  className?: string;
}

// ============================================================================
// MAPBOX STYLES - PREMIUM COLLECTION
// ============================================================================

const MAPBOX_STYLES: MapStyle[] = [
  {
    id: 'satellite-streets',
    name: 'Satellite Streets',
    url: 'mapbox://styles/mapbox/satellite-streets-v12',
    preview: '🛰️',
    description: 'Satellite imagery with street labels',
    category: 'satellite',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    url: 'mapbox://styles/mapbox/satellite-v9',
    preview: '🌍',
    description: 'Pure satellite imagery',
    category: 'satellite',
  },
  {
    id: 'streets',
    name: 'Streets',
    url: 'mapbox://styles/mapbox/streets-v12',
    preview: '🗺️',
    description: 'Classic street map',
    category: 'street',
  },
  {
    id: 'outdoors',
    name: 'Outdoors',
    url: 'mapbox://styles/mapbox/outdoors-v12',
    preview: '🏔️',
    description: 'Topographic with terrain',
    category: 'terrain',
  },
  {
    id: 'light',
    name: 'Light',
    url: 'mapbox://styles/mapbox/light-v11',
    preview: '☀️',
    description: 'Minimalist light theme',
    category: 'street',
  },
  {
    id: 'dark',
    name: 'Dark',
    url: 'mapbox://styles/mapbox/dark-v11',
    preview: '🌙',
    description: 'Dark mode optimized',
    category: 'dark',
  },
  {
    id: 'navigation-day',
    name: 'Navigation Day',
    url: 'mapbox://styles/mapbox/navigation-day-v1',
    preview: '🚗',
    description: 'Optimized for navigation',
    category: 'street',
  },
  {
    id: 'navigation-night',
    name: 'Navigation Night',
    url: 'mapbox://styles/mapbox/navigation-night-v1',
    preview: '🌃',
    description: 'Night navigation mode',
    category: 'dark',
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function MapStyleSelector({
  currentSettings,
  onSettingsChange,
  className = '',
}: MapStyleSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const handleStyleChange = (styleUrl: string) => {
    onSettingsChange({ ...currentSettings, styleUrl });
  };

  const toggleTerrain3D = () => {
    onSettingsChange({ ...currentSettings, terrain3D: !currentSettings.terrain3D });
  };

  const toggleBuildings3D = () => {
    onSettingsChange({ ...currentSettings, buildings3D: !currentSettings.buildings3D });
  };

  const setTerrainExaggeration = (value: number) => {
    onSettingsChange({ ...currentSettings, terrainExaggeration: value });
  };

  const currentStyle = MAPBOX_STYLES.find(s => s.url === currentSettings.styleUrl) || MAPBOX_STYLES[0];

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className={`bg-white rounded-xl shadow-2xl border-2 border-gray-200 overflow-hidden transition-all duration-300 ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-white border-b border-gray-200 cursor-pointer hover:bg-blue-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-blue-700" />
          <div>
            <h3 className="text-sm font-bold text-gray-900">Style de Carte</h3>
            <p className="text-xs text-gray-600">{currentStyle.name}</p>
          </div>
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
        className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="p-4 space-y-4">
          {/* Map Styles Grid */}
          <div>
            <label className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3 block">
              Styles de Carte
            </label>
            <div className="grid grid-cols-2 gap-2">
              {MAPBOX_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleStyleChange(style.url)}
                  className={`p-3 rounded-lg text-left transition-all duration-200 ${currentSettings.styleUrl === style.url
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 hover:border-blue-300'
                    }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{style.preview}</span>
                    <span className={`text-xs font-bold ${currentSettings.styleUrl === style.url ? 'text-white' : 'text-gray-900'
                      }`}>
                      {style.name}
                    </span>
                  </div>
                  <p className={`text-[10px] ${currentSettings.styleUrl === style.url ? 'text-blue-100' : 'text-gray-600'
                    }`}>
                    {style.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* 3D Features */}
          <div>
            <label className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3 block">
              Fonctionnalités 3D
            </label>
            <div className="space-y-2">
              {/* 3D Terrain */}
              <button
                onClick={toggleTerrain3D}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 ${currentSettings.terrain3D
                    ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 shadow-sm'
                    : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏔️</span>
                  <div className="text-left">
                    <span className="text-sm font-semibold text-gray-900 block">
                      Terrain 3D
                    </span>
                    <span className="text-xs text-gray-600">
                      Relief et élévation
                    </span>
                  </div>
                </div>
                <div
                  className={`w-11 h-6 rounded-full transition-all duration-200 ${currentSettings.terrain3D ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 mt-0.5 ${currentSettings.terrain3D ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                  />
                </div>
              </button>

              {/* Terrain Exaggeration Slider */}
              {currentSettings.terrain3D && (
                <div className="pl-9 pr-3 py-2 bg-green-50 rounded-lg border border-green-200">
                  <label className="text-xs font-semibold text-gray-900 mb-2 block">
                    Exagération: {currentSettings.terrainExaggeration}x
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.5"
                    value={currentSettings.terrainExaggeration}
                    onChange={(e) => setTerrainExaggeration(parseFloat(e.target.value))}
                    className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                  />
                  <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                    <span>Subtil</span>
                    <span>Dramatique</span>
                  </div>
                </div>
              )}

              {/* 3D Buildings */}
              <button
                onClick={toggleBuildings3D}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 ${currentSettings.buildings3D
                    ? 'bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-purple-300 shadow-sm'
                    : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏢</span>
                  <div className="text-left">
                    <span className="text-sm font-semibold text-gray-900 block">
                      Bâtiments 3D
                    </span>
                    <span className="text-xs text-gray-600">
                      Extrusion des bâtiments
                    </span>
                  </div>
                </div>
                <div
                  className={`w-11 h-6 rounded-full transition-all duration-200 ${currentSettings.buildings3D ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 mt-0.5 ${currentSettings.buildings3D ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                  />
                </div>
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="pt-3 border-t border-gray-200 bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              💡 <strong>Astuce:</strong> Utilisez Ctrl + glisser pour incliner la carte en 3D
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
