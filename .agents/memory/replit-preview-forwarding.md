---
name: Preview forwarding checks
description: Distinguishes a healthy local app from Replit preview routing failures.
---

Reconfiguring a workflow can regenerate Replit settings and drop an explicit port mapping. A local HTTP 200 does not prove that the development-domain preview is being forwarded to the app.

**Why:** Workflow settings and port mappings are managed through separate Replit paths. A server can be healthy on the expected port while the external development domain still returns 404.

**How to apply:** After a workflow change, recheck the active port mapping. If the app is reachable on `0.0.0.0:5000` and the development domain still returns 404 after one restart with the mapping present, stop retrying and report a Replit-side forwarding issue.