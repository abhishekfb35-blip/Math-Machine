---
name: Quick Add scroll cue placement
description: Preserve the independently pinned Add to Cart action when adding scroll guidance to Quick Add.
---

Keep scroll cues out of the sheet's flex flow and outside the pinned footer. An in-flow cue row can move the footer, and a flex wrapper around the scroll port can grow over it and intercept clicks. Anchor a non-interactive cue inside the existing scroll viewport, reserve its display band when checking whether the first relevant control is visible, and hide it before it overlaps that control.

**Why:** A layout cue must not alter purchase behavior or block the primary action; both failure modes appeared when testing different flex placements.

**How to apply:** Use this constraint for future Quick Add scroll indicators or sticky hints, and verify the submit button's position and clickability while the cue appears and disappears.