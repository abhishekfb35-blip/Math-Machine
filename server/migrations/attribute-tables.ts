import { pool } from "../db";

export async function ensureAttributeTables(): Promise<void> {
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'age_groups') THEN
        ALTER TABLE age_groups RENAME TO audience;
      END IF;
    END $$
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audience (
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
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_age_groups') THEN
        ALTER TABLE product_age_groups RENAME TO product_audience;
        ALTER TABLE product_audience RENAME COLUMN age_group_id TO audience_id;
      END IF;
    END $$
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_audience (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      audience_id TEXT NOT NULL REFERENCES audience(id) ON DELETE RESTRICT,
      CONSTRAINT product_audience_uniq UNIQUE (product_id, audience_id)
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
}
