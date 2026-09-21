---
name: Nested popup over Radix modal
description: Interaction and focus rules when a custom global popup appears above an open Radix modal surface.
---

Keep an underlying Radix modal's mode and mounted state stable while a higher-priority custom popup is visible. Make the popup layers explicitly pointer-interactive, reject controlled close requests while the popup owns interaction, and return focus to a non-input container when the popup closes.

**Why:** Switching a Radix dialog between modal and non-modal while open can create visible lifecycle transitions. Making it permanently non-modal breaks nested portal interactions. After the higher popup closes, the underlying focus trap may also select the first text input and reopen a mobile keyboard.

**How to apply:** Use this whenever a global popup can appear over an open sheet or dialog. Preserve the underlying surface's state, guard its close callback during popup ownership, and verify both entered values and active focus after dismissal.