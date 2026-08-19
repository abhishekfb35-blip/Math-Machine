const ALLOWED_TAGS = /^(strong|b|em|i|u|s|br|p|div|span|font)$/i;
const ALLOWED_STYLE_PROPERTIES = new Set([
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
]);
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 72;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\r?\n/g, "<br>");
}

function sanitizeStyle(value: string): string {
  return value
    .split(";")
    .map((declaration) => {
      const [property, ...parts] = declaration.split(":");
      const normalizedProperty = property?.trim().toLowerCase();
      const normalizedValue = parts.join(":").trim();
      if (!normalizedProperty || !normalizedValue || !ALLOWED_STYLE_PROPERTIES.has(normalizedProperty)) return "";
      if (/url\s*\(|expression\s*\(|javascript\s*:/i.test(normalizedValue)) return "";
      if (normalizedProperty === "font-size") {
        const match = normalizedValue.match(/^(\d+)px$/i);
        const size = match ? Number(match[1]) : NaN;
        if (!Number.isInteger(size) || size < MIN_FONT_SIZE || size > MAX_FONT_SIZE) return "";
        return `font-size:${size}px`;
      }
      return `${normalizedProperty}:${normalizedValue}`;
    })
    .filter(Boolean)
    .join(";");
}

/** Sanitizes the limited HTML format supported by the signup popup editor. */
export function sanitizeRichText(value: unknown): string {
  const input = typeof value === "string" ? value : "";
  if (!input) return "";
  if (!/<[a-z][\s\S]*>/i.test(input)) return escapeHtml(input);

  return input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)[^>]*\/?>/gi, "")
    .replace(/<\s*(\/?)\s*([a-z0-9-]+)([^>]*)>/gi, (_match, closing: string, tag: string, attributes: string) => {
      if (!ALLOWED_TAGS.test(tag)) return "";
      if (closing) return `</${tag.toLowerCase()}>`;

      const safeAttributes: string[] = [];
      attributes.replace(/\s+([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_attributeMatch, name: string, doubleValue?: string, singleValue?: string, bareValue?: string) => {
        const normalizedName = name.toLowerCase();
        const attributeValue = doubleValue ?? singleValue ?? bareValue ?? "";
        if (normalizedName === "style") {
          const style = sanitizeStyle(attributeValue);
          if (style) safeAttributes.push(`style="${style}"`);
        } else if ((normalizedName === "color" || normalizedName === "face" || normalizedName === "size") && !/[<>"'{};]/.test(attributeValue)) {
          safeAttributes.push(`${normalizedName}="${attributeValue}"`);
        }
        return "";
      });

      return `<${tag.toLowerCase()}${safeAttributes.length ? ` ${safeAttributes.join(" ")}` : ""}>`;
    });
}