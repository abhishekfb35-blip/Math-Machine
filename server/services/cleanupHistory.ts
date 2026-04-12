import { storage } from "../storage";

export async function recordCleanupRun(deleted: number): Promise<void> {
  try {
    const record = await storage.getSiteConfig("cleanup-history");
    const history: Array<{ timestamp: string; deleted: number }> = record
      ? JSON.parse(record.value)
      : [];
    history.push({ timestamp: new Date().toISOString(), deleted });
    if (history.length > 20) history.splice(0, history.length - 20);
    await storage.upsertSiteConfig("cleanup-history", JSON.stringify(history));
  } catch (e: any) {
    console.error("[cleanup-history] Failed to record run:", e.message);
  }
}
