# Phase 2 : Backend API — routes de base — STATUT

## 📋 Objectifs de la Phase 2

Implémenter les routes API Express de base avec authentification Supabase, validation des données, et services pour les requêtes PostGIS et HyP3.

## ✅ Complété automatiquement

### 1. Configuration et dépendances
- [x] Installation de Zod pour validation
- [x] Installation de jsonwebtoken et jwks-rsa pour Supabase JWT
- [x] Configuration des variables d'environnement Supabase

### 2. Middleware d'authentification
- [x] Middleware `authMiddleware` : vérifie JWT Supabase
- [x] Middleware `verifySupabaseJWT` : décode et valide le token
- [x] Injection de `req.userId` dans les requêtes authentifiées
- [x] Gestion des erreurs 401/403

### 3. Service Layer
- [x] `DatabaseService` : wrapper Prisma avec helpers PostGIS
  - [x] `getUserInfrastructures(userId)` : liste les infrastructures d'un user
  - [x] `createPoints(infrastructureId, points[])` : création en batch
  - [x] `getPointsInBbox(bbox)` : requêtes spatiales
  - [x] Helpers PostGIS : `ST_MakePoint`, `ST_Envelope`, `ST_Contains`
- [x] `HyP3Service` : client TypeScript pour API HyP3
  - [x] Structure de base (mock pour MVP)
  - [x] `createJob()` : création de job HyP3
  - [x] Gestion OAuth (préparé pour Phase 4)

### 4. Routes API

#### `/api/auth/me` (GET)
- [x] Vérifie le JWT Supabase
- [x] Upsert user dans la table `users` si absent
- [x] Retourne `user_id` et données utilisateur

#### `/api/infrastructures` (GET, POST)
- [x] GET : liste les infrastructures d'un user (authentifié)
- [x] POST : création d'infrastructure
  - [x] Validation avec Zod : `name`, `type`, `bbox` (GeoJSON), `mode_onboarding`
  - [x] Conversion GeoJSON → PostGIS GEOMETRY
  - [x] Insertion en DB

#### `/api/points` (GET, POST)
- [x] GET : liste les points d'une infrastructure (query param `infrastructureId`)
- [x] POST : création en batch
  - [x] Validation : array de `{lat, lng}` ou GeoJSON FeatureCollection
  - [x] Conversion en PostGIS POINT
  - [x] Batch insert optimisé (>1000 points)

#### `/api/jobs` (GET, POST)
- [x] GET : liste les jobs d'une infrastructure (query param `infrastructureId`)
- [x] POST : création d'un job HyP3
  - [x] Validation des points existants
  - [x] Calcul du bbox agrégé avec PostGIS
  - [x] Appel `HyP3Service.createJob()`
  - [x] Stockage en DB avec status `PENDING`

### 5. Validation et gestion d'erreurs
- [x] Schémas Zod pour toutes les routes
- [x] Middleware de validation des requêtes
- [x] Messages d'erreur clairs et cohérents
- [x] Codes HTTP appropriés (400, 401, 403, 404, 500)

## 🎯 Actions requises de votre part

### 1. Installer les dépendances — ✅ FAIT

```bash
cd backend
npm install zod jsonwebtoken jwks-rsa
npm install --save-dev @types/jsonwebtoken
```

✅ Dépendances installées avec succès :
- `zod` : validation des données
- `jsonwebtoken` : vérification des JWT Supabase
- `jwks-rsa` : récupération des clés publiques Supabase
- `@types/jsonwebtoken` : types TypeScript

### 2. Configurer les variables d'environnement Supabase — ✅ FAIT

Ajouter dans `backend/.env` :

```env
# Supabase (pour authentification JWT)
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_JWT_SECRET=votre-jwt-secret
SUPABASE_ANON_KEY=votre-anon-key
```

✅ Variables Supabase configurées dans `.env`

**Comment obtenir ces valeurs :**
1. Aller sur https://supabase.com et créer un projet (ou utiliser un existant)
2. Dans le dashboard Supabase : Settings → API
3. Copier :
   - `SUPABASE_URL` : Project URL
   - `SUPABASE_ANON_KEY` : anon/public key
   - `SUPABASE_JWT_SECRET` : JWT Secret (dans Settings → API → JWT Settings)

### 3. Tester les routes API — 📋 GUIDE DE TEST

**Étape 1 : Vérifier que le backend démarre**

```bash
cd backend
npm run dev
```

Le backend devrait démarrer sur `http://localhost:5000`. Vérifier qu'il n'y a pas d'erreurs de compilation.

**Étape 2 : Obtenir un token Supabase**

**Option A : Via le frontend (recommandé)**

1. Démarre le frontend :
   ```bash
   cd frontend
   npm run dev
   ```

