-- Migration: rename `audiences` → `ageGroups` in site_config shop-sections JSON
-- Task #133 — Run once; already applied to development DB on 2025-04-30
--
-- Reason: Task #129 changed ShopSection interface from `audiences: string[]` to
-- `ageGroups?: string[]`. The saved config in site_config still used the old field.
-- This caused audience filter tabs (Kids, Adults) to appear broken — no sections
-- would pass the `s.ageGroups.includes(activeFilter)` check.
--
-- Also removes "couples" from ageGroups since it was deleted from age_groups table
-- in Task #130 (couples is not an age group).

UPDATE site_config
SET value = '[{"label":"Kids Towels","tag":"kids towels","maxShown":15,"enabled":true,"ageGroups":["kids"]},{"label":"Adult Towels","tag":"adult towels","maxShown":8,"enabled":true,"ageGroups":["adults"]},{"label":"Couple Towels","tag":"couple towels","maxShown":8,"enabled":true,"ageGroups":["adults"]},{"label":"Kids Blankets","tag":"kids blankets","maxShown":8,"enabled":true,"ageGroups":["kids"]},{"label":"Kids Bathrobes","tag":"kids bathrobes","maxShown":8,"enabled":true,"ageGroups":["kids"]},{"label":"Adult Bathrobes","tag":"adult bathrobes","maxShown":8,"enabled":true,"ageGroups":["adults"]},{"label":"Couple Bathrobes","tag":"couple bathrobes","maxShown":8,"enabled":true,"ageGroups":["adults"]}]'
WHERE key = 'shop-sections';
