---
name: Sticky filter scroll anchoring
description: Browser scroll anchoring can make a sticky filter handoff emit misleading scroll positions during its own height transition.
---

When a sticky filter bar changes height while reacting to scroll, browser scroll anchoring may emit intermediate scroll positions that cross the opposite hysteresis threshold. Treat the short CSS handoff as a state transition and ignore layout-only scroll events until it completes.

**Why:** Desktop Chromium reduced and then restored the page scroll position while the filter controls collapsed, causing the UI to toggle twice even though the user had not scrolled back up.

**How to apply:** For sticky controls that animate their height, combine scroll hysteresis with a brief lock around each collapse/expand transition, and test sampled visibility at desktop and mobile widths.