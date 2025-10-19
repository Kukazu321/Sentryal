# Sentryal

Base technique pour le projet SaaS "Sentryal".

Objectif: structure modulaire, TypeScript partout, Next.js frontend + Node/Express backend + PostgreSQL, prête pour Docker.

Ports exposés (dev):

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

Prérequis

- Docker & Docker Compose v2
- Node.js 18+

Quick start (avec Docker)

```powershell
# à la racine
docker compose up --build
```

Quick start (dev local sans Docker)

```powershell
npm run bootstrap
npm run dev
```

Structure

- /backend - API Node/Express (TypeScript)
- /frontend - Next.js (TypeScript + TailwindCSS + shadcn/ui)
- docker-compose.yml - orchestration pour dev
- .env.example - variables d'environnement

Voir les README dans `backend/` et `frontend/` pour détails spécifiques.
