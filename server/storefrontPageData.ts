import type { Category, Product, ProductImage, ProductVariantOptions } from "@shared/types";
import {
  groupProductsByShopSections,
  normalizeShopSections,
  type ShopSectionProductGroup,
} from "@shared/shopSections";
import { normalizeDateOnly, publicInfoMetadata } from "@shared/discoverability";
import { getHomeCollections, type HomeSection } from "./routes/home";
import { loadPublicInfoPage, type PublicInfoContent } from "./publicInfoPages";
import type { IStorage } from "./storage";

export interface StorefrontSeoSettings {
  brandName: string;
  tagline: string;
  metaDescription: string;
  ogImageUrl: string;
  siteUrl: string;
  lastUpdatedDate: string;
}

export interface InitialQuery {
  queryKey: (string | number)[];
  data: unknown;
}

interface StorefrontPageBase {
  title: string;
  description: string;
  canonicalPath: string;
  imageUrl: string;
  ogType: "website" | "product";
  noindex: boolean;
  dateModified?: string;
  seo: StorefrontSeoSettings;
  queries: InitialQuery[];
}

export type StorefrontPageData =
  | (StorefrontPageBase & {
      kind: "home";
      sections: HomeSection[];
    })
  | (StorefrontPageBase & {
      kind: "shop";
      products: Product[];
      categories: Category[];
      sections: ShopSectionProductGroup[];
    })
  | (StorefrontPageBase & {
      kind: "category";
      category: Category;
      products: Product[];
    })
  | (StorefrontPageBase & {
      kind: "product";
      product: Product;
      images: ProductImage[];
      variants: ProductVariantOptions;
    })
  | (StorefrontPageBase & {
      kind: "info";
      info: PublicInfoContent;
    })
  | (StorefrontPageBase & {
      kind: "not-found";
      entity: "category" | "product";
    });

const DEFAULT_SEO: StorefrontSeoSettings = {
  brandName: "TurtleLittle",
  tagline: "Personalised Luxury Towels & Blankets",
  metaDescription:
    "Personalised luxury embroidered towels, blankets & bathrobes. Premium quality, handcrafted with your name. Buy 2 Get 1 Free. Delivered only within India.",
  ogImageUrl: "/og-image.png",
  siteUrl: "https://turtlelittle.com",
  lastUpdatedDate: "",
};

const SHOP_DESCRIPTION =
  "Browse our complete collection of personalised luxury towels, blankets & bathrobes. Buy 2 Get 1 Free.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function siteOrigin(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_SEO.siteUrl;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return DEFAULT_SEO.siteUrl;
    return parsed.origin;
  } catch {
    return DEFAULT_SEO.siteUrl;
  }
}

async function loadSeoSettings(storage: IStorage): Promise<StorefrontSeoSettings> {
  const row = await storage.getSiteContent("seo");
  if (!row?.value) return DEFAULT_SEO;

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.value);
  } catch (error) {
    console.error("Invalid SEO site content; using defaults:", error);
    return DEFAULT_SEO;
  }

  if (!isRecord(parsed)) return DEFAULT_SEO;
  const stringValue = (key: keyof StorefrontSeoSettings, fallback: string) =>
    typeof parsed[key] === "string" && parsed[key].trim()
      ? (parsed[key] as string).trim()
      : fallback;

  return {
    brandName: stringValue("brandName", DEFAULT_SEO.brandName),
    tagline: stringValue("tagline", DEFAULT_SEO.tagline),
    metaDescription: stringValue("metaDescription", DEFAULT_SEO.metaDescription),
    ogImageUrl: stringValue("ogImageUrl", DEFAULT_SEO.ogImageUrl),
    siteUrl: siteOrigin(parsed.siteUrl),
    lastUpdatedDate: normalizeDateOnly(parsed.lastUpdatedDate) ?? "",
  };
}

function parseUrl(url: string): URL {
  return new URL(url, "http://storefront.local");
}

