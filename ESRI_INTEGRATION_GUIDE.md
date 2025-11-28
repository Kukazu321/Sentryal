# Esri World Imagery Integration - Guide d'implémentation détaillé

## 🎯 Étapes d'implémentation complètes

### Phase 1 : Setup compte et API (30 min)

#### 1.1 Créer compte ArcGIS Location Platform
1. **Aller sur** : https://location.arcgis.com/sign-up/
2. **Remplir le formulaire** :
   - Email : ton email principal
   - Organization name : "Sentryal"
   - Industry : "Engineering & Architecture" ou "Government"
   - Use case : "Web mapping application"
3. **Vérifier email** et activer le compte
4. **Se connecter** : https://location.arcgis.com/

#### 1.2 Générer API Key
1. **Dashboard** → **API keys** (menu gauche)
2. **Create API key**
3. **Paramètres** :
   - Name : `sentryal-basemaps-prod`
   - Description : `Basemap tiles for Sentryal production`
   - Scopes : Cocher **"Basemap"** uniquement
   - Referrers : Ajouter tes domaines :
     - `localhost:3000` (dev)
     - `*.vercel.app` (si Vercel)
     - `sentryal.com` (prod)
     - `*.sentryal.com` (subdomains)
4. **Create & copy** la clé (format : `AAPK...`)

