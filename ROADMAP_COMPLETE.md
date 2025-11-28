## Plan d'action MVP — roadmap complète
### Phase 1 : Fondations DB et schéma (priorité 1)
**PostgreSQL + PostGIS**

Activer PostGIS dans le conteneur Docker (ajouter postgis/postgis:15-3.4 ou installer l'extension dans le conteneur existant). Créer un script d'init SQL qui exécute CREATE EXTENSION IF NOT EXISTS postgis; au démarrage. Sans PostGIS, pas de géométries ni requêtes spatiales.
**Schéma de base**
Table users (id, email, supabase_id, stripe_customer_id, created_at, preferences JSONB pour alertes/thresholds). Lier supabase_id à Supabase Auth pour éviter les doublons.
Table infrastructures (id, user_id FK, name, type, created_at, bbox GEOMETRY(POLYGON, 4326) pour la zone, mode_onboarding ENUM). Stocker le bbox final pour les requêtes HyP3.
Table points (id, infrastructure_id FK, geom GEOMETRY(POINT, 4326), soil_type VARCHAR, created_at). Index spatial GIST sur geom pour les requêtes spatiales. Calculer soil_type via Copernicus après la création des points.
Table deformations (id, point_id FK, date DATE, displacement_mm DECIMAL(10,3), job_id VARCHAR, created_at). Structure JSONB pour stocker les time-series (dates + mm) par point, plus rapide que JOIN sur une table de dates. Index composite sur (point_id, date).
Table jobs (id, infrastructure_id FK, hy3_job_id VARCHAR, status ENUM, bbox GEOMETRY, created_at, completed_at). Traçabilité des jobs HyP3.
**Migrations**
Utiliser Prisma ou Knex.js avec migrations versionnées. Créer migrations/001_init_postgis.sql puis 002_create_tables.sql. Pour Prisma, ajouter PostgisExtension dans le schema et définir les modèles avec @db.Geometry pour les champs spatiaux. Lancer les migrations au démarrage du backend ou via script dédié.
**Pourquoi en premier**
Sans schéma, pas de persistance. Les formulaires frontend envoient des données qui ne sont pas stockées. Le schéma définit aussi les relations entre entités et les contraintes.


### Phase 2 : Backend API — routes de base (priorité 2)
**Routes Express structurées**

/api/auth/me (GET) : vérifie le JWT Supabase, renvoie user_id depuis la table users (upsert si absent). Middleware verifySupabaseJWT qui décode le token, vérifie la signature avec la clé publique Supabase, extrait user.id.
/api/infrastructures (GET, POST) : liste les infrastructures d'un user, création avec validation de bbox. POST accepte name, type, bbox (GeoJSON) et mode_onboarding. Validation avec Joi ou Zod.
/api/points (GET, POST) : liste les points d'une infrastructure, création en batch. POST accepte un array de {lat, lng} ou un GeoJSON FeatureCollection. Batch insert via pg-copy-streams si >1000 points.
/api/jobs (GET, POST) : liste les jobs d'une infrastructure, création d'un job HyP3. POST /api/jobs valide les points, génère le bbox agrégé, appelle un service HyP3Service.createJob() qui retourne job_id, stocke en DB.
**Middleware d'authentification**
authMiddleware : vérifie le JWT dans Authorization: Bearer <token>, injecte req.userId. Placé avant les routes protégées. Gestion des erreurs 401/403.
**Service layer**
DatabaseService : wrapper autour de pg avec helpers pour requêtes PostGIS (ST_MakePoint, ST_Envelope, ST_Contains). Méthodes getUserInfrastructures(userId), createPoints(infrastructureId, points[]), getPointsInBbox(bbox).
HyP3Service : client TypeScript pour l'API HyP3 (Earthdata OAuth, POST /jobs, GET /jobs/{id}). Gérer les tokens OAuth (refresh si expiré), retry avec backoff exponentiel, parsing des réponses.
**Pourquoi maintenant**
Le frontend a des formulaires mais pas de backend pour recevoir les données. Sans routes, pas de persistance ni de traitement.


### Phase 3 : Onboarding — génération de grille (priorité 3)

#### Le pitch en 10 secondes (tu le répètes à chaque client)
> « Sentinel-1 (satellite radar gratuit) passe **tous les 6 jours** au-dessus de ton barrage.  
> Il voit **1 pixel tous les 5 mètres**.  
> Je transforme ton plan en **capteurs virtuels** (1 point = 1 pixel).  
> Ensuite **HyP3 (NASA/ESA)** me donne **combien de mm chaque point a bougé**.  
> Tu paies 0,005 € par point/mois → 250 k points = 1 250 €/mois. »
en gros:
1. Il ouvre la carte  
2. Il clique 4 fois → un carré autour du barrage  
   → 4 points = 1 polygone

code reçoit ça
{
  "infrastructure_id": 42,
  "mode": "draw",
  "polygon": {
    "type": "Polygon",
    "coordinates": [[ [5.71,46.04], [5.73,46.04], [5.73,46.06], [5.71,46.06] ]]
  }
}

ON GÉNÈRE LA GRILLE 5 MÈTRES
On utilise Turf.js (la bibliothèque magique des cartes)
// 1. On prend les 4 coins du dessin
const userPolygon = req.body.polygon;

// 2. On crée une grille de points TOUS LES 5 MÈTRES
const grille = turf.pointGrid(
  turf.bbox(userPolygon),  // le rectangle autour du dessin
  5,                       // ESPACEMENT = 5 mètres
  { units: 'meters' }
);

// 3. On garde SEULEMENT les points DEDANS le dessin
const pointsDedans = grille.features.filter(point =>
  turf.booleanPointInPolygon(point, userPolygon)
);

resultat, milliers d'objets commme ça 
{ lat: 46.0421, lng: 5.7193 }
{ lat: 46.0421, lng: 5.7198 }
{ lat: 46.0426, lng: 5.7193 }
…
ON BALANCE TOUT EN BASE

**Route POST /api/onboarding/generate-grid**

Accepte infrastructure_id, mode_onboarding (adresse/draw/shp), input_data (adresse string, GeoJSON polygon, ou fichier SHP via multer). Validation selon le mode.
**Génération de grille**
Mode Adresse : appeler OpenStreetMap Nominatim pour geocoder l'adresse en bbox. Si résultat, générer la grille.
Mode Draw : utiliser le polygon GeoJSON fourni.
Mode SHP : multer upload vers tmp/, parser avec shapefile ou @mapbox/shapefile. Extraire le polygon, nettoyer le fichier tmp après parsing.
**Algorithme de grille 5m**
Utiliser Turf.js turf.squareGrid() avec cellSide: 0.000045 (≈5m en degrés à l'équateur). Ajuster selon la latitude. Filtrer avec turf.booleanPointInPolygon() pour garder les points dans le polygon. Convertir en array de {lat, lng}.
**Insertion en DB**
Pour chaque point, INSERT INTO points (infrastructure_id, geom) VALUES (?, ST_MakePoint(?, ?)) avec ST_SetSRID(ST_MakePoint(lng, lat), 4326). Transaction pour rollback en cas d'erreur. Batch insert si >1000 points.
**Soil type (Copernicus)**
Après insertion, pour chaque point, appeler Copernicus Land Service API (ou mock en dev) avec lat/lng pour obtenir soil_type. UPDATE points SET soil_type = ? WHERE id = ?. Optionnel pour MVP, faire en background job.
**Pourquoi maintenant**
L'onboarding génère les points à analyser. Sans grille, pas de points, pas d'analyse.


### Phase 4 : Intégration HyP3 — traitement InSAR (priorité 4)
**Service HyP3 complet**

HyP3Service : OAuth Earthdata (credentials en env), POST /jobs avec payload {bbox, products: ['RTC', 'GEO'], time_range}, polling GET /jobs/{id} toutes les 30s jusqu'à status: 'SUCCEEDED'. Parser les URLs de téléchargement (CSV/GeoTIFF).
**Route POST /api/process-insar**
Valider infrastructure_id, vérifier que des points existent, calculer bbox agrégé avec SELECT ST_Envelope(ST_Collect(geom)) FROM points WHERE infrastructure_id = ?. Appeler HyP3Service.createJob(), stocker job_id en DB avec status: 'PENDING'. Retourner job_id au frontend.
**Polling asynchrone**
Job queue avec BullMQ + Redis (ou simple setTimeout en dev). Worker qui poll /jobs/{id} toutes les 30s. Quand status: 'SUCCEEDED', télécharger les CSV/GeoTIFF, parser les données (PapaParse pour CSV, GDAL Node pour GeoTIFF), extraire displacement_mm par point/date, INSERT INTO deformations (point_id, date, displacement_mm, job_id). Mettre à jour jobs.status = 'COMPLETED'.
**Webhook HyP3 (optionnel)**
Route /api/webhooks/hy3-callback qui reçoit les notifications HyP3. Sécuriser avec signature vérification si disponible.
**Mock dev**
Si NODE_ENV=development, HyP3Service retourne des données mockées (faker.js, normal distribution 0-5mm). Stocker quand même en DB pour tester le flow complet.
**Pourquoi maintenant**
L'analyse InSAR est le cœur fonctionnel. Sans traitement, les points restent sans données.


### Phase 5 : Dashboard — visualisation (priorité 5)
**Route GET /api/dashboard/:infrastructureId**

Retourner infrastructure, points[] avec geom, deformations[] agrégées (time-series), jobs[] avec statuts. Requêtes PostGIS pour SELECT geom, ST_AsGeoJSON(geom) as geojson FROM points. Optimiser avec ST_AsGeoJSON(ST_Transform(geom, 3857)) si besoin pour Leaflet.
**Frontend Leaflet**
Page /dashboard/:id avec carte Leaflet. Charger les points via GET /api/dashboard/:id, créer des markers ou heatmap. Clic sur un point ouvre un modal avec graphique time-series (Chart.js ou Recharts) depuis deformations[].
**Heatmap D3/Leaflet.heat**
Calculer displacement_mm moyen par point (dernière date ou moyenne temporelle), mapper en couleurs (jaune <1mm, orange 1-2mm, rouge >2mm). Utiliser leaflet.heat ou D3.js pour le rendu.
**Time-series graph**
Modal avec Chart.js line chart (dates[] vs displacement_mm[]). Filtrer les données pour les 6 derniers mois. Afficher coords, soil_type, métadonnées.
**Pourquoi maintenant**
Le dashboard visualise les résultats. Sans visualisation, les données restent inexploitables.


### Phase 6 : Alerts et rapports (priorité 6)
**Alerts**

Cron job (node-cron) toutes les heures qui SELECT * FROM deformations WHERE date = CURRENT_DATE - 1 AND displacement_mm > threshold. Pour chaque point, récupérer user.preferences.alert_threshold et user.email. Si seuil dépassé, envoyer email via SendGrid/Twilio (ou mock en dev). Optionnel : PG trigger sur INSERT deformations qui déclenche une fonction PL/pgSQL qui vérifie le seuil et envoie l'alert (plus réactif que cron).
**Rapports PDF**
Route /api/reports/:infrastructureId/pdf qui génère un PDF avec jsPDF. html2canvas pour capturer la carte Leaflet, embed CSV des deformations, métadonnées infrastructure. Retourner le PDF en stream ou stocker en S3.
**Pourquoi maintenant**
Les alerts rendent le système proactif. Les rapports permettent l'export pour les utilisateurs.


### Phase 7 : Intégration frontend ↔ backend (priorité 7)
**Connecter les formulaires**

Page /auth/trial : POST /api/infrastructures avec les données du formulaire, création de l'infrastructure, puis appel à /api/onboarding/generate-grid si mode fourni. Page /contact : POST /api/contact (nouvelle table contacts ou email direct).
**Auth flow**
Dans _app.tsx ou middleware Next.js, récupérer le token Supabase depuis la session, l'injecter dans les headers Authorization pour toutes les requêtes API (via fetch wrapper ou axios interceptor). Backend vérifie le token et renvoie les données.
**Gestion des états**
React Query ou SWR pour cache/refetch automatique. Gérer les états de chargement (job pending, completed, error).
**Pourquoi maintenant**
Sans intégration, frontend et backend restent déconnectés. Les formulaires doivent persister en DB.


### Phase 8 : Tests et monitoring (priorité 8)
**Tests unitaires**

Jest pour les services (HyP3Service, DatabaseService). Mocks pour les APIs externes.
**Tests d'intégration**
Supertest pour tester les routes Express avec DB de test. Scénarios : création infrastructure → génération grille → job HyP3 → visualisation dashboard.
**Monitoring**
Logging structuré (Pino déjà installé). Ajouter des logs pour les jobs HyP3, erreurs DB, temps de traitement. Optionnel : Sentry pour erreurs frontend/backend.
**Pourquoi maintenant**
Les tests garantissent la stabilité. Le monitoring permet de détecter les problèmes en production.


## Ordre d'exécution recommandé

Phase 1 (DB) — 2-3 jours
Phase 2 (API base) — 2 jours
Phase 7 (Intégration front-back) — 1 jour
Phase 3 (Onboarding) — 2-3 jours
Phase 4 (HyP3) — 3-4 jours
Phase 5 (Dashboard) — 2 jours
Phase 6 (Alerts/Rapports) — 1-2 jours
Phase 8 (Tests) — continu
Total estimé : 13-17 jours pour un MVP testable.

## Blocs techniques à creuser
**PostGIS setup**

Dans docker-compose.yml, utiliser postgis/postgis:15-3.4 ou installer l'extension dans un init script. Vérifier avec SELECT PostGIS_version();.
**HyP3 OAuth**
Earthdata OAuth nécessite un compte, credentials en env, gestion du refresh token. Documentation NASA Earthdata.
**Performance grille 400K points**
Batch insert avec pg-copy-streams, index GIST sur geom, partition par infrastructure_id si >1M points. Pour les requêtes, utiliser ST_Intersects avec index spatial.
**Latency HyP3**
Jobs asynchrones (polling ou webhook), UI avec statuts (pending, processing, completed), notifications push si nécessaire.
Cette roadmap part de l'existant (front UI + infra back) et construit progressivement les fonctionnalités jusqu'à un MVP testable.