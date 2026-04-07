import { Helmet } from "react-helmet-async";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { defaultSeo, type SeoConfig } from "@/lib/siteConfigDefaults";

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "product" | "article";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export default function SEO({
  title,
  description,
  path = "/",
  image,
  type = "website",
  noindex = false,
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

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(jsonLd) ? jsonLd : jsonLd)}
        </script>
      )}
    </Helmet>
  );
}

export function ProductJsonLd(product: {
  name: string;
  description: string;
  price: number;
  mrp: number;
  imageUrl: string;
  slug: string;
  sku: string;
  availability?: boolean;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    ...(product.imageUrl ? { image: `https://turtlelittle.com${product.imageUrl}` } : {}),
    url: `https://turtlelittle.com/product/${product.slug}`,
    sku: product.sku,
    brand: {
      "@type": "Brand",
      name: "TurtleLittle",
    },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "INR",
      availability: product.availability !== false
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "TurtleLittle",
      },
    },
  };
}

export function OrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TurtleLittle",
    url: "https://turtlelittle.com",
    logo: "https://turtlelittle.com/icon-512.png",
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+91-99900-79722",
      contactType: "customer service",
      availableLanguage: ["English", "Hindi"],
    },
    sameAs: [],
  };
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
