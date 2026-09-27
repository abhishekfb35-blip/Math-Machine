import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Category, Product, ProductImage, ProductVariantOptions } from "@shared/types";
import type { HomeSection } from "../server/routes/home";
import type { IStorage } from "../server/storage";
import { registerStorefrontDocumentRoutes } from "../server/storefrontHtml";
import { loadPublicInfoPage } from "../server/publicInfoPages";
import { registerSeoRoutes } from "../server/routes/seo";
import { storefrontAnswers } from "@shared/discoverability";
import { defaultAboutPage } from "../client/src/lib/siteConfigDefaults";

const product = {
  id: "product-1",
  name: "Embroidered <Cotton> Towel",
  slug: "embroidered-cotton-towel",
  sku: "TL-100",
  price: 599,
  mrp: 799,
  imageUrl: "/images/towel-primary.jpg",
  description: "Soft cotton </script><script>window.injected=true</script> towel.",
  active: true,
  categoryId: "category-1",
} as unknown as Product;

const shopSectionConfig = [
  { label: "Kids Towels", tag: "kids-towels", tags: ["kids towel"], maxShown: 1, enabled: true },
  { label: "Adult Towels", tag: "adult-towels", tags: ["adult towel"], maxShown: 1, enabled: true },
  { label: "Couple Towels", tag: "couple-towels", tags: ["couple towel"], maxShown: 1, enabled: true },
  { label: "Kids Blankets", tag: "kids-blankets", tags: ["kids blanket"], maxShown: 1, enabled: true },
  { label: "Kids Bathrobes", tag: "kids-bathrobes", tags: ["kids bathrobe"], maxShown: 1, enabled: true },
  { label: "Adult Bathrobes", tag: "adult-bathrobes", tags: ["adult bathrobe"], maxShown: 1, enabled: true },
  { label: "Couple Bathrobes", tag: "couple-bathrobes", tags: ["couple bathrobe"], maxShown: 1, enabled: true },
];

function shopProduct(id: string, tagNames: string[]): Product {
  return {
    ...product,
    id,
    name: id,
    slug: id,
    tagNames,
  } as Product;
}

const shopProducts = [
  { ...product, tagNames: ["KIDS TOWEL"] } as Product,
  shopProduct("adult-towel", ["adult towel"]),
  shopProduct("couple-towel", ["couple towel"]),
  shopProduct("kids-blanket", ["kids blanket"]),
  shopProduct("kids-bathrobe", ["kids bathrobe"]),
  shopProduct("adult-bathrobe", ["adult bathrobe"]),
  shopProduct("couple-bathrobe", ["couple bathrobe"]),
  shopProduct("shared-kids-couple-towel", ["kids towel", "couple towel"]),
  shopProduct("unassigned-product", []),
];

const category = {
  id: "category-1",
  name: "Bath Towels",
  slug: "bath-towels",
  description: "Personalised bath towels.",
  imageUrl: "/images/bath-towels.jpg",
} as unknown as Category;

const productImages = [
  {
    id: "image-1",
    productId: product.id,
    imageUrl: "/images/towel-detail.jpg",
    sortOrder: 1,
  },
] as unknown as ProductImage[];

const variants = {
  productId: product.id,
  sizes: [
    {
      name: "Bath",
      priceAdd: 100,
      blurOnFront: false,
      colors: [{ name: "Ivory", blurOnFront: false }],
    },
  ],
} as unknown as ProductVariantOptions;

const template = `<!doctype html>
<html><head><!-- STOREFRONT_SEO_START --><title>Default</title><!-- STOREFRONT_SEO_END --></head>
<body><!-- STOREFRONT_CONTENT --><div id="root"></div></body></html>`;

