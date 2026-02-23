import { Helmet } from "react-helmet-async";

const SITE_NAME = "TurtleLittle";
const SITE_URL = "https://turtlelittle.com";
const DEFAULT_DESCRIPTION = "Personalised luxury embroidered towels, blankets & bathrobes. Premium quality, handcrafted with your name. Buy 2 Get 1 Free. Delivered across India.";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

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
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = DEFAULT_IMAGE,
  type = "website",
  noindex = false,
  jsonLd,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Personalised Luxury Towels & Blankets`;
  const canonicalUrl = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_IN" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

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
