---
name: Metro stale resolution after codegen
description: Metro caches a "module not found" for freshly generated files and keeps it across workflow restarts; how to clear it.
---

## Symptom

After running OpenAPI codegen (`pnpm --filter @workspace/api-spec run codegen`) that creates a NEW generated file (e.g. `lib/api-client-react/src/generated/api.ts`), the Expo/Metro web bundle fails with:

```
Unable to resolve "./generated/api" from "lib/api-client-react/src/index.ts"
None of these files exist: .../generated/api(.ts|.tsx|...)
```

— even though the file demonstrably exists on disk and `tsc` typechecks clean. A sibling file in the same dir (`api.schemas.ts`) resolves fine, only the newly-created one fails. The error persists across plain `restart_workflow` of the Expo app.

## Cause

Metro's resolver/haste map cached the negative resolution result from when the file did not yet exist (the bundle ran during/just before codegen). A normal workflow restart restarts the Metro process but Metro reuses its on-disk transform/haste cache, so the stale "not found" sticks.

## Fix

1. Remove Metro + Expo caches (do NOT touch `/home/runner/workspace/.cache` — that path is Replit-protected and deleting it errors):
   - `rm -rf artifacts/<app>/.expo`
   - `rm -rf /tmp/metro-* $TMPDIR/metro-* /tmp/haste-*`
2. `touch` the generated files and the barrel that imports them (busts mtime-keyed cache):
   - `touch lib/api-client-react/src/generated/api.ts lib/api-client-react/src/index.ts`
3. `restart_workflow` the Expo app.
4. Verify with a FRESH log capture via `refresh_all_logs` — the `/tmp/logs/*.log` files are point-in-time snapshots, NOT live tails, so `tail`/`grep` on an old snapshot will keep showing the stale error. A clean bundle shows `Web Bundled <ms> ... (N modules)` with no resolve error and the browser console logs `Running application "main"`.

**How to apply:** whenever codegen ADDS a generated module (not just edits an existing one) and Metro then reports it unresolved, assume stale cache before suspecting the code. Clear caches + touch + restart + refresh_all_logs.
