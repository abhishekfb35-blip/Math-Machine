import { pool } from "../db";

export async function ensureAttributeTables(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS age_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS genders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS themes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS styles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS occasions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        boost_tags JSONB DEFAULT '{}',
        penalty_tags JSONB DEFAULT '{}',
        preferred_styles TEXT,
        preferred_themes TEXT,
        active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_age_groups (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        age_group_id TEXT NOT NULL REFERENCES age_groups(id) ON DELETE RESTRICT,
        CONSTRAINT product_age_groups_uniq UNIQUE (product_id, age_group_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_genders (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        gender_id TEXT NOT NULL REFERENCES genders(id) ON DELETE RESTRICT,
        CONSTRAINT product_genders_uniq UNIQUE (product_id, gender_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_themes (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        theme_id TEXT NOT NULL REFERENCES themes(id) ON DELETE RESTRICT,
        CONSTRAINT product_themes_uniq UNIQUE (product_id, theme_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_styles (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        style_id TEXT NOT NULL REFERENCES styles(id) ON DELETE RESTRICT,
        CONSTRAINT product_styles_uniq UNIQUE (product_id, style_id)
      )
    `);

    console.log("[migration] attribute-tables: all tables ensured");
  } catch (err: any) {
    console.warn("[migration] attribute-tables: failed:", err.message);
  }
}
