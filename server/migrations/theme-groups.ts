import { eq } from "drizzle-orm";
import { db } from "../db";
import { siteContent, themes } from "@shared/schema";
import { buildDefaultThemeGroups } from "@shared/themeGroups";

export async function ensureThemeGroups(): Promise<void> {
  const [existing] = await db
    .select({ key: siteContent.key })
    .from(siteContent)
    .where(eq(siteContent.key, "theme-groups"));

  if (existing) return;

  const themeRows = await db.select({ id: themes.id, name: themes.name }).from(themes);
  const groups = buildDefaultThemeGroups(themeRows);
  const assignedIds = groups.flatMap(group => group.themeIds);
  if (assignedIds.length !== themeRows.length || new Set(assignedIds).size !== themeRows.length) {
    const assigned = new Set(assignedIds);
    const missing = themeRows.filter(theme => !assigned.has(theme.id)).map(theme => theme.name);
    throw new Error(`[migration] theme-groups: unresolved current themes: ${missing.join(", ") || "duplicate assignments"}`);
  }
  await db.insert(siteContent).values({
    key: "theme-groups",
    value: JSON.stringify(groups),
  });
  console.log("[migration] theme-groups: created default theme groups");
}