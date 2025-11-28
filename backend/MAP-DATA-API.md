# 🗺️ MAP DATA API - DOCUMENTATION COMPLÈTE

## 📍 Endpoint

```
GET /api/infrastructures/:id/map-data
```

## 🎯 Description

Retourne les données GeoJSON optimisées pour la visualisation cartographique interactive des déformations InSAR.

**Fonctionnalités :**
- Format GeoJSON standard (compatible Mapbox, Leaflet, etc.)
- Codage couleur intelligent basé sur le risque
- Évaluation automatique du niveau de risque
- Analyse de tendance (accélération/décélération)
- Statistiques agrégées
- Métadonnées de qualité des données
- Cache HTTP (5 minutes)

---

## 🔐 Authentification

Requiert un Bearer token JWT :
```
Authorization: Bearer <your_jwt_token>
```

---

## 📊 Réponse

### Structure GeoJSON

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [3.024792, 48.988140]
      },
      "properties": {
        "pointId": "uuid",
        "displacement_mm": -16.52,
        "velocity_mm_year": -5.2,
        "coherence": 0.98,
        "lastUpdate": "2024-11-25T00:00:00.000Z",
        "measurementCount": 5,
        "color": "#FF0000",
        "riskLevel": "high",
        "trend": "accelerating",
        "metadata": {
          "displacementRange": {
            "min": -20.0,
            "max": -15.0
          },
          "averageCoherence": 0.95,
          "dataQuality": "excellent"
        }
      }
    }
  ],
  "metadata": {
    "infrastructureId": "uuid",
    "totalPoints": 5,
    "activePoints": 5,
    "dateRange": {
      "earliest": "2024-11-13T00:00:00.000Z",
      "latest": "2024-11-25T00:00:00.000Z"
    },
    "statistics": {
      "averageDisplacement": -17.05,
      "minDisplacement": -19.63,
      "maxDisplacement": -15.41,
      "averageVelocity": -5.2
    },
    "riskDistribution": {
      "critical": 0,
      "high": 3,
      "medium": 1,
      "low": 1,
      "stable": 0,
      "unknown": 0
    }
  }
}
```

---

## 🎨 Système de Couleurs

### Échelle de Risque (basée sur `displacement_mm`)

| Déplacement (mm) | Couleur | Code Hex | Niveau de Risque |
|------------------|---------|----------|------------------|
| > 20 | Rouge foncé | `#8B0000` | Critical |
| 10 - 20 | Rouge | `#FF0000` | High |
| 5 - 10 | Orange-rouge | `#FF4500` | Medium |
| 2 - 5 | Orange | `#FFA500` | Low |
| 0 - 2 | Jaune | `#FFFF00` | Minimal |
| -2 - 0 | Vert clair | `#90EE90` | Stable |
| < -2 | Vert | `#00FF00` | Uplift |
| null | Gris | `#808080` | No Data |

**Note :** Les valeurs positives indiquent une subsidence (affaissement), les valeurs négatives un soulèvement.

---

## 📈 Niveaux de Risque

### `riskLevel`

- **`critical`** : Déplacement > 20mm OU vélocité > 15mm/an
- **`high`** : Déplacement > 10mm
- **`medium`** : Déplacement > 5mm
- **`low`** : Déplacement > 2mm
- **`stable`** : Déplacement ≤ 2mm
- **`unknown`** : Pas de données

---

## 📊 Analyse de Tendance

### `trend`

- **`accelerating`** : Vélocité < -10 mm/an (aggravation)
- **`stable`** : Vélocité entre -10 et -2 mm/an
- **`decelerating`** : Vélocité > -2 mm/an (amélioration)
- **`unknown`** : Pas de données de vélocité

---

## 🔬 Qualité des Données

### `dataQuality`

- **`excellent`** : ≥10 mesures ET cohérence ≥0.8
- **`good`** : ≥5 mesures ET cohérence ≥0.6
- **`fair`** : ≥3 mesures ET cohérence ≥0.4
- **`poor`** : <3 mesures OU cohérence <0.4

---

## 💻 Exemple d'Utilisation (Frontend)

### Mapbox GL JS

```javascript
// Charger les données
const response = await fetch(
  `/api/infrastructures/${infrastructureId}/map-data`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const mapData = await response.json();

// Ajouter à la map
map.addSource('deformations', {
  type: 'geojson',
  data: mapData
});

// Afficher les points avec couleurs
map.addLayer({
  id: 'deformation-points',
  type: 'circle',
  source: 'deformations',
  paint: {
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      10, 4,
      15, 12
    ],
    'circle-color': ['get', 'color'],
    'circle-stroke-width': 2,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.8
  }
});

// Popup au click
map.on('click', 'deformation-points', (e) => {
  const props = e.features[0].properties;
  
  new mapboxgl.Popup()
    .setLngLat(e.lngLat)
    .setHTML(`
      <div class="popup">
        <h3>Point ${props.pointId.substring(0, 8)}</h3>
        <div class="risk-badge ${props.riskLevel}">
          ${props.riskLevel.toUpperCase()}
        </div>
        <table>
          <tr>
            <td>Déplacement:</td>
            <td><strong>${props.displacement_mm} mm</strong></td>
          </tr>
          <tr>
            <td>Vélocité:</td>
            <td>${props.velocity_mm_year} mm/an</td>
          </tr>
          <tr>
            <td>Cohérence:</td>
            <td>${(props.coherence * 100).toFixed(0)}%</td>
          </tr>
          <tr>
            <td>Tendance:</td>
            <td>${props.trend}</td>
          </tr>
          <tr>
            <td>Mesures:</td>
            <td>${props.measurementCount}</td>
          </tr>
          <tr>
            <td>Qualité:</td>
            <td>${props.metadata.dataQuality}</td>
          </tr>
        </table>
        <small>Dernière mesure: ${new Date(props.lastUpdate).toLocaleDateString('fr-FR')}</small>
      </div>
    `)
    .addTo(map);
});
```

