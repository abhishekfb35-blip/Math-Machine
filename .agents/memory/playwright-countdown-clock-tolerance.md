---
name: Playwright countdown clock tolerance
description: Keep fake-clock countdown tests reliable when browser actions consume elapsed time.
---

Playwright countdown tests can consume part of a timer while performing browser actions between explicit `page.clock` advances. Exact millisecond-boundary assertions may therefore fail even when the countdown correctly preserves its remaining time.

**Why:** Opening a cart surface and waiting for its rendered state reduced the observed remaining countdown by the time spent on those actions.

**How to apply:** Use countdowns with comfortable margins, assert they remain hidden well before the expected expiry, then verify they appear after a wider interval. Reserve exact-boundary checks for tests that synchronize directly to timer start and account for action time.