#### 1.3 Tester l'API Key
```bash
# Test simple avec curl
curl "https://basemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer?f=json&token=TON_API_KEY"
```
**Résultat attendu** : JSON avec metadata du service (pas d'erreur 401)

---

### Phase 2 : Configuration environnement (15 min)

#### 2.1 Variables d'environnement
**Fichier** : `frontend/.env.local`
```bash
# Esri API Key
NEXT_PUBLIC_ESRI_API_KEY=AAPK_ton_api_key_ici

# Mapbox (fallback)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...ton_token_existant

# Feature flags
NEXT_PUBLIC_USE_ESRI_BASEMAP=true
NEXT_PUBLIC_ESRI_FALLBACK_ENABLED=true
```

#### 2.2 Types TypeScript
**Fichier** : `frontend/src/types/esri.ts`
```typescript
export interface EsriBasemapConfig {
  apiKey: string;
  baseUrl: string;
  style: 'standard' | 'clarity' | 'wayback';
  fallbackEnabled: boolean;
  maxZoom: number;
  attribution: string;
}

export interface EsriTileUsage {
  count: number;
  limit: number;
  percentage: number;
  resetDate: Date;
}

export interface EsriBasemapSource {
  id: string;
  name: string;
  url: string;
  tileSize: number;
  maxzoom: number;
  attribution: string;
}
```

---

### Phase 3 : Service Esri (45 min)

#### 3.1 Service de configuration
**Fichier** : `frontend/src/services/esriService.ts`
```typescript
import type { EsriBasemapConfig, EsriBasemapSource, EsriTileUsage } from '@/types/esri';

class EsriService {
  private config: EsriBasemapConfig;
  private tileCount: number = 0;
  private readonly MONTHLY_LIMIT = 2_000_000;

  constructor() {
    this.config = {
      apiKey: process.env.NEXT_PUBLIC_ESRI_API_KEY || '',
      baseUrl: 'https://basemaps-api.arcgis.com/arcgis/rest/services',
      style: 'standard',
      fallbackEnabled: true,
      maxZoom: 19, // Limiter pour économiser quota
      attribution: '© Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS user community',
    };
  }

  /**
   * Obtenir la source basemap selon le style choisi
   */
  getBasemapSource(style: 'standard' | 'clarity' = 'standard'): EsriBasemapSource {
    const sources = {
      standard: {
        id: 'esri-world-imagery',
        name: 'Esri World Imagery',
        url: `${this.config.baseUrl}/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${this.config.apiKey}`,
        tileSize: 256,
        maxzoom: this.config.maxZoom,
        attribution: this.config.attribution,
      },
      clarity: {
        id: 'esri-world-imagery-clarity',
        name: 'Esri World Imagery (Clarity)',
        url: `https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${this.config.apiKey}`,
        tileSize: 256,
        maxzoom: this.config.maxZoom,
        attribution: this.config.attribution + ' (Clarity Enhanced)',
      },
    };

    return sources[style];
  }

  /**
   * Obtenir la source Mapbox fallback
   */
  getFallbackSource(): EsriBasemapSource {
    return {
      id: 'mapbox-satellite-fallback',
      name: 'Mapbox Satellite (Fallback)',
      url: 'mapbox://mapbox.satellite',
      tileSize: 512,
      maxzoom: 22,
      attribution: '© Mapbox © OpenStreetMap',
    };
  }

  /**
   * Incrémenter le compteur de tuiles
   */
  incrementTileCount(): void {
    this.tileCount++;
    
    // Sauvegarder en localStorage pour persistance
    if (typeof window !== 'undefined') {
      const stored = this.getTileUsage();
      localStorage.setItem('esri_tile_usage', JSON.stringify({
        ...stored,
        count: this.tileCount,
        lastUpdate: new Date().toISOString(),
      }));
    }
  }

  /**
   * Obtenir l'usage actuel des tuiles
   */
  getTileUsage(): EsriTileUsage {
    if (typeof window === 'undefined') {
      return { count: 0, limit: this.MONTHLY_LIMIT, percentage: 0, resetDate: new Date() };
    }

    const stored = localStorage.getItem('esri_tile_usage');
    const data = stored ? JSON.parse(stored) : { count: 0 };
    
    const count = data.count || this.tileCount;
    const percentage = (count / this.MONTHLY_LIMIT) * 100;
    
    // Reset date = 1er du mois prochain
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
    resetDate.setHours(0, 0, 0, 0);

    return {
      count,
      limit: this.MONTHLY_LIMIT,
      percentage,
      resetDate,
    };
  }

  /**
   * Vérifier si on doit utiliser le fallback
   */
  shouldUseFallback(): boolean {
    if (!this.config.fallbackEnabled) return false;
    
    const usage = this.getTileUsage();
    return usage.percentage >= 95; // Fallback à 95%
  }

  /**
   * Obtenir le niveau d'alerte usage
   */
  getUsageAlert(): 'none' | 'warning' | 'critical' {
    const usage = this.getTileUsage();
    
    if (usage.percentage >= 90) return 'critical';
    if (usage.percentage >= 80) return 'warning';
    return 'none';
  }
}

export const esriService = new EsriService();
```

#### 3.2 Hook React pour Esri
**Fichier** : `frontend/src/hooks/useEsriBasemap.ts`
```typescript
import { useState, useEffect, useCallback } from 'react';
import { esriService } from '@/services/esriService';
import type { EsriBasemapSource, EsriTileUsage } from '@/types/esri';

export function useEsriBasemap() {
  const [currentSource, setCurrentSource] = useState<EsriBasemapSource | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [usage, setUsage] = useState<EsriTileUsage | null>(null);
  const [style, setStyle] = useState<'standard' | 'clarity'>('standard');

  // Initialiser la source
  useEffect(() => {
    const shouldFallback = esriService.shouldUseFallback();
    
    if (shouldFallback) {
      setCurrentSource(esriService.getFallbackSource());
      setIsUsingFallback(true);
    } else {
      setCurrentSource(esriService.getBasemapSource(style));
      setIsUsingFallback(false);
    }
    
    setUsage(esriService.getTileUsage());
  }, [style]);

  // Changer de style
  const changeStyle = useCallback((newStyle: 'standard' | 'clarity') => {
    setStyle(newStyle);
  }, []);

  // Incrémenter compteur tuiles
  const trackTileLoad = useCallback(() => {
    if (!isUsingFallback) {
      esriService.incrementTileCount();
      setUsage(esriService.getTileUsage());
    }
  }, [isUsingFallback]);

  // Forcer fallback
  const forceFallback = useCallback(() => {
    setCurrentSource(esriService.getFallbackSource());
    setIsUsingFallback(true);
  }, []);

  return {
    currentSource,
    isUsingFallback,
    usage,
    style,
    changeStyle,
    trackTileLoad,
    forceFallback,
    usageAlert: usage ? esriService.getUsageAlert() : 'none',
  };
}
```

---

### Phase 4 : Intégration Mapbox GL (60 min)

#### 4.1 Modifier InfrastructureMap.tsx
**Fichier** : `frontend/src/components/Map/InfrastructureMap.tsx`

**Ajouter les imports** :
```typescript
import { useEsriBasemap } from '@/hooks/useEsriBasemap';
import { EsriBasemapControl } from './EsriBasemapControl';
```

**Dans le composant, après les states existants** :
```typescript
// Esri basemap integration
const {
  currentSource,
  isUsingFallback,
  usage,
  style,
  changeStyle,
  trackTileLoad,
  usageAlert,
} = useEsriBasemap();
```

**Remplacer l'initialisation de la carte** :
```typescript
// Dans useEffect d'initialisation, remplacer :
map.current = new mapboxgl.Map({
  container: mapContainer.current,
  style: MAP_STYLE, // ← Remplacer cette ligne
  center: INITIAL_VIEW.center,
  zoom: INITIAL_VIEW.zoom,
  attributionControl: false,
  maxZoom: 22,
  maxPitch: 85,
  antialias: true,
});

// Par :
map.current = new mapboxgl.Map({
  container: mapContainer.current,
  style: {
    version: 8,
    sources: {},
    layers: [],
  }, // Style vide, on ajoutera Esri après
  center: INITIAL_VIEW.center,
  zoom: INITIAL_VIEW.zoom,
  attributionControl: false,
  maxZoom: currentSource?.maxzoom || 19,
  maxPitch: 85,
  antialias: true,
});
```

**Ajouter effet pour source Esri** :
```typescript
// Ajouter après les autres useEffect
useEffect(() => {
  if (!map.current || !currentSource) return;

  const sourceId = 'basemap-source';
  const layerId = 'basemap-layer';

  // Supprimer source/layer existants
  if (map.current.getLayer(layerId)) {
    map.current.removeLayer(layerId);
  }
  if (map.current.getSource(sourceId)) {
    map.current.removeSource(sourceId);
  }

  // Ajouter nouvelle source
  if (currentSource.url.startsWith('mapbox://')) {
    // Source Mapbox (fallback)
    map.current.addSource(sourceId, {
      type: 'raster',
      url: currentSource.url,
      tileSize: currentSource.tileSize,
    });
  } else {
    // Source Esri
    map.current.addSource(sourceId, {
      type: 'raster',
      tiles: [currentSource.url],
      tileSize: currentSource.tileSize,
      maxzoom: currentSource.maxzoom,
      attribution: currentSource.attribution,
    });
  }

  // Ajouter layer
  map.current.addLayer({
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: {
      'raster-opacity': 1,
      'raster-fade-duration': 300,
    },
  });

  // Tracking des tuiles Esri
  if (!isUsingFallback) {
    map.current.on('data', (e) => {
      if (e.dataType === 'tile' && e.sourceId === sourceId) {
        trackTileLoad();
      }
    });
  }

  console.log(`✅ Basemap loaded: ${currentSource.name}`);
}, [currentSource, isUsingFallback, trackTileLoad]);
```

#### 4.2 Composant de contrôle Esri
**Fichier** : `frontend/src/components/Map/EsriBasemapControl.tsx`
```typescript
'use client';

import { useState } from 'react';
import { Satellite, AlertTriangle, Info } from 'lucide-react';
import type { EsriTileUsage } from '@/types/esri';

interface EsriBasemapControlProps {
  style: 'standard' | 'clarity';
  onStyleChange: (style: 'standard' | 'clarity') => void;
  isUsingFallback: boolean;
  usage: EsriTileUsage | null;
  usageAlert: 'none' | 'warning' | 'critical';
  className?: string;
}

export function EsriBasemapControl({
  style,
  onStyleChange,
  isUsingFallback,
  usage,
  usageAlert,
  className = '',
}: EsriBasemapControlProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}k`;
    return num.toString();
  };

  const getAlertColor = () => {
    switch (usageAlert) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Satellite className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {isUsingFallback ? 'Imagerie Standard' : 'Imagerie Premium'}
            </h3>
            <p className="text-xs text-gray-600">
              {isUsingFallback ? 'Mapbox Satellite' : `Esri ${style === 'clarity' ? 'Clarity' : 'Standard'}`}
            </p>
          </div>
        </div>
        
        {/* Usage indicator */}
        {usage && !isUsingFallback && (
          <div className="flex items-center gap-2">
            {usageAlert !== 'none' && (
              <AlertTriangle className={`w-4 h-4 ${usageAlert === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
            )}
            <span className="text-xs font-medium text-gray-600">
              {formatNumber(usage.count)}/{formatNumber(usage.limit)}
            </span>
          </div>
        )}
        
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Style selector (only if not using fallback) */}
          {!isUsingFallback && (
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                Style d'imagerie
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onStyleChange('standard')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    style === 'standard'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Standard
                </button>
                <button
                  onClick={() => onStyleChange('clarity')}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    style === 'clarity'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Clarity
                </button>
              </div>
            </div>
          )}

          {/* Usage details */}
          {usage && !isUsingFallback && (
            <div className={`p-3 rounded-lg border ${getAlertColor()}`}>
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4" />
                <span className="text-xs font-medium">Usage mensuel</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Tuiles utilisées:</span>
                  <span className="font-medium">{formatNumber(usage.count)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quota gratuit:</span>
                  <span className="font-medium">{formatNumber(usage.limit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pourcentage:</span>
                  <span className="font-medium">{usage.percentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      usage.percentage >= 90 ? 'bg-red-500' :
                      usage.percentage >= 80 ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(usage.percentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Fallback info */}
          {isUsingFallback && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-800">Mode dégradé</span>
              </div>
              <p className="text-xs text-amber-700">
                Quota Esri atteint. Utilisation de Mapbox Satellite.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

#### 4.3 Ajouter le contrôle à la carte
**Dans InfrastructureMap.tsx, dans la section render** :
```typescript
{/* Map Style Selector - Top Left */}
{isMapLoaded && (
  <div className="absolute top-4 left-4 z-10 max-w-xs space-y-3">
    <EsriBasemapControl
      style={style}
      onStyleChange={changeStyle}
      isUsingFallback={isUsingFallback}
      usage={usage}
      usageAlert={usageAlert}
    />
    <MapFilters onFilterChange={setFilters} />
  </div>
)}
```

---

### Phase 5 : Tests et validation (30 min)

#### 5.1 Tests fonctionnels
1. **Démarrer le dev server** : `npm run dev`
2. **Vérifier** :
   - ✅ Carte charge avec imagerie Esri
   - ✅ Contrôle Esri visible en haut à gauche
   - ✅ Bascule Standard ↔ Clarity fonctionne
   - ✅ Compteur tuiles s'incrémente
   - ✅ Attribution Esri affichée

#### 5.2 Tests de fallback
1. **Simuler quota dépassé** :
   ```typescript
   // Dans localStorage navigateur (DevTools)
   localStorage.setItem('esri_tile_usage', JSON.stringify({
     count: 1950000, // 97.5%
     lastUpdate: new Date().toISOString()
   }));
   ```
2. **Recharger** → Doit basculer sur Mapbox
3. **Vérifier** message "Mode dégradé"

#### 5.3 Tests performance
1. **Network tab** → Vérifier requêtes vers `basemaps-api.arcgis.com`
2. **Console** → Pas d'erreurs 401/403
3. **Zoom/pan** → Chargement fluide des tuiles

---

### Phase 6 : Monitoring et alertes (15 min)

#### 6.1 Dashboard usage (optionnel)
**Fichier** : `frontend/src/components/Admin/EsriUsageDashboard.tsx`
```typescript
'use client';

import { useEsriBasemap } from '@/hooks/useEsriBasemap';
import { BarChart3, AlertCircle, CheckCircle } from 'lucide-react';

export function EsriUsageDashboard() {
  const { usage, usageAlert, isUsingFallback } = useEsriBasemap();

  if (!usage) return null;

  const daysLeft = Math.ceil((usage.resetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const dailyAverage = usage.count / (30 - daysLeft + 1);
  const projectedTotal = dailyAverage * 30;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Usage Esri Basemap</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Usage actuel */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Usage actuel</span>
            {usageAlert === 'none' ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className={`w-4 h-4 ${usageAlert === 'critical' ? 'text-red-500' : 'text-amber-500'}`} />
            )}
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {(usage.percentage).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">
            {usage.count.toLocaleString()} / {usage.limit.toLocaleString()}
          </div>
        </div>

        {/* Projection */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600 block mb-2">Projection mensuelle</span>
          <div className="text-2xl font-bold text-gray-900">
            {((projectedTotal / usage.limit) * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">
            ~{Math.round(projectedTotal).toLocaleString()} tuiles
          </div>
        </div>

        {/* Reset */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600 block mb-2">Reset dans</span>
          <div className="text-2xl font-bold text-gray-900">
            {daysLeft}j
          </div>
          <div className="text-xs text-gray-500">
            {usage.resetDate.toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="mt-4 p-3 rounded-lg border">
        {isUsingFallback ? (
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Mode fallback actif (Mapbox)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Imagerie Esri active</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 🎯 Checklist finale

### ✅ Avant mise en production
- [ ] Compte ArcGIS Location Platform créé
- [ ] API Key générée et testée
- [ ] Variables d'environnement configurées
- [ ] Attribution Esri affichée correctement
- [ ] Fallback Mapbox fonctionnel
- [ ] Monitoring usage implémenté
- [ ] Tests sur différents devices/navigateurs
- [ ] Performance validée (temps chargement)

### ✅ Monitoring continu
- [ ] Alertes usage (80%, 90%, 95%)
- [ ] Logs erreurs API Esri
- [ ] Métriques performance tuiles
- [ ] Feedback utilisateurs qualité visuelle

### ✅ Documentation
- [ ] Guide utilisateur (sélecteur styles)
- [ ] Runbook ops (gestion quota, fallback)
- [ ] Contacts support Esri si nécessaire

---

## 🚀 Résultat attendu

Après implémentation complète :

✅ **Qualité visuelle premium** avec Esri World Imagery  
✅ **2M tuiles gratuites/mois** = 20-40k pages vues  
✅ **Fallback automatique** si quota dépassé  
✅ **Monitoring usage** en temps réel  
✅ **Sélecteur Standard/Clarity** pour optimiser selon usage  
✅ **Attribution conforme** aux exigences Esri  

**Temps total d'implémentation** : ~3-4 heures  
**Coût récurrent** : 0€ pendant 6-12 mois (MVP)  
**Avantage concurrentiel** : Qualité premium vs Mapbox/Google
