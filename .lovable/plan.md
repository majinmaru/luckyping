Plan: Remove Lovable Cloud managed OAuth and revert to standalone Supabase auth so the app has no Lovable dependency.

1. Update `src/pages/Auth.tsx`:
   - Remove `lovable` import.
   - Replace `lovable.auth.signInWithOAuth` call with `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })`.

2. Delete `src/integrations/lovable/index.ts`.

3. Remove `@lovable.dev/cloud-auth-js` from `package.json` dependencies.