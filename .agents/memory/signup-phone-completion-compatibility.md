---
name: Shared Google completion compatibility
description: Compatibility rule for extending the Google account-completion request.
---

When extending the Google account-completion request with new signup-specific fields, treat those fields as opt-in and preserve the existing behavior when they are omitted.

**Why:** Multiple sign-in surfaces share the completion endpoint. Applying new normalization rules unconditionally can silently change the data saved by older callers.

**How to apply:** Branch new validation and normalization on the new field’s presence. Keep legacy request shapes valid, while fully validating the new opt-in path on the server.