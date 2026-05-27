---
name: Color-size repo tables
description: Global colour swatch repo and per-category size definition repo — tables, migration, routes, UI entry points.
---

## Tables
- `color_swatches`: global palette; managed at `/admin/color-swatches`
- `category_size_definitions`: per-category size presets; managed via Ruler button on each category card in AdminCatalog

## Migration
`server/migrations/color-size-repos.ts` → registered as `"color-size-repos"` in `server/index.ts` migration list.

## API routes (all require `catalog` permission)
- `GET/POST /api/admin/color-swatches`
- `PATCH/DELETE /api/admin/color-swatches/:id`
- `GET/POST /api/admin/categories/:id/size-definitions`
- `PATCH/DELETE /api/admin/categories/:categoryId/size-definitions/:id`

## UI entry points
- `VariantConfigModal` fetches both repos and uses them as pickers (palette row for colours, Select dropdown for sizes)
- `CategorySizesModal` (Ruler icon per category card) is the CRUD interface for size definitions
- `AdminColorSwatches.tsx` is the CRUD page for global swatches

**Why:** These are preset repositories — the actual variant config still stores names + swatchUrls inline (backward compatible). The repos just speed up data entry.
