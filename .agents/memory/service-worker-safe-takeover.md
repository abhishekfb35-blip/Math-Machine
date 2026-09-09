---
name: Service worker safe takeover
description: Reliability rules for updating the storefront service worker without sacrificing the last usable offline build.
---

Warm the complete build-specific application shell before calling `skipWaiting`, and delete the candidate cache if any required asset fails validation. Remove the previous cache only after the new worker installs successfully.

**Why:** A worker that activates before its shell is usable can delete the last known-good offline build. SPA fallbacks can also disguise missing JavaScript or CSS as successful HTML responses, so HTTP status alone is insufficient validation.

**How to apply:** For every service-worker update, bypass HTTP caches, reject HTML returned for fingerprinted assets, keep missing asset routes out of the SPA fallback, and test failed and successful takeover paths in a real browser.