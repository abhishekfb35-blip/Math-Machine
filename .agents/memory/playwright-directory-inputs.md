---
name: Playwright directory inputs
description: Playwright file-selection behavior for browser inputs that upload an entire local folder.
---

For an input using `webkitdirectory`, Playwright's `setInputFiles` requires the path to a real directory; passing an array of virtual files fails. Create a temporary folder with the test files, pass its path, and remove it in a `finally` block.

**Why:** Browser folder pickers expose directory-selection behavior that ordinary file inputs do not, and the array form does not simulate that selection.

**How to apply:** Use this for end-to-end tests of folder-upload controls. Keep generated files in the OS temp directory and clean them up even when assertions fail.