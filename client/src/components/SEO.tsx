import { Helmet } from "react-helmet-async";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultSeo, type SeoConfig } from "@/lib/siteConfigDefaults";
import { buildProductStructuredData } from "@shared/productStructuredData";
import { normalizeDateOnly, siteIdentityStructuredData, siteOrigin } from "@shared/discoverability";
import type { ProductVariantOptions } from "@shared/types";

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "product" | "article";
  noindex?: boolean;
  dateModified?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export default function SEO({
  title,
  description,
  path = "/",
  image,
  type = "website",
  noindex = false,
  dateModified,
  jsonLd,
}: SEOProps) {
  const seo = useSiteConfig<SeoConfig>("seo", defaultSeo);

  const siteUrl = seo.siteUrl || "https://turtlelittle.com";
  const siteName = seo.brandName || "TurtleLittle";
  const resolvedDescription = description ?? seo.metaDescription;
  const ogImagePath = seo.ogImageUrl || "/og-image.png";
  const defaultOgImage = ogImagePath.startsWith("http") ? ogImagePath : `${siteUrl}${ogImagePath}`;
  const resolvedImage = image
    ? (image.startsWith("http") ? image : `${siteUrl}${image}`)
    : defaultOgImage;

  const fullTitle = title
    ? `${title} | ${siteName}`
    : `${siteName} - ${seo.tagline || "Personalised Luxury Towels & Blankets"}`;
  const canonicalUrl = `${siteUrl}${path}`;
  const origin = siteOrigin(siteUrl);
  const resolvedDateModified = normalizeDateOnly(
    dateModified ?? (path === "/" ? seo.lastUpdatedDate : undefined),
  );
  const schemas = [
    ...siteIdentityStructuredData(siteName, siteUrl),
    ...(resolvedDateModified
      ? [{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${canonicalUrl}#webpage`,
          name: fullTitle,
          url: canonicalUrl,
          dateModified: resolvedDateModified,
          isPartOf: { "@id": `${origin}/#website` },
          publisher: { "@id": `${origin}/#organization` },
        }]
      : []),
    ...(jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []),
  ];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <link rel="canonical" href={canonicalUrl} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_IN" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={resolvedImage} />

      {schemas.map((schema, index) => (
        <script key={`${path}-schema-${index}`} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}

export function ProductJsonLd(product: {
  id?: string;
  name: string;
  description: string;
  price: number;
  mrp: number;
  imageUrl: string;
  slug: string;
  sku: string;
  availability?: boolean;
  imageUrls?: string[];
  variantOptions?: ProductVariantOptions;
  brandName?: string;
}) {
  const siteUrl = "https://turtlelittle.com";
  const imageUrls = product.imageUrls?.length
    ? product.imageUrls
    : product.imageUrl
      ? [product.imageUrl]
      : [];
  const schema = buildProductStructuredData({
    id: product.id || product.sku || product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    sku: product.sku,
    imageUrls,
    url: `${siteUrl}/product/${encodeURIComponent(product.slug)}`,
    brandName: product.brandName || "TurtleLittle",
    variants: product.variantOptions,
  });
  if (product.availability === false) {
    const offers = schema.offers;
    if (offers && typeof offers === "object") {
      (offers as Record<string, unknown>).availability = "https://schema.org/OutOfStock";
    }
  }
  return schema;
}

export function BreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `https://turtlelittle.com${item.url}`,
    })),
  };
}
