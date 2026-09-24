---
name: Product search inflection
description: Why plural equivalents need word boundaries alongside partial product search
---

Keep substring matching for the exact term a person types, but require whole-word matches for its singular/plural alternatives. Apply the same rule in browser filtering and database search.

**Why:** Partial names and SKU fragments must keep working while someone types. Expanding a plural to an unrestricted substring would also make “kids” match unrelated words such as “kidney.” Splitting a phrase into words alone does not solve reverse plural searches.

**How to apply:** When search matching changes, check multi-word queries with intervening words, both singular/plural directions, partial SKU queries, and negative prefix matches on both admin and customer paths.