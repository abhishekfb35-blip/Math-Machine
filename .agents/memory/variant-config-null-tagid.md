---
name: Variant config null-tagId pattern
description: How category variant configs are stored and queried after the rework — one config per category using tagId IS NULL.
---

## Rule
`categoryTagVariantConfigs` rows for the new system always have `tagId = NULL`. Old rows with a real tagId still exist in the DB but are no longer created or read by the new UI/storage code.

## How to apply
- `upsertVariantConfig(categoryId, null, sizes)` — always pass `null` as tagId from the new UI.
- `getProductVariantOptions` queries `WHERE category_id = $1 AND tag_id IS NULL` — uses drizzle `isNull()` operator.
- The `listCategoryTagVariantConfigs` endpoint still returns all configs (including old tag-based ones), but `VariantConfigModal` only loads `configs?.find(c => c.tagId === null) ?? configs?.[0]`.
- Use `isNull` from `drizzle-orm` (already imported in storage.ts).

**Why:** The variant rework removed the concept of per-tag configs. One config per category is simpler and avoids requiring product tags to be set before variants work.
