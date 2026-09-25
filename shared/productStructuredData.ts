import type { ProductVariantOptions } from "./types";

export interface ProductStructuredDataInput {
  id: string;
  name: string;
  description: string;
  price: number;
  sku?: string | null;
  imageUrls: string[];
  url: string;
  brandName: string;
  variants?: ProductVariantOptions;
}

function absoluteImageUrls(images: string[], siteUrl: string): string[] {
  return [...new Set(images.filter(Boolean).flatMap((image) => {
    try {
      const url = new URL(image, `${siteUrl}/`);
      return url.protocol === "https:" || url.protocol === "http:" ? [url.href] : [];
    } catch {
      return [];
    }
  }))];
}

export function buildProductStructuredData(
  input: ProductStructuredDataInput,
): Record<string, unknown> {
  const images = absoluteImageUrls(input.imageUrls, new URL(input.url).origin);
  const brand = { "@type": "Brand", name: input.brandName };
  const base = {
    "@context": "https://schema.org",
    name: input.name,
    description: input.description,
    ...(images.length > 0 ? { image: images } : {}),
    url: input.url,
    brand,
  };
  const availableSizes = input.variants?.sizes.filter((size) => !size.blurOnFront) ?? [];

  if (availableSizes.length > 0) {
    const hasColorVariants = availableSizes.some((size) =>
      size.colors.some((color) => !color.blurOnFront),
    );
    const hasVariant = availableSizes.flatMap((size) => {
      const colors = size.colors.filter((color) => !color.blurOnFront);
      const combinations = colors.length > 0 ? colors : [null];
      return combinations.map((color) => ({
        "@type": "Product",
        name: `${input.name} — ${size.name}${color ? ` — ${color.name}` : ""}`,
        size: size.name,
        ...(color ? { color: color.name } : {}),
        description: input.description,
        url: input.url,
        brand,
        ...(images.length > 0 ? { image: images } : {}),
        offers: {
          "@type": "Offer",
          url: input.url,
          price: input.price + size.priceAdd,
          priceCurrency: "INR",
          availability: "https://schema.org/InStock",
          seller: { "@type": "Organization", name: input.brandName },
        },
      }));
    });

    return {
      ...base,
      "@type": "ProductGroup",
      productGroupID: input.sku || input.id,
      variesBy: [
        "https://schema.org/size",
        ...(hasColorVariants ? ["https://schema.org/color"] : []),
      ],
      hasVariant,
    };
  }

  return {
    ...base,
    "@type": "Product",
    ...(input.sku ? { sku: input.sku } : {}),
    offers: {
      "@type": "Offer",
      url: input.url,
      price: input.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: input.brandName },
    },
  };
}