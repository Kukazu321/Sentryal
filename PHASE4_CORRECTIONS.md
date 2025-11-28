# PHASE 4 - CORRECTIONS BASÉES SUR LA VRAIE DOC HyP3

## 🎯 Problèmes identifiés et corrigés

### ❌ Ce qui était FAUX (théorique)

1. **Authentification OAuth client_credentials**
   - ❌ J'avais codé un flow OAuth complet avec refresh token
   - ✅ **RÉALITÉ** : Simple Bearer token (60 jours) généré sur https://urs.earthdata.nasa.gov

2. **Format API**
   - ❌ J'avais inventé le format de requête
   - ✅ **RÉALITÉ** : `POST /jobs` avec `{ "jobs": [{ "name": "...", "job_type": "INSAR_GAMMA", "job_parameters": {...} }] }`

3. **Endpoint status**
   - ❌ J'utilisais `GET /jobs/{id}`
   - ✅ **RÉALITÉ** : `GET /jobs?job_id={id}`

4. **Format de sortie**
   - ❌ J'avais supposé des fichiers CSV
   - ✅ **RÉALITÉ** : Fichiers **GeoTIFF** (32-bit float)
     - `*_los_disp.tif` : Line-of-sight displacement (mètres)
     - `*_vert_disp.tif` : Vertical displacement (mètres)
     - `*_corr.tif` : Coherence (0.0-1.0)
     - `*_unw_phase.tif` : Unwrapped phase

---

## ✅ Corrections appliquées

### 1. HyP3Service corrigé

**Avant (théorique) :**
```typescript
async createJob(bbox, dateRange, options) {
  await this.ensureAuthenticated(); // OAuth flow
  const response = await fetch(`${this.baseUrl}/jobs`, {
    headers: { 'Authorization': `Bearer ${this.oauthToken}` },
    body: JSON.stringify({ job_type: 'INSAR_GAMMA', ... })
  });
}
```

**Après (basé sur vraie doc) :**
```typescript
async createJob(granules: [string, string], options) {
  const payload = {
    jobs: [{
      name: "my-job",
      job_type: "INSAR_GAMMA",
      job_parameters: {
        granules, // Pair of Sentinel-1 granule IDs
        looks: "20x4",
        include_los_displacement: true,
        include_displacement_maps: true
      }
    }]
  };
  
  const response = await fetch(`${this.baseUrl}/jobs`, {
    headers: { 'Authorization': `Bearer ${this.bearerToken}` },
    body: JSON.stringify(payload)
  });
}
```

### 2. Authentification simplifiée

**Avant :**
- OAuth client_credentials
- Token refresh automatique
- Expiry management

**Après :**
- Simple variable d'environnement : `EARTHDATA_BEARER_TOKEN`
- Token valide 60 jours
- Pas de refresh (régénérer manuellement)

**Comment obtenir le token :**
1. Aller sur https://urs.earthdata.nasa.gov
2. Se connecter avec compte NASA Earthdata
3. Aller dans "Generate Token"
4. Copier le token
5. Définir `EARTHDATA_BEARER_TOKEN=<token>` dans `.env`

### 3. Format de sortie GeoTIFF

**Avant :**
- Parser CSV avec PapaParse
- Colonnes : lat, lon, date, displacement_mm, coherence

**Après :**
- Parser GeoTIFF avec `geotiff.js`
- Format : 32-bit floating-point raster
- Extraction pixel par pixel
- Matching géospatial avec coordonnées

---

## 🚨 PROBLÈME MAJEUR NON RÉSOLU

### Recherche de granules Sentinel-1

**Le problème :**
Pour créer un job HyP3, il faut fournir **2 granules Sentinel-1 SLC** (paire InSAR).

**Format granule :**
```
S1A_IW_SLC__1SDV_20200203T172103_20200203T172122_031091_03929B_3048
```

