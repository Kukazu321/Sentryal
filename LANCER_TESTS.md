# 🧪 COMMENT LANCER LES TESTS

## ✅ CONFIGURATION TERMINÉE

Tout est prêt pour les tests complets !

---

## 🚀 LANCER LES TESTS EN 1 COMMANDE

```powershell
.\test_all.ps1
```

**Ce qui sera testé :**
- ✅ Phase 1 : Infrastructure CRUD (3 tests)
- ✅ Phase 3 : Grid Generation (3 tests)
- ✅ Phase 4 : InSAR Processing (4 tests)

**Durée** : 3-5 minutes (mode MOCK)

---

## 📊 RÉSULTAT ATTENDU

```
╔════════════════════════════════════════════╗
║  SENTRYAL - TESTS COMPLETS                 ║
║  Validation Phases 1-4                     ║
╚════════════════════════════════════════════╝

═══ PHASE 1 : INFRASTRUCTURE ═══

[1.1] POST /api/infrastructures
  ✓ Infrastructure créée (ID: 4b726789...)

[1.2] GET /api/infrastructures
  ✓ Infrastructures listées (5 trouvées)

[1.3] GET /api/infrastructures/:id
  ✓ Infrastructure récupérée

═══ PHASE 3 : GRID GENERATION ═══

[3.1] POST /api/onboarding/estimate (DRAW)
  ✓ Estimation: 3750 points, €37.50/mois

[3.2] POST /api/onboarding/generate-grid
  ✓ Grille générée: 3750 points en 850ms

[3.3] GET /api/points
  ✓ Points récupérés: 3750

═══ PHASE 4 : INSAR PROCESSING ═══

[4.1] POST /api/jobs/process-insar
  ✓ Job InSAR créé (Mode: MOCK, HyP3 ID: mock-job-123...)

[4.2] GET /api/jobs/:id
  ✓ Status job: PENDING

[4.3] Attente progression job (max 3 min)...
  [1/18] Status: PENDING
  [2/18] Status: RUNNING
  [3/18] Status: SUCCEEDED
  ✓ Job terminé avec succès

[4.4] GET /api/deformations
  ✓ Déformations: 3750, Moyenne: -1.2 mm

╔════════════════════════════════════════════╗
║  RÉSULTATS TESTS                           ║
╚════════════════════════════════════════════╝

✓ Tests réussis: 10
✗ Tests échoués: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 10 tests (100% succès)

🎉 TOUS LES TESTS SONT PASSÉS ! 🎉
Ton SaaS est 100% fonctionnel ! 🚀
```

---

## 🔧 PRÉREQUIS

### 1. Backend Démarré

```powershell
cd backend
npm run dev
```

**Vérifier que tu vois :**
```
[INFO] Backend listening on http://localhost:5000
[INFO] Redis connected successfully
[INFO] Database connection established
```

### 2. Redis Actif

```powershell
docker ps --filter "name=redis"
```

**Doit afficher :**
```
CONTAINER ID   IMAGE            STATUS
bcc109d28f62   redis:7-alpine   Up X minutes
```

### 3. Token Supabase Valide

Le token dans `test_all.ps1` ligne 14 doit être valide (< 1 heure).

**Si expiré :**
```powershell
.\get_token.ps1
# Copie le nouveau token
# Mets à jour test_all.ps1 ligne 14
```

---

## 📁 FICHIERS DE TEST

| Fichier | Description |
|---------|-------------|
| `test_all.ps1` | Script principal de test |
| `test_infra_simple.json` | Template infrastructure |
| `test_grid.json` | Template grille |
| `test_job_insar.json` | Template job InSAR |

**Ces fichiers sont utilisés automatiquement par `test_all.ps1`**

---

## ❓ TROUBLESHOOTING

### ❌ Erreur 401 (Unauthorized)

**Cause :** Token Supabase expiré

**Solution :**
```powershell
.\get_token.ps1
# Mets à jour test_all.ps1 ligne 14
```

### ❌ Erreur 400 (Bad Request)

**Cause :** Format JSON invalide

**Solution :** Les fichiers JSON sont déjà corrects, ne les modifie pas !

### ❌ Backend non accessible

**Cause :** Backend non démarré

**Solution :**
```powershell
cd backend
npm run dev
```

### ❌ Redis non connecté

**Cause :** Redis non démarré

**Solution :**
```powershell
docker-compose up -d redis
```

---

## 🎯 TESTS INDIVIDUELS

Si tu veux tester une phase spécifique :

### Test Phase 1 (Infrastructure)

```powershell
$token = "TON_TOKEN"
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$body = Get-Content "test_infra_simple.json" -Raw
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/infrastructures" -Headers $headers -Body $body
```

### Test Phase 3 (Grid)

```powershell
# Remplace INFRA_ID par ton ID d'infrastructure
$body = (Get-Content "test_grid.json" -Raw) -replace "PLACEHOLDER_ID", "INFRA_ID"
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/onboarding/generate-grid" -Headers $headers -Body $body
```

### Test Phase 4 (InSAR)

```powershell
# Remplace INFRA_ID par ton ID d'infrastructure
$body = (Get-Content "test_job_insar.json" -Raw) -replace "PLACEHOLDER_ID", "INFRA_ID"
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/jobs/process-insar" -Headers $headers -Body $body
```

---

## 📝 APRÈS LES TESTS

### Si Tous les Tests Passent ✅

**TON SAAS EST 100% FONCTIONNEL !**

Tu peux :
1. Tester avec vraie API HyP3 (changer `NODE_ENV=production`)
2. Passer à Phase 5 (Dashboard)
3. Déployer en production

### Si Certains Tests Échouent ❌

1. Note le numéro du test qui échoue
2. Vérifie les logs backend
3. Vérifie le message d'erreur
4. Consulte `TROUBLESHOOTING.md`

---

## 🚀 COMMANDE RAPIDE

```powershell
# Tout en 1 (si backend déjà démarré)
.\test_all.ps1
```

**C'EST TOUT ! 🎉**

---

## 📊 MÉTRIQUES DE PERFORMANCE

| Opération | Temps Attendu |
|-----------|---------------|
| Créer infrastructure | < 100ms |
| Générer grille (3750 pts) | < 1s |
| Créer job InSAR | < 500ms |
| Polling job (mock) | 3 minutes |
| Total tests | 3-5 minutes |

---

**LANCE `.\test_all.ps1` MAINTENANT ! 🔥**
