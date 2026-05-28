---
name: Swatch cleanup ESM & error isolation
description: Two bugs found in cleanupSwatchFiles — __dirname not available in ESM, and unguarded throws failing saves.
---

## Rules

1. **`__dirname` is not available in ESM (tsx).** Use `process.env.NODE_ENV === "production"` to detect env, and `path.resolve(process.cwd(), ...)` to build paths.

2. **Side-effect cleanup must never throw into the caller.** `cleanupSwatchFiles` runs *after* the DB write succeeds. Any uncaught error inside it causes a 500 response even though the data was saved. Wrap the entire function body — and each per-item iteration — in try/catch so failures are warnings, not errors.

**Why:** The pattern of "do the real work, then clean up old files" is used in several places. The cleanup is best-effort; a missing or locked file must never roll back a successful DB operation from the caller's perspective.

**How to apply:** Whenever a storage method calls a file-system side-effect after a successful DB write, wrap that side-effect in a top-level try/catch that only `console.warn`s.
