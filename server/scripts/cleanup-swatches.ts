import { db } from "../db";
import { variantColors } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

async function cleanupSwatches() {
  const swatchesDir = path.join(process.cwd(), "client/public/images/swatches");

  const vcList = await db.select({ swatchUrl: variantColors.swatchUrl }).from(variantColors);

  const referencedFilenames = new Set(
    vcList
      .map(vc => vc.swatchUrl)
      .filter((url): url is string => !!url)
      .map(url => path.basename(url))
  );

  const allFiles = fs.readdirSync(swatchesDir);
  const orphans = allFiles.filter(f => !referencedFilenames.has(f));

  if (orphans.length === 0) {
    console.log("No orphaned swatch files found.");
    process.exit(0);
  }

  console.log(`Found ${orphans.length} orphaned swatch file(s):`);
  for (const file of orphans) {
    console.log(`  ${file}`);
  }

  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("\nDry-run mode: no files deleted. Remove --dry-run to delete.");
  } else {
    for (const file of orphans) {
      fs.unlinkSync(path.join(swatchesDir, file));
    }
    console.log(`\nDeleted ${orphans.length} orphaned swatch file(s).`);
  }

  process.exit(0);
}

cleanupSwatches().catch(err => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
