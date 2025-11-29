# Status Update - Sentryal Serverless Stack Stabilization

## ✅ Actions Taken

### 1. Authentication (Fixing 401 Errors)
- **Modified `backend/src/middleware/auth.ts`**:
  - Added URL normalization to remove trailing slashes from `SUPABASE_URL`, preventing "issuer mismatch" errors.
  - Enhanced error logging to show the *exact* expected issuer vs. the received token's issuer.
  - Added token decoding (without verification) to the log when verification fails, allowing inspection of `aud`, `iss`, and `exp` in the logs.

### 2. Job Creation (Fixing 500/201 Errors)
- **Modified `backend/src/services/databaseService.ts`**:
  - `createJob`: Wrapped the INSERT operation in a try/catch block that logs specific details if it fails (JobId, StatusEnum used, Bbox length).
  - This will reveal if the `JobStatus` enum cast is the root cause of the failure.
  - **Safety Fix**: Updated `getAggregatedBbox` to filter out `NULL` geometries (`AND geom IS NOT NULL`). This prevents the query from crashing if some points have invalid/missing geometry (which might happen with partial data uploads).

### 3. Code Quality & Robustness
- Verified `jobs.ts` error handling: It correctly catches queue addition errors and returns a 500 with details if no jobs are created.
- Verified `insarWorker.ts`: Queue connection logic handles defaults correctly.

## 📋 Next Steps (Operational Checklist)

Please perform the following steps to validate the fixes in the Railway environment:

1. **Deploy**: Push the changes to the `main` branch to trigger a Railway deployment.
2. **Verify Logs**:
   - If you still get **401**: Check the Railway App Logs. Search for `JWT verification failed`. The log will now tell you exactly why (e.g., `expectedIssuer: https://xxx/auth/v1, receivedToken: { iss: ... }`).
   - If you get **500** on `POST /process-insar`: Check the logs for `Failed to INSERT job`. It will show the error message (e.g., `invalid input value for enum JobStatus`).
3. **Database Check**:
   - If the logs indicate an enum error, you may need to run a migration or manually fix the type in Postgres:
     ```sql
     -- Check existing enum
     SELECT enum_range(NULL::"JobStatus");
     -- If needed, add missing values (e.g., if mixed case)
     -- ALTER TYPE "JobStatus" ADD VALUE 'PENDING'; 
     ```
4. **Queue Check**:
   - If the logs show `Error creating job for pair` related to Redis, verify the `REDIS_URL` in Railway.

## 🔍 Debugging Cheat Sheet

**Log Search Terms:**
- `JWT verification failed` -> Auth issues
- `Failed to INSERT job` -> Database/Schema issues
- `[PROCESS-INSAR] No jobs created` -> Logic/Queue issues

**Environment Variables to Verify:**
- `SUPABASE_URL` (should be `https://your-project.supabase.co`)
- `SUPABASE_JWT_SECRET` (must match the Supabase project settings)
- `REDIS_URL` (must be valid for the queue worker)

The codebase is now instrumented to reveal the root causes of the "silent" failures.
