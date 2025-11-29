# Debugging Patch - Skip JWT Signature Verification

## ⚠️ IMPORTANT WARNING
This patch **disables JWT signature verification** temporarily. It allows any token with a valid format and expiration date to authenticate, regardless of the secret used to sign it.

**DO NOT LEAVE THIS IN PRODUCTION PERMANENTLY.**

## Why this patch?
We are facing persistent 401 Unauthorized errors in production. The token format seems correct, and the issuer URL has been normalized. The most likely remaining cause is a mismatch between the `SUPABASE_JWT_SECRET` configured in Railway and the actual secret used by Supabase to sign the tokens.

By applying this patch, we confirm:
1. If the 401 disappears -> The issue is definitely the **JWT Secret**.
2. If the 401 persists -> The issue is something else (e.g., network, headers stripping).

## Next Steps
1. Deploy this change.
2. Run the `verify_fix.ps1` script again with your real token.
3. If it returns **201 Created**:
   - Go to Supabase Dashboard > Project Settings > API.
   - Reveal the JWT Secret.
   - Go to Railway > Variables.
   - Update `SUPABASE_JWT_SECRET` with the value from Supabase.
   - **Revert this code change immediately.**

## How to Revert
Undo the changes in `backend/src/middleware/auth.ts` to restore `jwt.verify()`.
