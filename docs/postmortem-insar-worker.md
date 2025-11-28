# Postmortem — InSAR worker: jobs non traités et 0 déformations

## Résumé
- Symptôme: jobs HyP3 marqués PROCESSING/SUCCEEDED, mais 0 déformations insérées et aucun log utile.
- Impact: aucun résultat InSAR exploitable, pipeline bloqué.
- Résolution: corrections sur 4 axes (queue BullMQ, Prisma, parsing ZIP/GeoTIFF, logging) + scripts fiables de requeue/vérif.

## Causes racines
- Queue & payload incorrects
  - Les jobs étaient poussés dans `insar-polling` alors que le worker écoute `insar-processing`.
  - Le payload ne contenait pas `hyp3JobId` ni `createdAt` → impossible de poller HyP3 correctement.
- Écriture invalide de statut dans l'ENUM `JobStatus`
  - Tentative d'écrire `RUNNING` directement dans l'ENUM interne via `::"JobStatus"` → erreurs silencieuses.
- Insertions Prisma dans une transaction interactive 5s
  - Insertion ligne-à-ligne dans une transaction interactive → timeout 5000 ms → `Transaction already closed`.
- Détection des GeoTIFF fragile
  - `fs.readdir` récursif pour trouver les fichiers après unzip → rate les sous-dossiers des archives HyP3.
- Bruit de logs massif
  - Logs de projection UTM en `info` → spam, rendant le diagnostic illisible.

## Correctifs appliqués
1) Pipeline BullMQ unifié
- Worker unique: queue `insar-processing` (fichier: `backend/src/workers/insarWorker.ts`).
- Script `requeue_job.js` corrigé: push dans `insar-processing` + payload complet (`jobId`, `hyp3JobId`, `infrastructureId`, `createdAt`).
- Ancien système `insar-polling` (JobQueueService) neutralisé/supprimé.

2) Mapping statut HyP3 → `JobStatus` interne
- RUNNING → PROCESSING
- SUCCEEDED → PROCESSING (le temps de parser/inserer)
- FAILED → FAILED
- sinon → PENDING

3) Insertions fiables sans timeout
- Remplacement de la transaction interactive par **upsert RAW SQL par paquets (1000)**.
- Logs progressifs: `Starting chunked insert` → `Chunk inserted` → `Stored deformations in database`.

4) Détection robuste des GeoTIFF
- Utilisation de `AdmZip.getEntries()` pour lister les entrées et reconstruire des chemins fiables vers `_vert_disp.tif`, `_los_disp.tif`, `_corr.tif`.

5) Logging
- Niveau par défaut `info` (env `LOG_LEVEL` configurable).
- Logs de projection UTM basculés en `debug` (moins de bruit en prod/dev normal).

## Résultat
- Job: SUCCEEDED
- Déformations insérées: 57 750 (vérifié avec `check_deformations.js`).

## Recommandations d’exploitation
- Redis: `noeviction` activé dans `docker-compose.yml`.
- Entretien DB: lancer `VACUUM ANALYZE deformations;` après gros imports (script: `backend/db/maintenance/vacuum_deformations.sql`).
- Idempotence: les upserts permettent de relancer sans doublons.
- Monitoring: garder `check_deformations.js` comme test rapide; ajouter si besoin une route d’healthcheck worker.

## Runbook (requeue + vérif)
1. Démarrer le backend: `cd backend && npm run dev`
2. Requeue dernier job infra: `cd backend && node ../requeue_job.js`
3. Vérifier en DB: `cd backend && node ../check_deformations.js`

## Fichiers impactés
- `backend/src/workers/insarWorker.ts`: import Prisma, mapping statut, détection GeoTIFF, insertion chunkée.
- `backend/src/services/geotiffParser.ts`: logs en `debug` sur la projection.
- `backend/src/utils/logger.ts`: niveau par défaut `info` (env `LOG_LEVEL`).
- `requeue_job.js`: queue + payload corrigés.
- `docker-compose.yml`: Redis `--maxmemory-policy noeviction`.

## Nettoyage
- Supprimer système obsolète `JobQueueService` (`backend/src/services/jobQueueService.ts`) et `geoTiffParserService.ts`.
- Conserver `check_deformations.js` (utile).
- Optionnel: supprimer SQL de test redondants (ex: `backend/check-deformations.sql`, `check_job.sql`, `verify_deformations.sql`).
