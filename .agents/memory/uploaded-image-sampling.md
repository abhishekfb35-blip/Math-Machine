---
name: Uploaded image pixel sampling
description: Account for scaled visual previews before mapping pixels from a display to original image files.
---

Image previews can be downscaled relative to their attached source. When pixel sampling or cropping by coordinates, inspect the source dimensions first and scale coordinates from the displayed preview to the original. Prefer a library already present in the project rather than installing a dependency for a one-off sample.

**Why:** Sampling against preview coordinates can target the wrong source-image region when the original is larger.

**How to apply:** Use this when extracting exact colors or cropping by coordinates from a screenshot or reference image; visual inspection alone does not require coordinate conversion.