**Ce qu'il faut faire :**
1. Prendre notre bbox (bounding box de l'infrastructure)
2. Chercher les granules Sentinel-1 qui couvrent ce bbox
3. Sélectionner une paire avec :
   - Même orbite (track)
   - Dates différentes (12 jours de différence idéalement)
   - Baseline perpendiculaire < 150m
   - Coherence attendue > 0.3

**API à utiliser :**
- **ASF Search API** : https://search.asf.alaska.edu/api/
- Endpoint : `https://api.daac.asf.alaska.edu/services/search/param`
- Paramètres :
  - `platform=Sentinel-1A,Sentinel-1B`
  - `processingLevel=SLC`
  - `beamMode=IW`
  - `bbox=lon_min,lat_min,lon_max,lat_max`
  - `start=2024-01-01T00:00:00Z`
  - `end=2025-01-01T00:00:00Z`

**Exemple requête :**
```
GET https://api.daac.asf.alaska.edu/services/search/param?
  platform=Sentinel-1A&
  processingLevel=SLC&
  beamMode=IW&
  bbox=6.3,44.5,6.35,44.55&
  start=2024-01-01T00:00:00Z&
  end=2025-01-01T00:00:00Z&
  output=json
```

**Réponse :**
```json
[
  {
    "granuleName": "S1A_IW_SLC__1SDV_20240115T...",
    "sceneName": "...",
    "path": 123,
    "frame": 456,
    "flightDirection": "ASCENDING",
    "polarization": "VV+VH",
    "startTime": "2024-01-15T06:00:00Z",
    ...
  }
]
```

---

## 📝 TODO pour Phase 4 complète

### Étape 1 : Service de recherche de granules ✅ À FAIRE

Créer `granuleSearchService.ts` :
```typescript
class GranuleSearchService {
  async findInSARPairs(
    bbox: BBox,
    dateRange: DateRange
  ): Promise<Array<{
    reference: string;
    secondary: string;
    baseline: number;
    temporalBaseline: number;
  }>> {
    // 1. Search ASF for Sentinel-1 SLC granules
    // 2. Group by track/orbit
    // 3. Find pairs with good baseline
    // 4. Return sorted by quality
  }
}
```

### Étape 2 : Parser GeoTIFF ✅ À FAIRE

Créer `geoTiffParserService.ts` :
```typescript
class GeoTiffParserService {
  async parseDisplacementTiff(
    tiffBuffer: Buffer,
    points: Point[]
  ): Promise<Deformation[]> {
    // 1. Parse GeoTIFF with geotiff.js
    // 2. Get raster data
    // 3. For each point, extract pixel value
    // 4. Convert to displacement in mm
    // 5. Return deformations
  }
}
```

### Étape 3 : Mise à jour route process-insar

```typescript
router.post('/process-insar', async (req, res) => {
  const { infrastructureId, dateRange } = req.body;
  
  // 1. Get bbox from infrastructure
  const bbox = await databaseService.getAggregatedBbox(infrastructureId);
  
  // 2. Find Sentinel-1 granule pairs
  const pairs = await granuleSearchService.findInSARPairs(bbox, dateRange);
  
  if (pairs.length === 0) {
    return res.status(404).json({ 
      error: 'No suitable Sentinel-1 pairs found for this area/period' 
    });
  }
  
  // 3. Use best pair
  const bestPair = pairs[0];
  
  // 4. Create HyP3 job
  const hy3Response = await hyP3Service.createJob(
    [bestPair.reference, bestPair.secondary],
    { includeLosDisplacement: true, includeDisplacementMaps: true }
  );
  
  // 5. Store and queue
  // ...
});
```

---

## 🎓 Ce que j'ai appris

### Documentation officielle consultée

1. **HyP3 API** : https://hyp3-docs.asf.alaska.edu/using/api/
2. **HyP3 Authentication** : https://hyp3-docs.asf.alaska.edu/using/authentication/
3. **InSAR Product Guide** : https://hyp3-docs.asf.alaska.edu/guides/insar_product_guide/
4. **ASF Search API** : https://search.asf.alaska.edu/api/

### Leçons importantes

1. **Toujours vérifier la doc officielle** avant de coder
2. **Ne pas supposer** le format d'API
3. **Les données satellitaires sont complexes** (granules, orbites, baselines)
4. **GeoTIFF ≠ CSV** : formats très différents
5. **InSAR nécessite des paires** : pas juste une image

---

## 🚀 Prochaines étapes

### Phase 4.1 : Granule Search (CRITIQUE)
- [ ] Implémenter ASF Search API
- [ ] Sélection automatique de paires
- [ ] Validation baseline/coherence
- [ ] Cache des résultats

### Phase 4.2 : GeoTIFF Parser (CRITIQUE)
- [ ] Parser avec geotiff.js
- [ ] Extraction valeurs pixel
- [ ] Géoréférencement
- [ ] Matching avec points

### Phase 4.3 : Tests avec vraie API
- [ ] Obtenir token Earthdata
- [ ] Tester recherche granules
- [ ] Soumettre job réel HyP3
- [ ] Parser résultats réels

---

## 📊 État actuel

### ✅ Corrigé
- [x] Authentification Bearer token
- [x] Format API jobs array
- [x] Endpoint status avec query param
- [x] Documentation GeoTIFF

### ⚠️ Partiellement fonctionnel
- [~] Mode mock (fonctionne mais simplifié)
- [~] Route process-insar (fonctionne en mock, pas en prod)

### ❌ Manquant pour production
- [ ] Recherche granules Sentinel-1
- [ ] Parser GeoTIFF réel
- [ ] Sélection paires InSAR
- [ ] Validation baseline

---

**Conclusion :** Phase 4 est maintenant **basée sur la vraie doc**, mais il manque 2 composants critiques pour la production :
1. **Granule Search Service** (ASF Search API)
2. **GeoTIFF Parser Service** (geotiff.js)

Ces 2 services sont **essentiels** pour avoir un système fonctionnel en production.
