export const businessDetails = {
  legalName: "Pandora Innovations",
  supportEmail: "hello@turtlelittle.com",
  supportPhone: "+91 99900 79722",
  telephone: "+919990079722",
  whatsappUrl: "https://wa.me/919990079722",
  registeredAddress: "1st Floor, B-30, Sector - 8, Noida, Uttar Pradesh, India - 201301",
} as const;

export const publicInfoMetadata = {
  about: {
    title: "About Us",
    description: "Learn about TurtleLittle - makers of personalised luxury embroidered towels and blankets, handcrafted in India and delivered only within India.",
  },
  contact: {
    title: "Contact Us",
    description: "Contact TurtleLittle customer support by email, telephone, or WhatsApp. TurtleLittle is owned and operated by Pandora Innovations.",
  },
  shipping: {
    title: "Shipping Policy",
    description: "Read TurtleLittle's shipping policy for processing, delivery estimates and tracking. Delivery is available only within India.",
  },
  terms: {
    title: "Terms & Conditions",
    description: "Read TurtleLittle's terms for personalised embroidered products, including orders, shipping and returns.",
  },
  privacy: {
    title: "Privacy Policy",
    description: "Learn how TurtleLittle handles customer information, personalisation details, cookies and data requests.",
  },
  "refund-policy": {
    title: "Refund Policy",
    description: "Read TurtleLittle's refund and cancellation policy for made-to-order products, eligible returns and how to request help.",
  },
} as const;

export type PublicInfoPath = keyof typeof publicInfoMetadata;

export const storefrontIntro =
  "TurtleLittle makes personalised embroidered towels, blankets and bathrobes for kids, adults and couples. Choose a product, add your name or initials, and explore gifts for everyday use and special occasions. Delivery is available only within India.";

export const storefrontAnswers = [
  {
    question: "What products does TurtleLittle make?",
    answer: "TurtleLittle makes personalised embroidered towels, blankets and bathrobes for kids, adults and couples.",
  },
  {
    question: "How do I personalise an item?",
    answer: "Choose a product, select the available options, and enter the name or initials you want embroidered before adding it to your cart.",
  },
  {
    question: "Does TurtleLittle deliver outside India?",
    answer: "No. TurtleLittle delivers only within India. See the Shipping Policy for delivery estimates and charges.",
  },
] as const;

export function siteOrigin(siteUrl: unknown): string {
  if (typeof siteUrl !== "string") return "https://turtlelittle.com";
  try {
    const url = new URL(siteUrl);
    if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
  } catch {
    // Use the site's configured default when an admin URL is malformed.
  }
  return "https://turtlelittle.com";
}

export function normalizeDateOnly(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return undefined;
  return value;
}

export function formatDateOnly(value: string): string {
  const dateOnly = normalizeDateOnly(value);
  if (!dateOnly) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00.000Z`));
}

export function siteIdentityStructuredData(brandName: string, siteUrl: string): Record<string, unknown>[] {
  const origin = siteOrigin(siteUrl);
  const organizationId = `${origin}/#organization`;
  return [
    {
      "@context": "https://schema.org",
      "@type": ["Organization", "OnlineStore"],
      "@id": organizationId,
      name: brandName,
      legalName: businessDetails.legalName,
      url: origin,
      logo: `${origin}/icon-512.png`,
      address: {
        "@type": "PostalAddress",
        streetAddress: "1st Floor, B-30, Sector - 8",
        addressLocality: "Noida",
        addressRegion: "Uttar Pradesh",
        postalCode: "201301",
        addressCountry: "IN",
      },
      areaServed: {
        "@type": "Country",
        name: "India",
      },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: businessDetails.telephone,
        email: businessDetails.supportEmail,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      name: brandName,
      url: origin,
      publisher: { "@id": organizationId },
      inLanguage: "en-IN",
    },
  ];
}

export function storefrontFaqStructuredData(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: storefrontAnswers.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}