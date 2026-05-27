import { db } from "./db";
import { siteContent } from "@shared/schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

async function syncSiteConfigToSeed() {
  try {
    const allContent = await db.select().from(siteContent);
    const seedPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "seed-data.json");
    const seedData = JSON.parse(fs.readFileSync(seedPath, "utf8"));

    seedData.siteContent = allContent.map((sc) => ({
      key: sc.key,
      value: sc.value,
    }));

    fs.writeFileSync(seedPath, JSON.stringify(seedData));
    console.log(`Exported ${allContent.length} site_content entries to seed-data.json:`);
    for (const sc of allContent) {
      console.log(`  - ${sc.key} (${sc.value.length} chars)`);
    }
    process.exit(0);
  } catch (err) {
    console.error("Failed to sync site content:", err);
    process.exit(1);
  }
}

syncSiteConfigToSeed();
