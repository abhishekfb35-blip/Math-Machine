import { db } from "./db";
import { siteConfig } from "@shared/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

async function syncSiteConfigToSeed() {
  try {
    const allConfig = await db.select().from(siteConfig);
    const seedPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "seed-data.json");
    const seedData = JSON.parse(fs.readFileSync(seedPath, "utf8"));

    seedData.siteConfig = allConfig.map((sc) => ({
      key: sc.key,
      value: sc.value,
    }));

    fs.writeFileSync(seedPath, JSON.stringify(seedData));
    console.log(`Exported ${allConfig.length} site_config entries to seed-data.json:`);
    for (const sc of allConfig) {
      console.log(`  - ${sc.key} (${sc.value.length} chars)`);
    }
    process.exit(0);
  } catch (err) {
    console.error("Failed to sync site config:", err);
    process.exit(1);
  }
}

syncSiteConfigToSeed();
