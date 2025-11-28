# Phase 1 : Fondations DB et schéma — STATUT

## ✅ Complété automatiquement

1. **PostgreSQL + PostGIS**
   - ✅ Docker Compose modifié pour utiliser `postgis/postgis:15-3.4`
   - ✅ Script d'init SQL créé : `backend/db/init/001_init_postgis.sql`
   - ✅ Extension PostGIS activée automatiquement au démarrage du conteneur

2. **Schéma de base**
   - ✅ Schema Prisma créé : `backend/prisma/schema.prisma`
   - ✅ Toutes les tables définies :
     - `users` (id, email, supabase_id, stripe_customer_id, preferences JSONB)
     - `infrastructures` (id, user_id FK, name, type, bbox GEOMETRY, mode_onboarding ENUM)
     - `points` (id, infrastructure_id FK, geom GEOMETRY POINT, soil_type)
     - `deformations` (id, point_id FK, date, displacement_mm, job_id)
     - `jobs` (id, infrastructure_id FK, hy3_job_id, status ENUM, bbox GEOMETRY)
   - ✅ Index créés (spatiaux GIST pour PostGIS, index composites pour performance)

3. **Migrations**
   - ✅ Migration Prisma initiale : `backend/prisma/migrations/000_init/migration.sql`
   - ✅ Conversion des colonnes texte en GEOMETRY PostGIS
   - ✅ Index spatiaux GIST créés automatiquement
   - ✅ Script de migration : `backend/src/db/migrate.ts`
   - ✅ Migrations lancées automatiquement au démarrage du serveur

4. **Configuration**
   - ✅ Prisma installé et configuré
   - ✅ Client Prisma : `backend/src/db/client.ts`
   - ✅ Scripts npm ajoutés : `prisma:generate`, `prisma:migrate`, `prisma:studio`
   - ✅ README mis à jour avec documentation

## 🎯 Actions exécutées (Phase 1)

### 3. Démarrer PostgreSQL avec Docker — ✅ FAIT

```bash
# À la racine du projet
docker compose up postgres -d
```

### 4. Générer le client Prisma — ✅ FAIT

```bash
cd backend
npm run prisma:generate
```

### 5. Lancer les migrations (première fois) — ✅ FAIT

Migrations appliquées (via le SQL initial `prisma/migrations/000_init/migration.sql`).

```bash
cd backend
npx prisma migrate deploy
```

### 6. Vérifier que tout fonctionne — ✅ FAIT

```bash
docker compose exec postgres psql -U postgres -d sentryal -c "SELECT PostGIS_version();"
docker compose exec postgres psql -U postgres -d sentryal -c "\dt"
```

### 7. Démarrer le serveur backend — ✅ FAIT

```bash
cd backend
npm run dev
```

## 🧪 Tests de vérification

### Vérifier PostGIS

```bash
# Se connecter à PostgreSQL
docker compose exec postgres psql -U postgres -d sentryal

# Dans psql :
SELECT PostGIS_version();
```

Vous devriez voir la version de PostGIS (ex: `3.4.0`).

### Vérifier les tables

```bash
# Dans psql :
\dt
```

Vous devriez voir :
- users
- infrastructures
- points
- deformations
- jobs

### Vérifier les index spatiaux

```bash
# Dans psql :
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('points', 'infrastructures', 'jobs');
```

Vous devriez voir les index GIST pour les colonnes géométriques.

## 📝 Notes importantes

1. **Types PostGIS** : Prisma ne supporte pas nativement les types PostGIS (GEOMETRY). Les colonnes sont définies comme `TEXT` dans le schema Prisma, puis converties en `GEOMETRY` via la migration SQL. Vous devrez utiliser `ST_GeomFromText()` et `ST_AsText()` dans vos requêtes.

2. **Migrations automatiques** : Les migrations s'exécutent automatiquement au démarrage du serveur. Pour désactiver, mettre `RUN_MIGRATIONS=false` dans `.env`.

3. **Prisma Studio** : Outil visuel pour explorer la base de données. Utile pour vérifier les données et tester les requêtes.

4. **Prochaines étapes** : Une fois la Phase 1 validée, passer à la Phase 2 (API routes).

## ⚠️ Problèmes potentiels

- **PostGIS non activé** : Vérifier que le script `001_init_postgis.sql` est bien dans `backend/db/init/`
- **Migrations échouent** : Vérifier que `DATABASE_URL` est correct dans `.env`
- **Client Prisma non généré** : Lancer `npm run prisma:generate`

## ✅ Phase 1 terminée quand...

- ✅ PostgreSQL avec PostGIS fonctionne
- ✅ Toutes les tables sont créées
- ✅ Les index spatiaux sont présents
- ✅ Le client Prisma est généré
- ✅ Le serveur backend démarre sans erreur

---

**Date de début** : [Renseignée]
**Date de fin** : [Aujourd'hui]
**Statut** : 🟢 Phase 1 terminée

