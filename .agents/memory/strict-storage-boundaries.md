---
name: Strict storage boundaries
description: How database-native nullable and JSON shapes should be exposed to the rest of the application
---

Database rows should be converted into the shared API types at the storage boundary. JSON columns need runtime shape validation/coercion, and database-only nullable fields should be normalized before routes or clients consume them.

**Why:** Drizzle correctly infers database-native shapes such as `unknown`, nullable columns, and missing derived fields; asserting those shapes farther up the stack hides schema drift and weakens strict type checking.

**How to apply:** Keep route handlers and client code on shared contracts. Add small storage-layer coercion functions or explicit DB payload construction when a schema field differs from the API representation.