# 🛰️ Sentryal - InSAR Monitoring SaaS

**Le SaaS InSAR le plus disruptif du marché**

Monitoring automatisé des déformations d'infrastructures par satellite (InSAR) :
- 🚀 **100-1000× moins cher** que les concurrents
- ⚡ **Automatisation complète** du workflow InSAR
- 🗺️ **Interface moderne** avec carte interactive et heatmap
- 📊 **Données temps réel** depuis Sentinel-1 (gratuit)

---

## 🎯 Objectif

Démocratiser le monitoring InSAR pour rendre la surveillance des infrastructures accessible à tous.

**Pricing** : €0.50/km² vs $50-200/km² (concurrents)

---

## 🏗️ Architecture

```
Frontend (Next.js) → Backend (Express) → PostgreSQL + PostGIS
                           ↓
                     BullMQ Worker → HyP3 NASA API
                           ↓
                     GeoTIFF Parser → Deformations DB
```

**Stack technique** :
- **Frontend** : Next.js 14, TypeScript, TailwindCSS, Mapbox GL JS
- **Backend** : Node.js, Express, TypeScript, Prisma
- **Database** : PostgreSQL 15 + PostGIS 3.4
- **Queue** : BullMQ + Redis
- **InSAR** : NASA HyP3 API (Sentinel-1)

---

## 📋 Prérequis

- **Node.js 18+**
- **Docker & Docker Compose v2**
- **PowerShell** (Windows) ou **Bash** (Linux/Mac)

---

## 🚀 Quick Start

### 1. Installation
```powershell
# Cloner le repo
git clone https://github.com/your-org/sentryal.git
cd sentryal

# Installer les dépendances
npm run bootstrap
```

### 2. Configuration
```powershell
# Copier .env.example
cp .env.example .env

# Éditer .env avec tes tokens
# - EARTHDATA_BEARER_TOKEN (optionnel pour dev)
# - SUPABASE_URL, SUPABASE_JWT_SECRET, SUPABASE_ANON_KEY
```

### 3. Démarrer les services
```powershell
# Avec Docker (recommandé)
docker compose up --build

# Ou dev local
npm run dev
```

### 4. Vérifier
- Frontend : http://localhost:3000
- Backend : http://localhost:5000
- Health check : http://localhost:5000/health

**Voir `QUICKSTART.md` pour le guide complet.**

---

## 📁 Structure du projet

```
sentryal/
├── backend/                    # API Node/Express
│   ├── src/
│   │   ├── routes/            # Routes Express
│   │   ├── services/          # Business logic
│   │   ├── workers/           # BullMQ workers ⭐
│   │   ├── middleware/        # Auth, validation
│   │   └── db/                # Prisma, migrations
│   └── prisma/                # Schema Prisma
├── frontend/                   # Next.js app
│   ├── src/
│   │   ├── pages/             # Pages Next.js
│   │   ├── components/        # React components
│   │   └── lib/               # Utils, API client
├── docker-compose.yml         # Dev environment
├── ROADMAP_COMPLETE.md        # Roadmap détaillée
├── PHASE_4_COMPLETE.md        # Doc Phase 4 ⭐
├── STATUS.md                  # État du projet ⭐
├── QUICKSTART.md              # Guide démarrage ⭐
└── CHANGELOG.md               # Historique ⭐
```

---

## 📊 Progression

| Phase | Statut | Progression |
|-------|--------|-------------|
| Phase 1 (DB) | ✅ Complète | 100% |
| Phase 2 (API) | ✅ Complète | 100% |
| Phase 3 (Onboarding) | ⏳ À faire | 0% |
| Phase 4 (HyP3 + Worker) | ✅ Complète | 100% ⭐ |
| Phase 5 (Dashboard) | ⏳ À faire | 0% |
| Phase 6 (Alerts) | ⏳ À faire | 0% |
| Phase 7 (Intégration) | ⏳ À faire | 0% |
| Phase 8 (Tests) | ⏳ Continu | 0% |

**Progression globale** : 53% du MVP

---

## 🎯 Fonctionnalités

