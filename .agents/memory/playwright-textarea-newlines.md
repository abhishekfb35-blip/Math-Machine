---
name: Playwright textarea newline normalization
description: Server strings with CRLF line endings are normalized by browser textarea controls.
---

When browser tests compare API text with a textarea value, normalize CRLF and CR line endings to LF first.

**Why:** HTML textarea controls expose newline-normalized values, while PostgreSQL-backed text may retain CRLF separators.

**How to apply:** Normalize only at the browser-control assertion boundary; keep API and persisted values unchanged.