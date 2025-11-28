# Sentryal Backend

API Node.js/Express avec TypeScript pour le projet Sentryal.

## Prérequis

- Node.js 18+
- Docker & Docker Compose (pour PostgreSQL)
- PostgreSQL 15 avec PostGIS

## Installation

```bash
# Installer les dépendances
npm install

# Générer le client Prisma
npm run prisma:generate
```

## Configuration

Copier `.env.example` vers `.env` et configurer :

```bash
cp .env.example .env
```

Variables importantes :
- `DATABASE_URL` : URL de connexion PostgreSQL
- `SUPABASE_URL` et `SUPABASE_JWT_SECRET` : Pour la vérification JWT

## Base de données

### Avec Docker Compose

```bash
# Démarrer PostgreSQL avec PostGIS
docker compose up postgres -d

# Lancer les migrations
npm run prisma:migrate

# Ou en production
npm run prisma:migrate:deploy
```

### Migrations

Les migrations Prisma sont dans `prisma/migrations/`. Le schéma est défini dans `prisma/schema.prisma`.

**Important** : Les types PostGIS (GEOMETRY) sont gérés via des migrations SQL manuelles car Prisma ne les supporte pas nativement. Voir `prisma/migrations/000_init/migration.sql`.

### Prisma Studio

Interface visuelle pour la base de données :

```bash
npm run prisma:studio
```

## Développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:5000`.

Les migrations sont automatiquement lancées au démarrage du serveur.

## Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Schéma Prisma
│   └── migrations/            # Migrations SQL
├── src/
│   ├── db/
│   │   ├── client.ts         # Client Prisma
│   │   └── migrate.ts         # Script de migration
│   ├── routes/                # Routes Express
│   ├── utils/                 # Utilitaires
│   └── index.ts               # Point d'entrée
└── package.json
```

## Schéma de base de données

- **users** : Utilisateurs (liés à Supabase Auth)
- **infrastructures** : Infrastructures surveillées (avec bbox GEOMETRY)
- **points** : Points de monitoring (avec geom GEOMETRY POINT)
- **deformations** : Données de déformation InSAR par point/date
- **jobs** : Jobs HyP3 de traitement InSAR

Toutes les colonnes géométriques utilisent PostGIS (GEOMETRY avec SRID 4326).
