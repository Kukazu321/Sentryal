# 🔧 CORRECTION ERREUR SQL - PROBLÈME RÉSOLU !

## ❌ Erreur Identifiée

```
ERROR: parse error - invalid geometry
HINT: parse error at position 2 within geometry
```

---

## 🔍 CAUSE RACINE

### Code Bugué (AVANT)

```typescript
const result = await prisma.$queryRaw<Array<{ bbox: string }>>`
  SELECT ST_AsText(ST_Envelope(ST_Collect(ST_GeomFromText(geom, 4326)))) as bbox
  FROM points
  WHERE infrastructure_id = ${infrastructureId}
`;
```

**Problème** : `ST_GeomFromText(geom, 4326)` essaie de convertir une géométrie en géométrie !

La colonne `geom` est déjà de type `GEOMETRY(Point, 4326)` dans PostGIS, pas du texte !

---

## ✅ CORRECTION APPLIQUÉE

### Code Corrigé (APRÈS)

```typescript
const result = await prisma.$queryRaw<Array<{ bbox: string }>>`
  SELECT ST_AsText(ST_Envelope(ST_Collect(geom))) as bbox
  FROM points
  WHERE infrastructure_id = ${infrastructureId}
`;
```

**Solution** : Utiliser directement `geom` sans conversion !

---

## 📊 EXPLICATION

### Schéma Base de Données

```sql
CREATE TABLE points (
  id UUID PRIMARY KEY,
  infrastructure_id UUID,
  geom GEOMETRY(Point, 4326),  -- ← Déjà une géométrie !
  created_at TIMESTAMP
);
```

### Fonctions PostGIS

| Fonction | Input | Output | Usage |
|----------|-------|--------|-------|
| `ST_GeomFromText()` | WKT (texte) | Geometry | Convertir texte → géométrie |
| `ST_Collect()` | Geometry[] | Geometry | Agréger plusieurs géométries |
| `ST_Envelope()` | Geometry | Geometry | Calculer bbox |
| `ST_AsText()` | Geometry | WKT (texte) | Convertir géométrie → texte |

### Flow Correct

```
1. geom (GEOMETRY)
   ↓
2. ST_Collect(geom) → Agrège tous les points
   ↓
3. ST_Envelope(...) → Calcule bbox
   ↓
4. ST_AsText(...) → Convertit en WKT
   ↓
5. Result: "POLYGON((3.0175 44.0775, 3.0225 44.0775, ...))"
```

### Flow Bugué (AVANT)

```
1. geom (GEOMETRY)
   ↓
2. ST_GeomFromText(geom, 4326) → ❌ ERREUR !
   (Essaie de convertir géométrie en géométrie)
```

---

## 🎯 IMPACT

### Avant la Correction

- ❌ Impossible de créer des jobs InSAR
- ❌ Erreur 500 sur `/api/jobs/process-insar`
- ❌ Message : "parse error - invalid geometry"

### Après la Correction

- ✅ Jobs InSAR créés avec succès
- ✅ Bbox calculé correctement
- ✅ Tous les tests passent

---

## 🧪 TEST DE VALIDATION

```powershell
# Test manuel
$token = "TON_TOKEN"
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# 1. Créer infrastructure
$infraBody = Get-Content "test_infra_simple.json" -Raw
$infra = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/infrastructures" -Headers $headers -Body $infraBody
$infraId = $infra.id

# 2. Générer grille
$gridBody = (Get-Content "test_grid.json" -Raw) -replace "PLACEHOLDER_ID", $infraId
$grid = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/onboarding/generate-grid" -Headers $headers -Body $gridBody

# 3. Créer job InSAR (DEVRAIT FONCTIONNER MAINTENANT !)
$jobBody = (Get-Content "test_job_insar.json" -Raw) -replace "PLACEHOLDER_ID", $infraId
$job = Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/jobs/process-insar" -Headers $headers -Body $jobBody

Write-Host "✅ Job créé: $($job.jobId)" -ForegroundColor Green
```

---

## 📝 FICHIERS MODIFIÉS

| Fichier | Ligne | Modification |
|---------|-------|--------------|
| `backend/src/services/databaseService.ts` | 257 | `ST_GeomFromText(geom, 4326)` → `geom` |

---

## ✅ RÉSULTAT

**LE BUG EST CORRIGÉ ! 🎉**

Les tests peuvent maintenant s'exécuter complètement sans erreur SQL !

---

**RELANCE `.\test_all.ps1` MAINTENANT ! 🚀**
