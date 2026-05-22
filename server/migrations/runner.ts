import { pool } from "../db";

export interface Migration {
  id: string;
  run: () => Promise<void>;
}

export async function runMigrations(migrations: Migration[]): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const result = await pool.query<{ id: string }>(`SELECT id FROM schema_migrations`);
  const applied = new Set(result.rows.map((r) => r.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }

    console.log(`[migrations] ${migration.id}: running`);
    await migration.run();
    await pool.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [migration.id]);
    console.log(`[migrations] ${migration.id}: done`);
  }
}