function pageBase(
  seo: StorefrontSeoSettings,
  title: string,
  description: string,
  canonicalPath: string,
  options: {
    imageUrl?: string;
    ogType?: "website" | "product";
    noindex?: boolean;
    dateModified?: string;
  } = {},
): StorefrontPageBase {
  return {
    title,
    description,
    canonicalPath,
    imageUrl: options.imageUrl || seo.ogImageUrl,
    ogType: options.ogType || "website",
    noindex: options.noindex || false,
    dateModified: normalizeDateOnly(options.dateModified),
    seo,
    queries: [],
  };
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

async function loadHomePage(
  seo: StorefrontSeoSettings,
  loadHomeSections: () => Promise<HomeSection[]>,
): Promise<StorefrontPageData> {
  const sections = await loadHomeSections();
  return {
    ...pageBase(seo, seo.tagline, seo.metaDescription, "/", {
      dateModified: seo.lastUpdatedDate,
    }),
    kind: "home",
    sections,
    queries: [{ queryKey: ["/api/home/collections"], data: sections }],
  };
}

async function loadShopPage(
  storage: IStorage,
  seo: StorefrontSeoSettings,
): Promise<StorefrontPageData> {
  const [products, categories, shopSectionsRow] = await Promise.all([
    storage.getProducts(),
    storage.getCategories(),
    storage.getSiteContent("shop-sections"),
  ]);
  let shopSectionsValue: unknown = null;
  if (shopSectionsRow) {
    try {
      shopSectionsValue = JSON.parse(shopSectionsRow.value);
    } catch (error) {
      console.error("Invalid shop-sections site content; rendering uncategorized products:", error);
      shopSectionsValue = shopSectionsRow.value;
    }
  }
  const shopSections = normalizeShopSections(shopSectionsValue);
  return {
    ...pageBase(seo, "Shop All Products", SHOP_DESCRIPTION, "/shop"),
    kind: "shop",
    products,
    categories,
    sections: groupProductsByShopSections(products, categories, shopSections),
    queries: [
      { queryKey: ["/api/products"], data: products },
      { queryKey: ["/api/categories"], data: categories },
      {
        queryKey: ["/api/site-config", "shop-sections"],
        data: shopSectionsRow ? { key: shopSectionsRow.key, value: shopSectionsValue } : null,
      },
    ],
  };
}

async function loadCategoryPage(
  slug: string,
  storage: IStorage,
  seo: StorefrontSeoSettings,
): Promise<StorefrontPageData> {
  const category = await storage.getCategoryBySlug(slug);
  if (!category) {
    return {
      ...pageBase(seo, "Category not found", seo.metaDescription, `/category/${encodePathPart(slug)}`, {
        noindex: true,
      }),
      kind: "not-found",
      entity: "category",
    };
  }

  const products = await storage.getProductsByCategory(category.id);
  const description =
    category.description?.trim() ||
    `Shop ${category.name} from ${seo.brandName}. Personalised luxury embroidered products, handcrafted with love. Buy 2 Get 1 Free.`;
  return {
    ...pageBase(
      seo,
      category.name,
      description,
      `/category/${encodePathPart(category.slug)}`,
      { imageUrl: category.imageUrl || undefined },
    ),
    kind: "category",
    category,
    products,
    queries: [
      { queryKey: ["/api/categories", slug], data: category },
      { queryKey: ["/api/products/category", category.id], data: products },
    ],
  };
}

async function loadProductPage(
  slug: string,
  storage: IStorage,
  seo: StorefrontSeoSettings,
): Promise<StorefrontPageData> {
  const product = await storage.getProductBySlug(slug);
  if (!product) {
    return {
      ...pageBase(seo, "Product not found", seo.metaDescription, `/product/${encodePathPart(slug)}`, {
        noindex: true,
      }),
      kind: "not-found",
      entity: "product",
    };
  }

  const [images, variants, categories] = await Promise.all([
    storage.getProductImages(product.id),
    storage.getProductVariantOptions(product.id),
    storage.getCategories(),
  ]);
  const description =
    product.description?.replace(/\s+/g, " ").trim() ||
    `Personalised ${product.name} — luxury embroidered product by ${seo.brandName}.`;
  return {
    ...pageBase(seo, product.name, description, `/product/${encodePathPart(product.slug)}`, {
      imageUrl: product.imageUrl || undefined,
      ogType: "product",
      noindex: product.active === false,
    }),
    kind: "product",
    product,
    images,
    variants,
    queries: [
      { queryKey: ["/api/products", slug], data: product },
      { queryKey: ["/api/categories"], data: categories },
      { queryKey: ["/api/products", product.id, "images"], data: images },
      { queryKey: ["/api/products", product.id, "variant-options"], data: variants },
    ],
  };
}

export async function buildStorefrontPageData(
  url: string,
  storage: IStorage,
  loadHomeSections: () => Promise<HomeSection[]> = getHomeCollections,
): Promise<StorefrontPageData | null> {
  const parsed = parseUrl(url);
  const { pathname } = parsed;

  const isHome = pathname === "/";
  const isShop = pathname === "/shop";
  const categoryMatch = /^\/category\/([^/]+)\/?$/.exec(pathname);
  const productMatch = /^\/product\/([^/]+)\/?$/.exec(pathname);
  const isInfo = /^\/(?:about|contact|shipping|terms|privacy|refund-policy)\/?$/.test(pathname);
  if (!isHome && !isShop && !categoryMatch && !productMatch && !isInfo) return null;

  const seo = await loadSeoSettings(storage);
  if (isHome) return loadHomePage(seo, loadHomeSections);
  if (isShop) return loadShopPage(storage, seo);
  if (isInfo) {
    const infoPage = await loadPublicInfoPage(pathname, storage);
    if (!infoPage) return null;
    const metadata = publicInfoMetadata[infoPage.path];
    const dateModified = infoPage.content.kind === "about" || infoPage.content.kind === "policy"
      ? infoPage.content.config.lastUpdatedDate
      : undefined;
    return {
      ...pageBase(seo, metadata.title, metadata.description, `/${infoPage.path}`, { dateModified }),
      kind: "info",
      info: infoPage.content,
      queries: [{ queryKey: ["/api/site-config"], data: infoPage.siteConfig }],
    };
  }
  if (categoryMatch) {
    return loadCategoryPage(decodeURIComponent(categoryMatch[1]), storage, seo);
  }
  return loadProductPage(decodeURIComponent(productMatch![1]), storage, seo);
}