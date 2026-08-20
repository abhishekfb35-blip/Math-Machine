---
name: International phone validation
description: Decision for country-code selectors and global phone validation.
---

Use `libphonenumber-js` metadata for country-code options and international number validation across client and server, rather than maintaining a finite country allowlist or custom per-country lengths.

**Why:** Calling codes and number plans vary by country and change over time; a hand-maintained list restricts international customers and drifts from validation logic.

**How to apply:** Keep the selected dialing code and local digits separate in the UI, validate the assembled international number on the server, and default the country selector to India while presenting the full supported set.