---
name: Signup popup scroll isolation
description: Why signup popup touch-scroll boundaries require native event listeners and consent overscroll containment.
---

Cancel page scrolling for touch gestures that originate inside the signup popup with a native `touchmove` listener registered as non-passive. Keep backdrop gestures uncancelled, and contain the consent region's overscroll so its boundary cannot chain into the page.

**Why:** React's delegated touch handler did not cancel the browser-level touch move reliably in the mobile browser regression, even though its synthetic handler called `preventDefault`. A native non-passive listener produced the required cancellation.

**How to apply:** When changing signup popup gesture handling, preserve the distinction between popup-origin, consent-region, and backdrop-origin gestures. Verify cancellation at the native event level as well as actual page scrolling.