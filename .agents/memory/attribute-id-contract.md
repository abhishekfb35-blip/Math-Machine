---
name: Attribute ID contract
description: Product attribute relations use stable lookup-table IDs, while names are display-only projections.
---

Product audience, gender, theme, and style relations must be represented by lookup-table IDs across API filters, admin configuration, seed snapshots, and import/export paths. Display names may be exposed separately but must not be used as relation values or filter keys.

**Why:** Attribute names are editable labels and can collide or vary in casing; using them for matching caused Shop and Collection filters to return incorrect results.

**How to apply:** Resolve external or legacy names at an import/migration boundary, validate referenced IDs before writes, and keep runtime filtering/junction writes ID-based.