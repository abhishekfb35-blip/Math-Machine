---
name: Test rate-limit isolation
description: The boundary between browser automation and production request protections.
---

Browser automation should use an explicitly test-scoped rate-limit strategy; production request limits must remain unchanged.

**Why:** A long browser suite can legitimately exceed the app-wide request budget and turn later UI assertions into misleading HTTP 429 failures rather than product regressions.

**How to apply:** Any test bypass or expanded budget must be gated to automated test execution and must not weaken development preview or published-app protections.