### Leaflet

```javascript
// Charger les données
const response = await fetch(
  `/api/infrastructures/${infrastructureId}/map-data`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const mapData = await response.json();

// Ajouter à la map
L.geoJSON(mapData, {
  pointToLayer: (feature, latlng) => {
    return L.circleMarker(latlng, {
      radius: 8,
      fillColor: feature.properties.color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8
    });
  },
  onEachFeature: (feature, layer) => {
    const props = feature.properties;
    layer.bindPopup(`
      <h3>Point ${props.pointId.substring(0, 8)}</h3>
      <p><strong>Risque:</strong> ${props.riskLevel}</p>
      <p><strong>Déplacement:</strong> ${props.displacement_mm} mm</p>
      <p><strong>Vélocité:</strong> ${props.velocity_mm_year} mm/an</p>
    `);
  }
}).addTo(map);
```

---

## ⚡ Performance

### Cache HTTP

- **Durée :** 5 minutes (300 secondes)
- **Header :** `Cache-Control: public, max-age=300`
- **Headers personnalisés :**
  - `X-Total-Points` : Nombre total de points
  - `X-Active-Points` : Points avec mesures

### Optimisation Base de Données

- **1 seule requête** pour toutes les données
- **LATERAL JOIN** pour les dernières mesures
- **Agrégation** en SQL (min, max, avg)
- **Indexation** sur `point_id`, `date`

### Temps de Réponse Typique

- **5 points** : ~50ms
- **50 points** : ~100ms
- **500 points** : ~300ms
- **5000 points** : ~1s

---

## 🔄 Invalidation du Cache

Le cache est automatiquement invalidé quand :
- Un nouveau job est complété
- Des déformations sont ajoutées/modifiées
- Un point est ajouté/supprimé

---

## 🚨 Codes d'Erreur

| Code | Description |
|------|-------------|
| `200` | Succès |
| `401` | Non authentifié |
| `404` | Infrastructure non trouvée |
| `500` | Erreur serveur |

---

## 📊 Métadonnées Retournées

### `metadata.statistics`

- **`averageDisplacement`** : Déplacement moyen (mm)
- **`minDisplacement`** : Déplacement minimum (mm)
- **`maxDisplacement`** : Déplacement maximum (mm)
- **`averageVelocity`** : Vélocité moyenne (mm/an)

### `metadata.riskDistribution`

Nombre de points par niveau de risque :
- `critical`, `high`, `medium`, `low`, `stable`, `unknown`

### `metadata.dateRange`

- **`earliest`** : Date de la première mesure
- **`latest`** : Date de la dernière mesure

---

## 🎯 Cas d'Usage

### 1. Carte Interactive Basique

Afficher tous les points avec couleurs selon le risque.

### 2. Heatmap

Utiliser `displacement_mm` comme poids pour une heatmap.

### 3. Filtrage par Risque

Filtrer les points selon `riskLevel` (ex: afficher seulement `critical` et `high`).

### 4. Animation Temporelle

Combiner avec l'endpoint `/api/deformations/time-series/:pointId` pour animer l'évolution.

### 5. Clustering

Grouper les points proches avec Mapbox/Leaflet clustering.

---

## 🔧 Configuration Recommandée

### Mapbox

```javascript
{
  style: 'mapbox://styles/mapbox/satellite-v9',
  zoom: 15,
  minZoom: 10,
  maxZoom: 20
}
```

### Leaflet

```javascript
{
  maxZoom: 20,
  attribution: '© OpenStreetMap contributors'
}
```

---

## 📝 Notes Importantes

1. **Convention InSAR** : Valeurs positives = subsidence (descente)
2. **Cohérence** : Indicateur de fiabilité (0-1, >0.7 = bon)
3. **Vélocité** : Calculée par régression linéaire sur time series
4. **Cache** : Rafraîchir manuellement si données critiques

---

## 🚀 Prochaines Évolutions

- [ ] Support WebSocket pour updates temps réel
- [ ] Export GeoJSON/KML
- [ ] Filtrage par date
- [ ] Agrégation spatiale (grille)
- [ ] Prédictions ML

---

**Créé avec ❤️ par Sentryal - InSAR Monitoring Platform**
