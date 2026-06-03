import { db } from "../db";
import { ipGeoCache } from "@shared/schema";
import { inArray, sql } from "drizzle-orm";

export interface GeoResult {
  ip: string;
  country: string | null;
  city: string | null;
}

export async function resolveGeo(ips: string[]): Promise<Map<string, GeoResult>> {
  const result = new Map<string, GeoResult>();
  if (ips.length === 0) return result;

  const uniqueIps = [...new Set(ips)];

  try {
    const cached = await db.select()
      .from(ipGeoCache)
      .where(
        inArray(ipGeoCache.ip, uniqueIps.slice(0, 500))
      );

    for (const row of cached) {
      const age = row.cachedAt ? Date.now() - new Date(row.cachedAt).getTime() : Infinity;
      if (age < 7 * 24 * 60 * 60 * 1000) {
        result.set(row.ip, { ip: row.ip, country: row.country ?? null, city: row.city ?? null });
      }
    }
  } catch {}

  const missing = uniqueIps.filter(ip => !result.has(ip));
  if (missing.length === 0) return result;

  const BATCH = 100;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    try {
      const resp = await fetch("http://ip-api.com/batch?fields=status,query,country,city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch.map(ip => ({ query: ip }))),
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) break;
      const data: Array<{ status: string; query: string; country?: string; city?: string }> = await resp.json();

      for (const item of data) {
        const geo: GeoResult = {
          ip: item.query,
          country: item.status === "success" ? (item.country ?? null) : null,
          city: item.status === "success" ? (item.city ?? null) : null,
        };
        result.set(item.query, geo);

        try {
          await db.insert(ipGeoCache)
            .values({ ip: item.query, country: geo.country, city: geo.city, cachedAt: new Date() })
            .onConflictDoUpdate({
              target: ipGeoCache.ip,
              set: { country: geo.country, city: geo.city, cachedAt: new Date() },
            });
        } catch {}
      }
    } catch {}
  }

  for (const ip of missing) {
    if (!result.has(ip)) {
      result.set(ip, { ip, country: null, city: null });
    }
  }

  return result;
}