### ✅ Implémentées
- [x] Authentification Supabase
- [x] Gestion infrastructures (CRUD)
- [x] Gestion points de monitoring (PostGIS)
- [x] Création jobs InSAR (HyP3 API)
- [x] **Worker automatique** (polling, download, parsing) ⭐
- [x] **Parser GeoTIFF** (extraction déformations) ⭐
- [x] Stockage déformations en DB
- [x] Logs structurés (Pino)

### ⏳ En cours
- [ ] Génération grille de points (Turf.js)
- [ ] Dashboard avec carte interactive
- [ ] Heatmap des déformations
- [ ] Time-series graphs
- [ ] Alertes automatiques
- [ ] Rapports PDF

---

## 🔥 Phase 4 : Worker InSAR (NOUVEAU)

**Architecture automatisée complète** :

1. **API Route** : Crée un job HyP3
2. **BullMQ Queue** : Ajoute le job à la queue Redis
3. **Worker** : Poll HyP3 API toutes les 30s
4. **Download** : Télécharge les GeoTIFF quand terminé
5. **Parser** : Extrait les déformations (mm)
6. **Storage** : Stocke en PostgreSQL

**Performance** :
- 5 workers en parallèle
- Retry automatique (50 tentatives)
- Parsing : ~2-5s pour 5000 points
- DB insert : ~1-3s pour 5000 déformations

**Voir `PHASE_4_COMPLETE.md` pour la documentation complète.**

---

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Démarrer en 5 minutes
- **[ROADMAP_COMPLETE.md](ROADMAP_COMPLETE.md)** - Roadmap détaillée
- **[PHASE_4_COMPLETE.md](PHASE_4_COMPLETE.md)** - Worker + Parser GeoTIFF
- **[STATUS.md](STATUS.md)** - État du projet
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Architecture technique
- **[CHANGELOG.md](CHANGELOG.md)** - Historique des changements

---

## 🧪 Tests

### Tests réels effectués
- ✅ Job InSAR créé sur HyP3 (Pont de Millau, 4640 points)
- ✅ Job terminé avec succès (SUCCEEDED)
- ✅ Fichiers GeoTIFF téléchargés (vert_disp, los_disp, corr)
- ✅ Heatmap visualisée dans QGIS
- ✅ Déformations de 0 à 59 mm détectées

### Lancer les tests
```powershell
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

---

## 🐛 Troubleshooting

Voir `QUICKSTART.md` section Troubleshooting.

**Problèmes courants** :
- Redis non démarré → `docker run -d --name redis -p 6379:6379 redis:7-alpine`
- PostgreSQL non démarré → `docker compose up postgres`
- Worker non démarré → Vérifier les logs : "InSAR worker initialized"

---

## 🤝 Contribution

Ce projet est en développement actif. Contributions bienvenues !

**Workflow** :
1. Fork le repo
2. Crée une branche (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvre une Pull Request

---

## 📝 License

MIT License - voir `LICENSE` pour détails.

---

## 🚀 Roadmap

**MVP (15 novembre 2025)** :
- ✅ Phase 1-2-4 complètes
- ⏳ Phase 3 : Génération grille (2-3 jours)
- ⏳ Phase 5 : Dashboard (2 jours)
- ⏳ Phase 6-7-8 : Alerts, intégration, tests

**Post-MVP** :
- Série temporelle (multi-dates)
- Prédictions ML
- API publique
- Mobile app
- White-label

---

## 💪 Built with

- [Next.js](https://nextjs.org/) - React framework
- [Express](https://expressjs.com/) - Backend framework
- [Prisma](https://www.prisma.io/) - ORM
- [PostGIS](https://postgis.net/) - Spatial database
- [BullMQ](https://docs.bullmq.io/) - Queue system
- [geotiff.js](https://geotiffjs.github.io/) - GeoTIFF parser
- [NASA HyP3](https://hyp3-docs.asf.alaska.edu/) - InSAR processing

---

## 🌟 Star History

Si ce projet t'aide, mets une ⭐ !

---

**LET'S BUILD THE REVOLUTION ! 🚀🚀🚀**
