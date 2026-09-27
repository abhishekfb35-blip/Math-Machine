import type { IStorage } from "../storage";

const DELIVERY_LOCATION_STATEMENT =
  "TurtleLittle currently delivers only to addresses within India; delivery outside India is not available.";
const ABOUT_DELIVERY_COPY =
  "We deliver only to addresses within India. International delivery is not available.";

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseContent(value: string): Record<string, any> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function addIndiaOnlyDeliverySection(
  sections: unknown,
  headingPattern: RegExp,
): { sections: unknown[]; changed: boolean } {
  if (!Array.isArray(sections)) return { sections: [], changed: false };
  const sectionIndex = sections.findIndex(section =>
    isRecord(section) && typeof section.heading === "string" && headingPattern.test(section.heading),
  );
  if (sectionIndex < 0) {
    return {
      sections: [{ heading: "Delivery Locations", body: DELIVERY_LOCATION_STATEMENT }, ...sections],
      changed: true,
    };
  }

  const section = sections[sectionIndex];
  if (!isRecord(section)) return { sections, changed: false };
  const body = typeof section.body === "string" ? section.body : "";
  if (/only[^.!?\n]*\bIndia\b/i.test(body)) return { sections, changed: false };

  const next = [...sections];
  next[sectionIndex] = {
    ...section,
    body: `${DELIVERY_LOCATION_STATEMENT}${body.trim() ? `\n\n${body}` : ""}`,
  };
  return { sections: next, changed: true };
}

export function normalizeIndiaOnlyDeliveryContent(key: string, value: string): string {
  const content = parseContent(value);
  if (!content) return value;

  if (key === "seo" && typeof content.metaDescription === "string") {
    const updated = content.metaDescription
      .replace(/\bDelivered\s+across\s+(?:the\s+)?(?:Globe|India)\b/gi, "Delivered only within India")
      .replace(/\bDelivered\s+(?:worldwide|globally|internationally)\b/gi, "Delivered only within India")
      .replace(/\b(?:We\s+)?(?:ship|deliver)\s+(?:worldwide|globally|internationally)\b/gi, "Delivered only within India");
    if (updated !== content.metaDescription) {
      content.metaDescription = updated;
      return JSON.stringify(content);
    }
    return value;
  }

  if (key === "page-about" && Array.isArray(content.valueCards)) {
    let changed = false;
    content.valueCards = content.valueCards.map((card: unknown) => {
      if (!isRecord(card)) return card;
      const title = typeof card.title === "string" ? card.title : "";
      const description = typeof card.description === "string" ? card.description : "";
      if (!/delivery/i.test(title) && !/\banywhere\b|\bworldwide\b|\bglobe\b/i.test(description)) return card;
      if (title === "Delivery Across India" && description === ABOUT_DELIVERY_COPY) return card;
      changed = true;
      return {
        ...card,
        title: /delivery/i.test(title) ? "Delivery Across India" : title,
        description: ABOUT_DELIVERY_COPY,
      };
    });
    return changed ? JSON.stringify(content) : value;
  }

  if (key === "page-shipping" || key === "page-terms") {
    const result = addIndiaOnlyDeliverySection(
      content.sections,
      key === "page-shipping" ? /delivery/i : /shipping.*delivery|delivery.*shipping/i,
    );
    if (result.changed) {
      content.sections = result.sections;
      return JSON.stringify(content);
    }
  }

  return value;
}

export async function ensureIndiaOnlyDeliveryContent(
  storage: Pick<IStorage, "getSiteContent" | "upsertSiteContent">,
): Promise<void> {
  let updated = 0;
  for (const key of ["seo", "page-about", "page-shipping", "page-terms"]) {
    const row = await storage.getSiteContent(key);
    if (!row) continue;
    const value = normalizeIndiaOnlyDeliveryContent(key, row.value);
    if (value === row.value) continue;
    await storage.upsertSiteContent(key, value);
    updated++;
  }
  console.log(`India-only delivery content: ${updated ? `updated ${updated} saved entries` : "already current"}`);
}