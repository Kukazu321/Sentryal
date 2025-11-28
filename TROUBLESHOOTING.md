# 🔧 Résolution : Erreur de connexion PostgreSQL

## Problème identifié

Le backend démarre mais ne peut pas se connecter à PostgreSQL car :
1. **Docker Desktop n'est pas démarré** (ou PostgreSQL n'est pas lancé)
2. Le backend tentait de faire `process.exit(1)` si la connexion échouait

## ✅ Corrections apportées

1. ✅ Le backend ne fait plus `process.exit(1)` en développement si la DB n'est pas disponible
2. ✅ Les migrations ne bloquent plus le démarrage si elles échouent en dev
3. ✅ Le serveur démarre même si PostgreSQL n'est pas encore prêt

## 🚀 Solution : Démarrer PostgreSQL

### Étape 1 : Démarrer Docker Desktop

1. Ouvre **Docker Desktop** sur Windows
2. Attends que Docker soit complètement démarré (icône Docker dans la barre des tâches)

### Étape 2 : Démarrer PostgreSQL

```bash
# À la racine du projet
docker compose up postgres -d
```

**Si les variables d'environnement ne sont pas définies**, utilise :

```bash
$env:POSTGRES_USER='postgres'; $env:POSTGRES_PASSWORD='postgres'; $env:POSTGRES_DB='sentryal'; docker compose up postgres -d
```

### Étape 3 : Vérifier que PostgreSQL est démarré

```bash
docker compose ps postgres
```

Tu devrais voir quelque chose comme :
```
NAME                STATUS
sentryal-postgres-1 Up X seconds
```

### Étape 4 : Redémarrer le backend

```bash
cd backend
npm run dev
```

Maintenant le backend devrait :
- ✅ Démarrer sans erreur
- ✅ Se connecter à PostgreSQL automatiquement
- ✅ Exécuter les migrations si nécessaire

## 🔍 Vérification

Pour vérifier que tout fonctionne :

1. **Backend démarre** : Tu devrais voir `Backend listening on http://localhost:5000`
2. **Connexion DB** : Tu devrais voir `Database connection established`
3. **Test API** : 
   ```bash
   curl http://localhost:5000/api/health
   ```

## ⚠️ Si ça ne fonctionne toujours pas

1. **Vérifie que Docker Desktop est bien démarré** :
   ```bash
   docker ps
   ```
   Si ça donne une erreur, Docker n'est pas démarré.

2. **Vérifie que PostgreSQL est bien lancé** :
   ```bash
   docker compose ps
   ```

3. **Vérifie les logs PostgreSQL** :
   ```bash
   docker compose logs postgres
   ```

4. **Vérifie que le port 5432 n'est pas utilisé** :
   ```bash
   netstat -ano | findstr :5432
   ```

5. **Redémarre PostgreSQL** :
   ```bash
   docker compose down postgres
   docker compose up postgres -d
   ```

## 📝 Note importante

Le backend démarre maintenant **même si PostgreSQL n'est pas disponible**. C'est normal en développement - il se connectera automatiquement quand PostgreSQL sera prêt.

Pour tester les routes API, il faut que PostgreSQL soit démarré et accessible.

