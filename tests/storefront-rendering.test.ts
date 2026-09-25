import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Category, Product, ProductImage, ProductVariantOptions } from "@shared/types";
import type { HomeSection } from "../server/routes/home";
import type { IStorage } from "../server/storage";
import { registerStorefrontDocumentRoutes } from "../server/storefrontHtml";

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

test("storefront routes return crawlable catalogue HTML to every user agent", async () => {
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

    const routes = ["/", "/shop", "/category/bath-towels", "/product/embroidered-cotton-towel"];
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

    const shopInitialDataMatch = shop.match(
      /<script id="catalogue-initial-data" type="application\/json">([\s\S]*?)<\/script>/,
    );
    assert.ok(shopInitialDataMatch, "shop response should preload section configuration");
    const shopInitialData = JSON.parse(shopInitialDataMatch[1]);
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

    const structuredDataMatch = productPage.match(
      /<script data-storefront-seo type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    assert.ok(structuredDataMatch, "product response should include JSON-LD");
    const structuredData = JSON.parse(structuredDataMatch[1]);
    assert.equal(structuredData["@type"], "ProductGroup");
    assert.equal(structuredData.hasVariant[0].offers.price, 699);
    assert.equal(structuredData.hasVariant[0].color, "Ivory");

    const initialDataMatch = productPage.match(
      /<script id="catalogue-initial-data" type="application\/json">([\s\S]*?)<\/script>/,
    );
    assert.ok(initialDataMatch, "response should preload interactive query data");
    const initialData = JSON.parse(initialDataMatch[1]);
    assert.ok(initialData.queries.some((entry: { queryKey: unknown[] }) =>
      entry.queryKey.join("/") === `/api/products/${product.slug}`,
    ));
  } finally {
    server.close();
    await once(server, "close");
  }
});