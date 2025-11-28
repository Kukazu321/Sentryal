# 🔑 COMMENT OBTENIR LE TOKEN SUPABASE

## ❓ C'est Quoi Ce Token ?

C'est le **token d'authentification** que tu obtiens quand tu te connectes à ton compte !

**Même token que :**
- Quand tu te connectes sur `localhost:3000/auth/login`
- Quand tu utilises l'API
- Quand tu fais des requêtes authentifiées

---

## 🎯 MÉTHODE RAPIDE (RECOMMANDÉE)

### Lance le Script Automatique

```powershell
.\get_token.ps1
```

**Ce qui se passe :**
1. Le script te demande ton mot de passe
2. Il se connecte à Supabase
3. Il récupère le token
4. Il le copie dans ton presse-papier
5. Tu le colles dans `test_all.ps1`

**Exemple :**
```
🔑 Génération Token Supabase...
Entre ton mot de passe Supabase: ********

✅ Token obtenu avec succès !

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOKEN:
eyJhbGciOiJIUzI1NiIsImtpZCI6IlczVXgwbVdEQUxiVXNYNUEi...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Token copié dans le presse-papier !

📝 Prochaines étapes:
  1. Ouvre test_all.ps1
  2. Ligne 13, remplace le token par celui ci-dessus
  3. Lance: .\test_all.ps1
```

---

## 🎯 MÉTHODE MANUELLE (Via Frontend)

### 1️⃣ Lance le Frontend

```powershell
cd frontend
npm run dev
```

### 2️⃣ Connecte-toi

Ouvre ton navigateur :
```
http://localhost:3000/auth/login
```

**Identifiants :**
- Email : `charlie.coupe59@gmail.com`
- Password : ton mot de passe

### 3️⃣ Récupère le Token

**Option A : Console du Navigateur**

1. Appuie sur `F12` (DevTools)
2. Va dans l'onglet **Console**
3. Tape :
   ```javascript
   localStorage.getItem('supabase.auth.token')
   ```
4. Copie le token affiché

**Option B : Local Storage**

1. Appuie sur `F12` (DevTools)
2. Va dans l'onglet **Application**
3. Dans le menu de gauche : **Local Storage** → `http://localhost:3000`
4. Cherche la clé `supabase.auth.token`
5. Copie la valeur

### 4️⃣ Mets à Jour le Script

```powershell
# Ouvre test_all.ps1
# Ligne 13, remplace :
$token = "COLLE_TON_TOKEN_ICI"
```

---

## 🎯 MÉTHODE DIRECTE (PowerShell)

Si tu veux le faire en une commande :

```powershell
# Remplace TON_MOT_DE_PASSE par ton vrai mot de passe
$password = "TON_MOT_DE_PASSE"

$body = @{
    email = "charlie.coupe59@gmail.com"
    password = $password
} | ConvertTo-Json

$response = Invoke-RestMethod `
    -Method Post `
    -Uri "https://gwxdnekddmbeskaegdtu.supabase.co/auth/v1/token?grant_type=password" `
    -Headers @{
        apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3eGRuZWtkZG1iZXNrYWVnZHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjg2ODcsImV4cCI6MjA3Nzg0NDY4N30.wTWsTj2uyv0J6cAZf_qHP1POQjIkOKpBGc-HSPgXrT0"
        "Content-Type" = "application/json"
    } `
    -Body $body

# Affiche le token
Write-Host $response.access_token

# Copie dans le presse-papier
$response.access_token | Set-Clipboard
```

---

## 📝 APRÈS AVOIR OBTENU LE TOKEN

### 1. Mets à Jour test_all.ps1

```powershell
# Ouvre le fichier
code test_all.ps1

# Ligne 13, remplace :
$token = "eyJhbGciOiJIUzI1NiIsImtpZCI6IlczVXgwbVdEQUxiVXNYNUEi..."
```

### 2. Lance les Tests

```powershell
.\test_all.ps1
```

**Résultat attendu :**
```
╔════════════════════════════════════════════╗
║  SENTRYAL - TESTS COMPLETS                 ║
║  Validation Phases 1-4                     ║
╚════════════════════════════════════════════╝

═══ PHASE 1 : INFRASTRUCTURE ═══

[1.1] POST /api/infrastructures
  ✓ Infrastructure créée (ID: abc12345...)

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

## ❓ FAQ

### Le token expire quand ?

Le token Supabase expire après **1 heure** par défaut.

**Si le token expire :**
1. Relance `.\get_token.ps1`
2. Récupère un nouveau token
3. Mets à jour `test_all.ps1`

### Je peux utiliser le même token partout ?

**OUI !** Le même token fonctionne pour :
- Les tests (`test_all.ps1`)
- Les requêtes API manuelles
- Le frontend (automatique)
- Postman / Insomnia

### C'est quoi la différence avec le token Earthdata ?

| Token | Usage | Durée |
|-------|-------|-------|
| **Supabase** | Authentification utilisateur | 1 heure |
| **Earthdata** | API HyP3 (NASA) | 60 jours |

**Supabase** : Pour accéder à TON API  
**Earthdata** : Pour accéder à l'API NASA

---

## 🚀 RÉSUMÉ ULTRA-SIMPLE

### 1 COMMANDE POUR TOUT FAIRE

```powershell
# 1. Obtenir le token
.\get_token.ps1

# 2. Copier le token affiché

# 3. Ouvrir test_all.ps1
code test_all.ps1

# 4. Ligne 13, coller le token
$token = "CTRL+V"

# 5. Sauvegarder et lancer
.\test_all.ps1
```

**C'EST TOUT ! 🎉**

---

## 💡 ASTUCE

Si tu veux éviter de mettre à jour le token à chaque fois, tu peux le stocker dans une variable d'environnement :

```powershell
# Dans ton profil PowerShell
$env:SUPABASE_TOKEN = "ton_token_ici"

# Dans test_all.ps1, utilise :
$token = $env:SUPABASE_TOKEN
```

Mais attention : le token expire après 1 heure !

---

**MAINTENANT TU SAIS COMMENT OBTENIR LE TOKEN ! 🔥**

**Lance `.\get_token.ps1` et c'est parti ! 🚀**