2. Va sur `http://localhost:3000/auth/login`
3. Connecte-toi avec un compte Supabase (ou utilise le fake auth si `NEXT_PUBLIC_USE_FAKE_AUTH=true`)
4. Ouvre la console du navigateur (F12)
5. Exécute cette commande pour récupérer le token :
   ```javascript
   // Dans la console du navigateur
   const session = await supabase.auth.getSession();
   console.log('Token:', session.data.session?.access_token);
   ```
6. Copie le token qui s'affiche

**⚠️ Note pour le fake auth :** Si tu utilises le fake Supabase (`NEXT_PUBLIC_USE_FAKE_AUTH=true`), ajoute aussi dans `backend/.env` :
```env
USE_FAKE_AUTH=true
```
Cela permettra au backend d'accepter les tokens mockés du frontend.

**Option B : Via Supabase CLI (si installé)**

```bash
# Se connecter et obtenir un token
supabase auth login
supabase auth token
```

**Option C : Créer un utilisateur de test directement**

1. Va sur le dashboard Supabase → Authentication → Users
2. Crée un nouvel utilisateur manuellement
3. Utilise le token depuis les logs Supabase ou génère-en un via l'API

**Étape 3 : Tests des routes API**

Ouvre un nouveau terminal (laisse le backend tourner) et teste chaque route :

#### Test 1 : Vérifier l'authentification (`/api/auth/me`)

```bash
# Remplace <TOKEN> par ton token Supabase
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/auth/me
```

**Résultat attendu :**
```json
{
  "userId": "uuid-de-l-utilisateur",
  "email": "ton-email@example.com"
}
```

**Si erreur 401 :** Vérifie que le token est valide et que les variables Supabase dans `.env` sont correctes.

#### Test 2 : Créer une infrastructure (`POST /api/infrastructures`)

```bash
curl -X POST http://localhost:5000/api/infrastructures \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pont de Test",
    "type": "bridge",
    "bbox": {
      "type": "Polygon",
      "coordinates": [[[2.0, 48.0], [2.1, 48.0], [2.1, 48.1], [2.0, 48.1], [2.0, 48.0]]]
    },
    "mode_onboarding": "DRAW"
  }'
```

**Résultat attendu :**
```json
{
  "id": "uuid-de-l-infrastructure",
  "user_id": "uuid-de-l-utilisateur",
  "name": "Pont de Test",
  "type": "bridge",
  "mode_onboarding": "DRAW",
  "bbox": {
    "type": "Polygon",
    "coordinates": [[[2.0, 48.0], [2.1, 48.0], [2.1, 48.1], [2.0, 48.1], [2.0, 48.0]]]
  },
  "created_at": "2024-...",
  "updated_at": "2024-..."
}
```

**⚠️ Important :** Copie l'`id` de l'infrastructure retournée, tu en auras besoin pour les tests suivants.

#### Test 3 : Lister les infrastructures (`GET /api/infrastructures`)

```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/infrastructures
```

**Résultat attendu :**
```json
{
  "infrastructures": [
    {
      "id": "...",
      "name": "Pont de Test",
      ...
    }
  ],
  "count": 1
}
```

#### Test 4 : Créer des points (`POST /api/points`)

Remplace `<INFRASTRUCTURE_ID>` par l'ID de l'infrastructure créée à l'étape 2 :

```bash
curl -X POST http://localhost:5000/api/points \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "infrastructureId": "<INFRASTRUCTURE_ID>",
    "points": [
      {"lat": 48.0, "lng": 2.0},
      {"lat": 48.005, "lng": 2.005},
      {"lat": 48.01, "lng": 2.01}
    ]
  }'
```

**Résultat attendu :**
```json
{
  "points": [
    {
      "id": "uuid-du-point-1",
      "infrastructure_id": "...",
      "geom": {
        "type": "Point",
        "coordinates": [2.0, 48.0]
      },
      "soil_type": null,
      "created_at": "..."
    },
    ...
  ],
  "count": 3
}
```

#### Test 5 : Lister les points (`GET /api/points`)

```bash
curl "http://localhost:5000/api/points?infrastructureId=<INFRASTRUCTURE_ID>" \
  -H "Authorization: Bearer <TOKEN>"
```

#### Test 6 : Créer un job HyP3 (`POST /api/jobs`)

```bash
curl -X POST http://localhost:5000/api/jobs \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "infrastructureId": "<INFRASTRUCTURE_ID>"
  }'
```

**Résultat attendu :**
```json
{
  "id": "uuid-du-job",
  "infrastructure_id": "...",
  "hy3_job_id": "mock-job-...",
  "status": "PENDING",
  "bbox": {
    "type": "Polygon",
    "coordinates": [...]
  },
  "created_at": "...",
  "completed_at": null
}
```

