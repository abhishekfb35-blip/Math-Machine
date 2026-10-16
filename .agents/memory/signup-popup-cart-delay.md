---
name: Signup popup cart delay
description: Product decision for how cart-add delay interacts with the promotional signup timer.
---

The Cart-add delay pauses the remaining Session delay countdown after each cart addition. When that pause expires, the Session countdown resumes with its remaining time; cart activity does not start a separate signup popup timer.

**Why:** The user clarified that Cart-add delay is a pause of the existing session timer, not a cart-triggered popup.

**How to apply:** Preserve this behavior when changing signup-popup triggers, timing controls, or cart-added events.
