---
name: Storefront crawlable rendering
description: The server-generated storefront snapshot and its handoff to the interactive client.
---

Serve the same route-aware catalogue snapshot to crawlers and ordinary browsers. Keep it visible outside the React root, seed the matching TanStack Query keys before mounting, then remove the snapshot after the app commits.

**Why:** Full React SSR would pull browser-dependent providers into the server render. The snapshot gives crawlers real HTML while query seeding prevents the interactive app from refetching empty state and flashing over the snapshot.

**How to apply:** When adding another server-rendered storefront route, render its initial data and preload the exact query keys the page uses. Do not branch the document by user agent.