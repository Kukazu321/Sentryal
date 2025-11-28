# 🧪 TEST PHASE 4 - COMMANDES MANUELLES

**Plus simple que le script PowerShell**

---

## ✅ ÉTAPE 1 : Vérifier que tout tourne

```powershell
# Backend
curl http://localhost:5000/api/health

# Redis
docker ps | findstr redis
```

---

## ✅ ÉTAPE 2 : Créer une infrastructure

```powershell
curl -X POST http://localhost:5000/api/infrastructures `
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6IlczVXgwbVdEQUxiVXNYNUEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2d3eGRuZWtkZG1iZXNrYWVnZHR1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0OTQyMjhkOS1hNzYyLTRlMzYtYWM4My0xNmY4NzJlZTU0ZWIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyNjI0MDczLCJpYXQiOjE3NjI2MjA0NzMsImVtYWlsIjoiY2hhcmxpZS5jb3VwZTU5QGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYyNjIwNDczfV0sInNlc3Npb25faWQiOiI5Mjk4NGJkZi0xNGRjLTRhNWEtYTgwNC0wM2JjMTllOTZkNWMiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.eY_XzO70mbW-97BiqqFvYO04qjGbm2AFCan9H0M189I" `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"Test Dam Phase 4\",\"type\":\"dam\",\"bbox\":{\"type\":\"Polygon\",\"coordinates\":[[[2.3,48.8],[2.4,48.8],[2.4,48.9],[2.3,48.9],[2.3,48.8]]]},\"mode_onboarding\":\"DRAW\"}'
```

**Copier l'ID retourné** : `"id": "xxx-xxx-xxx"`

---

## ✅ ÉTAPE 3 : Générer des points

```powershell
# Remplacer INFRA_ID par l'ID de l'étape 2
curl -X POST http://localhost:5000/api/v2/onboarding/generate-grid `
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6IlczVXgwbVdEQUxiVXNYNUEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2d3eGRuZWtkZG1iZXNrYWVnZHR1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0OTQyMjhkOS1hNzYyLTRlMzYtYWM4My0xNmY4NzJlZTU0ZWIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyNjI0MDczLCJpYXQiOjE3NjI2MjA0NzMsImVtYWlsIjoiY2hhcmxpZS5jb3VwZTU5QGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYyNjIwNDczfV0sInNlc3Npb25faWQiOiI5Mjk4NGJkZi0xNGRjLTRhNWEtYTgwNC0wM2JjMTllOTZkNWMiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.eY_XzO70mbW-97BiqqFvYO04qjGbm2AFCan9H0M189I" `
  -H "Content-Type: application/json" `
  -d '{\"mode\":\"DRAW\",\"infrastructureId\":\"INFRA_ID\",\"polygon\":{\"type\":\"Polygon\",\"coordinates\":[[[2.3,48.8],[2.31,48.8],[2.31,48.81],[2.3,48.81],[2.3,48.8]]]},\"spacing\":5}'
```

---

## ✅ ÉTAPE 4 : Lancer un job InSAR

```powershell
# Remplacer INFRA_ID
curl -X POST http://localhost:5000/api/jobs/process-insar `
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6IlczVXgwbVdEQUxiVXNYNUEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2d3eGRuZWtkZG1iZXNrYWVnZHR1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0OTQyMjhkOS1hNzYyLTRlMzYtYWM4My0xNmY4NzJlZTU0ZWIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyNjI0MDczLCJpYXQiOjE3NjI2MjA0NzMsImVtYWlsIjoiY2hhcmxpZS5jb3VwZTU5QGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYyNjIwNDczfV0sInNlc3Npb25faWQiOiI5Mjk4NGJkZi0xNGRjLTRhNWEtYTgwNC0wM2JjMTllOTZkNWMiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.eY_XzO70mbW-97BiqqFvYO04qjGbm2AFCan9H0M189I" `
  -H "Content-Type: application/json" `
  -d '{\"infrastructureId\":\"INFRA_ID\"}'
```

**Copier le JOB_ID retourné**

---

## ✅ ÉTAPE 5 : Vérifier le status du job

```powershell
# Attendre 30-60 secondes, puis :
curl http://localhost:5000/api/jobs/JOB_ID `
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6IlczVXgwbVdEQUxiVXNYNUEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2d3eGRuZWtkZG1iZXNrYWVnZHR1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0OTQyMjhkOS1hNzYyLTRlMzYtYWM4My0xNmY4NzJlZTU0ZWIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyNjI0MDczLCJpYXQiOjE3NjI2MjA0NzMsImVtYWlsIjoiY2hhcmxpZS5jb3VwZTU5QGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYyNjIwNDczfV0sInNlc3Npb25faWQiOiI5Mjk4NGJkZi0xNGRjLTRhNWEtYTgwNC0wM2JjMTllOTZkNWMiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.eY_XzO70mbW-97BiqqFvYO04qjGbm2AFCan9H0M189I"
```

**Attendu** : `"status": "COMPLETED"`

---

## ✅ ÉTAPE 6 : Vérifier les déformations

```powershell
curl http://localhost:5000/api/deformations?infrastructureId=INFRA_ID `
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6IlczVXgwbVdEQUxiVXNYNUEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2d3eGRuZWtkZG1iZXNrYWVnZHR1LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI0OTQyMjhkOS1hNzYyLTRlMzYtYWM4My0xNmY4NzJlZTU0ZWIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYyNjI0MDczLCJpYXQiOjE3NjI2MjA0NzMsImVtYWlsIjoiY2hhcmxpZS5jb3VwZTU5QGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYyNjIwNDczfV0sInNlc3Npb25faWQiOiI5Mjk4NGJkZi0xNGRjLTRhNWEtYTgwNC0wM2JjMTllOTZkNWMiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.eY_XzO70mbW-97BiqqFvYO04qjGbm2AFCan9H0M189I"
```

**Attendu** : Liste de déformations avec `vertical_displacement_mm`, `coherence`, etc.

---

## ✅ VALIDATION

Si toutes les étapes fonctionnent :
- ✅ Infrastructure créée
- ✅ Points générés
- ✅ Job InSAR lancé
- ✅ Worker traite le job
- ✅ Déformations stockées

**PHASE 4 VALIDÉE ! 🎉**

---

**Exécute ces commandes une par une et dis-moi où ça bloque si besoin !**
