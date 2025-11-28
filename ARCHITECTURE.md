# 📚 Architecture : Supabase vs PostgreSQL

## 🔐 Supabase = Authentification uniquement

**Supabase** est utilisé **uniquement** pour l'authentification des utilisateurs :

- ✅ Gestion des comptes utilisateurs (email/password, OAuth, etc.)
- ✅ Génération de tokens JWT pour sécuriser les requêtes
- ✅ Validation des tokens via les clés publiques Supabase

**Ce que Supabase NE stocke PAS :**
- ❌ Les infrastructures
- ❌ Les points de monitoring
- ❌ Les jobs HyP3
- ❌ Les déformations
- ❌ Toute autre donnée métier

## 🗄️ PostgreSQL/PostGIS = Base de données principale

**PostgreSQL avec PostGIS** (via Prisma) stocke **TOUTES les données métier** :

- ✅ Table `users` : synchronisée avec Supabase (via `supabase_id`)
- ✅ Table `infrastructures` : infrastructures surveillées par les utilisateurs
- ✅ Table `points` : points de monitoring géolocalisés (PostGIS POINT)
- ✅ Table `deformations` : données de déformation InSAR par point/date
- ✅ Table `jobs` : jobs de traitement HyP3

## 🔄 Comment ça fonctionne ensemble

```
┌─────────────────┐
│   Frontend      │
│  (Next.js)      │
└────────┬────────┘
         │
         │ 1. Login → Supabase
         ↓
┌─────────────────┐
│   Supabase      │
│  Auth Service   │
└────────┬────────┘
         │
         │ 2. Token JWT
         ↓
┌─────────────────┐
│   Backend       │
│  (Express)      │
└────────┬────────┘
         │
         │ 3. Vérifie token
         │ 4. Upsert user dans PostgreSQL
         │ 5. Stocke données métier
         ↓
┌─────────────────┐
│  PostgreSQL     │
│  + PostGIS      │
│  (via Prisma)   │
└─────────────────┘
```

## 📋 Exemple de flow complet

1. **Utilisateur se connecte** :
   - Frontend → Supabase Auth
   - Supabase retourne un token JWT

2. **Utilisateur crée une infrastructure** :
   - Frontend envoie `POST /api/infrastructures` avec le token JWT
   - Backend vérifie le token via Supabase (clés publiques)
   - Backend upsert l'utilisateur dans PostgreSQL (`users` table)
   - Backend crée l'infrastructure dans PostgreSQL (`infrastructures` table)

3. **Utilisateur ajoute des points** :
   - Frontend envoie `POST /api/points` avec le token
   - Backend vérifie le token
   - Backend crée les points dans PostgreSQL (`points` table avec PostGIS)

## 🎯 Résumé

| Donnée | Stockée dans | Géré par |
|--------|--------------|----------|
| Comptes utilisateurs | Supabase | Supabase Auth |
| Tokens JWT | Supabase | Supabase Auth |
| Email, password | Supabase | Supabase Auth |
| **Infrastructures** | **PostgreSQL** | **Prisma** |
| **Points** | **PostgreSQL** | **Prisma** |
| **Jobs** | **PostgreSQL** | **Prisma** |
| **Déformations** | **PostgreSQL** | **Prisma** |

## 💡 Pourquoi cette architecture ?

- **Supabase** : excellent pour l'auth (gratuit jusqu'à 50k utilisateurs, gestion OAuth intégrée)
- **PostgreSQL/PostGIS** : nécessaire pour les données spatiales (géométries, requêtes spatiales complexes)
- **Prisma** : ORM TypeScript qui facilite l'accès à PostgreSQL

C'est une architecture hybride très courante : auth externe (Supabase) + DB propre (PostgreSQL) pour les données métier.

