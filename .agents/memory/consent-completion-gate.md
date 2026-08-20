---
name: Consent completion gate
description: Rule for requiring configured signup consent across Google completion flows.
---

When consent text is configured for signup, every Google account-completion surface must present the same scroll-to-complete agreement gate and submit the configured text with explicit acknowledgement.

**Why:** The popup, full sign-in page, and sign-in modal share the completion endpoint. Gating only one surface leaves an alternate account-creation path that can skip consent.

**How to apply:** Keep the consent copy in an independently scrollable fixed-height region, retain the checkbox outside that reader, enable it only after the bottom has been reached, and validate the configured consent requirement on the server before creating a session.