#### Test 7 : Lister les jobs (`GET /api/jobs`)

```bash
curl "http://localhost:5000/api/jobs?infrastructureId=<INFRASTRUCTURE_ID>" \
  -H "Authorization: Bearer <TOKEN>"
```

**Étape 4 : Tester les cas d'erreur**

#### Test avec token invalide (doit retourner 401) :
```bash
curl -H "Authorization: Bearer token-invalide" http://localhost:5000/api/auth/me
```

#### Test sans token (doit retourner 401) :
```bash
curl http://localhost:5000/api/infrastructures
```

#### Test avec données invalides (doit retourner 400) :
```bash
curl -X POST http://localhost:5000/api/infrastructures \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'  # name vide = erreur de validation
```

**Étape 5 : Vérifier dans la base de données (optionnel)**

Tu peux utiliser Prisma Studio pour visualiser les données :

```bash
cd backend
npm run prisma:studio
```

Ouvre `http://localhost:5555` et vérifie que les données sont bien créées dans les tables `users`, `infrastructures`, `points`, et `jobs`.

---

**🎯 Checklist de validation :**

- [x] Backend démarre sans erreur ✅
- [x] `/api/auth/me` retourne userId et email ✅
- [x] Création d'infrastructure fonctionne ✅
- [x] Liste des infrastructures fonctionne ✅
- [x] Création de points fonctionne (batch) ✅
- [x] Liste des points fonctionne ✅
- [x] Création de job fonctionne ✅
- [x] Liste des jobs fonctionne ✅
- [x] Erreurs 401/400 sont bien gérées ✅
- [x] Données visibles dans Prisma Studio ✅

Une fois le code implémenté, tester avec :
- `curl` ou Postman
- Frontend connecté au backend

## 📝 Notes importantes

1. **Authentification Supabase** : Le middleware vérifie le JWT avec la clé publique Supabase. En développement, on peut utiliser le fake Supabase du frontend.

2. **GeoJSON → PostGIS** : Les coordonnées GeoJSON sont converties en WKT PostGIS via `ST_GeomFromText()` dans les requêtes SQL.

3. **Batch inserts** : Pour >1000 points, utiliser `pg-copy-streams` ou des transactions batchées.

4. **HyP3Service** : Mock en Phase 2, implémentation réelle en Phase 4.

5. **Validation** : Tous les inputs sont validés avec Zod avant traitement.

## ⚠️ Problèmes potentiels

- **JWT invalide** : Vérifier `SUPABASE_JWT_SECRET` et `SUPABASE_URL` dans `.env`
- **CORS** : Vérifier que `FRONTEND_URL` est correct dans `.env`
- **PostGIS errors** : Vérifier que les coordonnées sont en WGS84 (SRID 4326)

## ✅ Phase 2 terminée quand...

- ✅ Toutes les routes API sont implémentées
- ✅ Middleware d'authentification fonctionne
- ✅ Services DatabaseService et HyP3Service créés
- ✅ Validation Zod sur toutes les routes
- ✅ Tests de vérification passent

---

## 🎉 PHASE 2 COMPLÉTÉE - 5 Novembre 2025

**Date de début** : 5 Novembre 2025
**Date de fin** : 5 Novembre 2025
**Statut** : ✅ **VALIDÉE - 100% des tests réussis**

### 📊 Résultats des tests automatisés

Tous les tests Phase 2 ont été exécutés avec succès :

```
=== PHASE 2 TESTS ===

[1/7] GET /api/auth/me        ✅ [OK] Auth - User: charlie.coupe59@gmail.com
[2/7] POST /api/infrastructures ✅ [OK] Infrastructure created
[3/7] GET /api/infrastructures  ✅ [OK] Found 4 infrastructure(s)
[4/7] POST /api/points          ✅ [OK] Created 3 point(s)
[5/7] GET /api/points           ✅ [OK] Found 3 point(s)
[6/7] POST /api/jobs            ✅ [OK] Job created - Status: PENDING
[7/7] GET /api/jobs             ✅ [OK] Found 1 job(s)

=== PHASE 2 TESTS COMPLETED ===
```

### 🏆 Technologies validées

- ✅ **Backend**: Node.js + Express + TypeScript
- ✅ **Database**: PostgreSQL 18 + PostGIS 3.6
- ✅ **ORM**: Prisma avec migrations
- ✅ **Auth**: Supabase JWT réel (HS256)
- ✅ **Validation**: Zod sur toutes les routes
- ✅ **Services**: DatabaseService + HyP3Service (mock)
- ✅ **Spatial**: PostGIS fonctions (ST_GeomFromText, ST_Collect, ST_Envelope)

### 📝 Prochaines étapes

Phase 2 terminée avec succès. Prêt pour Phase 3 : Génération de grille de points 5m.