function readSchemas(html: string): Record<string, any>[] {
  return [...html.matchAll(/<script data-storefront-seo type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

function readInitialData(html: string): { queries: { queryKey: string[]; data: any }[] } {
  const match = html.match(/<script id="catalogue-initial-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match, "response should include initial query data");
  return JSON.parse(match[1]);
}

test("storefront routes return crawlable catalogue HTML to every user agent", async () => {
  const aboutConfig = {
    title: "About <TurtleLittle>",
    intro: "We make embroidered gifts </script><script>alert(1)</script>.",
    sections: [{ heading: "What We Do", body: "Personalised towels and blankets." }],
    valueCards: [{ title: "Made with care", description: "Custom embroidery." }],
    contactWhatsapp: "+91 99900 79722",
    contactEmail: "hello@turtlelittle.com",
    contactLocation: "New Delhi, India",
  };
  const shippingConfig = {
    title: "Shipping Policy",
    lastUpdated: "September 2026",
    sections: [{
      heading: "Dispatch and delivery",
      body: "After dispatch, estimates are:\n• Metro: 2-4 business days\n• Other cities: 4-7 business days",
    }],
  };
  const storage = {
    getSiteContent: async (key: string) => {
      if (key === "shop-sections") {
        return { key, value: JSON.stringify(shopSectionConfig) };
      }
      return {
        key: "seo",
        value: JSON.stringify({
          brandName: "TurtleLittle",
          tagline: "Personalised Towels",
          metaDescription: "Luxury personalised towels.",
          ogImageUrl: "/images/og.jpg",
          siteUrl: "https://shop.example",
        }),
      };
    },
    getProducts: async () => shopProducts,
    getCategories: async () => [category],
    getCategoryBySlug: async (slug: string) => slug === category.slug ? category : undefined,
    getProductsByCategory: async () => [product],
    getProductBySlug: async (slug: string) => slug === product.slug ? product : undefined,
    getProductImages: async () => productImages,
    getProductVariantOptions: async () => variants,
    getAllSiteConfigs: async () => [],
    getAllSiteContents: async () => [
      { key: "page-about", value: JSON.stringify(aboutConfig) },
      { key: "page-shipping", value: JSON.stringify(shippingConfig) },
    ],
  } as unknown as IStorage;

  const app = express();
  registerStorefrontDocumentRoutes(app, storage, {
    getTemplate: async () => template,
    transformHtml: async (_url, html) => html,
    loadHomeSections: async () => [
      {
        title: "Popular towels",
        subtitle: "Personalised for you",
        products: [product],
      } as unknown as HomeSection,
    ],
  });

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  try {
    const fetchPage = async (path: string, userAgent: string) => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: { "user-agent": userAgent },
      });
      return { response, html: await response.text() };
    };

    const routes = [
      "/", "/shop", "/category/bath-towels", "/product/embroidered-cotton-towel",
      "/about", "/contact", "/shipping", "/terms", "/privacy", "/refund-policy",
    ];
    const pages = new Map<string, string>();
    for (const route of routes) {
      const ordinary = await fetchPage(route, "Mozilla/5.0 storefront test");
      const crawler = await fetchPage(route, "Googlebot");
      assert.equal(ordinary.response.status, 200, `${route} should return 200`);
      assert.equal(crawler.response.status, 200, `${route} should return 200 for Googlebot`);
      assert.equal(crawler.html, ordinary.html, `${route} must not vary by user agent`);
      assert.match(ordinary.html, /id="catalogue-prerender"/);
      assert.match(ordinary.html, /id="catalogue-initial-data"/);
      pages.set(route, ordinary.html);
    }

    const home = pages.get("/")!;
    assert.match(home, /<title data-storefront-seo>TurtleLittle - Personalised Towels<\/title>/);
    assert.match(home, /Popular towels/);
    assert.match(home, /href="\/product\/embroidered-cotton-towel"/);
    assert.match(home, /https:\/\/shop\.example\/images\/towel-primary\.jpg/);
    assert.match(home, /TurtleLittle makes personalised embroidered towels/);
    assert.match(home, /<h3>What products does TurtleLittle make\?<\/h3>/);
    const homeSchemas = readSchemas(home);
    assert.deepEqual(homeSchemas.map(schema => schema["@type"]), ["OnlineStore", "WebSite", "FAQPage"]);
    assert.equal(homeSchemas[0].legalName, "Pandora Innovations");
    assert.equal(homeSchemas[1].publisher["@id"], "https://shop.example/#organization");
    assert.equal(homeSchemas[2].mainEntity[0].acceptedAnswer.text, storefrontAnswers[0].answer);

    const shop = pages.get("/shop")!;
    assert.match(shop, /<title data-storefront-seo>Shop All Products \| TurtleLittle<\/title>/);
    assert.match(shop, /Embroidered &lt;Cotton&gt; Towel/);
    assert.match(shop, /₹599/);
    for (const section of shopSectionConfig) {
      assert.match(shop, new RegExp(`<h2>${section.label}<\\/h2>`));
    }
    assert.match(shop, /href="\/category\/bath-towels">Shop Bath Towels<\/a>/);
    const shopProductLinks = [...shop.matchAll(/href="\/product\/([^"]+)"/g)].map(match => match[1]);
    assert.equal(shopProductLinks.length, 10, "overlapping products should appear in each matching section");
    assert.equal(new Set(shopProductLinks).size, shopProducts.length, "every unique product should remain reachable");

    const shopInitialData = readInitialData(shop);
    const shopSectionQuery = shopInitialData.queries.find((entry: { queryKey: unknown[] }) =>
      entry.queryKey.join("/") === "/api/site-config/shop-sections",
    );
    assert.equal(shopSectionQuery.data.value.length, shopSectionConfig.length);
    const shopProductsQuery = shopInitialData.queries.find((entry: { queryKey: unknown[] }) =>
      entry.queryKey.join("/") === "/api/products",
    );
    assert.equal(shopProductsQuery.data.length, shopProducts.length);

    const categoryPage = pages.get("/category/bath-towels")!;
    assert.match(categoryPage, /<title data-storefront-seo>Bath Towels \| TurtleLittle<\/title>/);
    assert.match(categoryPage, /<h1>Bath Towels<\/h1>/);
    assert.match(categoryPage, /1 products/);

    const productPage = pages.get("/product/embroidered-cotton-towel")!;
    assert.match(productPage, /<meta data-storefront-seo property="og:type" content="product"/);
    assert.match(productPage, /https:\/\/shop\.example\/images\/towel-detail\.jpg/);
    assert.match(productPage, /Available options/);
    assert.match(productPage, /Ivory/);
    assert.match(productPage, /₹699/);
    assert.doesNotMatch(productPage, /<\/script><script>window\.injected/);

    const structuredData = readSchemas(productPage).find(schema => schema["@type"] === "ProductGroup");
    assert.ok(structuredData, "product response should include ProductGroup JSON-LD");
    assert.equal(structuredData["@type"], "ProductGroup");
    assert.equal(structuredData.hasVariant[0].offers.price, 699);
    assert.equal(structuredData.hasVariant[0].color, "Ivory");

    const initialData = readInitialData(productPage);
    assert.ok(initialData.queries.some((entry: { queryKey: unknown[] }) =>
      entry.queryKey.join("/") === `/api/products/${product.slug}`,
    ));

    const about = pages.get("/about")!;
    assert.match(about, /<title data-storefront-seo>About Us \| TurtleLittle<\/title>/);
    assert.match(about, /<h1>About &lt;TurtleLittle&gt;<\/h1>/);
    assert.match(about, /href="https:\/\/shop\.example\/about"/);
    assert.match(about, /We make embroidered gifts &lt;\/script&gt;/);
    assert.doesNotMatch(about, /<script>alert\(1\)<\/script>/);
    assert.equal(readInitialData(about).queries.find(entry => entry.queryKey[0] === "/api/site-config")?.data["page-about"].title, aboutConfig.title);

    const shipping = pages.get("/shipping")!;
    assert.match(shipping, /<h2>Dispatch and delivery<\/h2>/);
    assert.match(shipping, /<ul><li>Metro: 2-4 business days<\/li><li>Other cities: 4-7 business days<\/li><\/ul>/);
    assert.equal(readInitialData(shipping).queries.find(entry => entry.queryKey[0] === "/api/site-config")?.data["page-shipping"].lastUpdated, "September 2026");

    for (const route of ["/terms", "/privacy", "/refund-policy", "/contact"]) {
      const info = pages.get(route)!;
      assert.match(info, /<h1>[^<]+<\/h1>/, `${route} should contain meaningful HTML`);
      assert.match(info, new RegExp(`href="https://shop\\.example${route}"`));
      assert.ok(readSchemas(info).some(schema => schema["@type"] === "OnlineStore"));
    }
    assert.match(pages.get("/contact")!, /Pandora Innovations/);
    const trailingSlash = await fetchPage("/about/", "Mozilla/5.0");
    assert.equal(trailingSlash.response.status, 200);
    assert.match(trailingSlash.html, /href="https:\/\/shop\.example\/about"/);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("legacy saved About sections remain visible instead of being replaced by defaults", async () => {
  const legacyAbout = {
    title: "Our saved story",
    sections: [{ heading: "Our workshop", body: "A detail written by the shop owner." }],
  };
  const storage = {
    getAllSiteConfigs: async () => [],
    getAllSiteContents: async () => [{ key: "page-about", value: JSON.stringify(legacyAbout) }],
  } as unknown as IStorage;

  const loaded = await loadPublicInfoPage("/about", storage);
  assert.equal(loaded?.content.kind, "about");
  if (!loaded || loaded.content.kind !== "about") return;
  assert.equal(loaded.content.config.title, legacyAbout.title);
  assert.deepEqual(loaded.content.config.sections, legacyAbout.sections);
  assert.equal(loaded.content.config.intro, defaultAboutPage.intro);
  assert.deepEqual(loaded.siteConfig["page-about"], loaded.content.config);
});

test("discovery files use the same configured origin as page canonicals", async () => {
  const storage = {
    getSiteContent: async () => ({
      key: "seo",
      value: JSON.stringify({ siteUrl: "https://shop.example/some-path" }),
    }),
    getCategories: async () => [category],
    getProducts: async () => [product],
  } as unknown as IStorage;
  const app = express();
  registerSeoRoutes(app, storage);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;

  try {
    const get = async (path: string) => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 200);
      return response.text();
    };
    const robots = await get("/robots.txt");
    const llms = await get("/llms.txt");
    const sitemap = await get("/sitemap.xml");
    assert.match(robots, /Sitemap: https:\/\/shop\.example\/sitemap\.xml/);
    assert.match(llms, /https:\/\/shop\.example\/about/);
    assert.match(sitemap, /<loc>https:\/\/shop\.example\/contact<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/shop\.example\/product\/embroidered-cotton-towel<\/loc>/);
    assert.doesNotMatch(`${robots}${llms}${sitemap}`, /https:\/\/turtlelittle\.com/);
  } finally {
    server.close();
    await once(server, "close");
  }
});