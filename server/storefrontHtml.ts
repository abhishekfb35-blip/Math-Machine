import type { Express, NextFunction, Request, Response } from "express";
import type { Category, Product, ProductVariantOptions } from "@shared/types";
import { buildProductStructuredData } from "@shared/productStructuredData";
import {
  businessDetails,
  siteIdentityStructuredData,
  storefrontAnswers,
  storefrontFaqStructuredData,
  storefrontIntro,
} from "@shared/discoverability";
import type { HomeSection } from "./routes/home";
import type { IStorage } from "./storage";
import type { PublicInfoContent } from "./publicInfoPages";
import {
  buildStorefrontPageData,
  type StorefrontPageData,
} from "./storefrontPageData";
import type { ShopSectionProductGroup } from "@shared/shopSections";

const SEO_START = "<!-- STOREFRONT_SEO_START -->";
const SEO_END = "<!-- STOREFRONT_SEO_END -->";
const CONTENT_MARKER = "<!-- STOREFRONT_CONTENT -->";

interface StorefrontDocumentOptions {
  getTemplate: (url: string) => Promise<string>;
  transformHtml: (url: string, html: string) => Promise<string>;
  loadHomeSections?: () => Promise<HomeSection[]>;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function absoluteUrl(path: string, siteUrl: string): string {
  try {
    const url = new URL(path, `${siteUrl}/`);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported URL protocol");
    }
    return url.href;
  } catch {
    return `${siteUrl}/og-image.png`;
  }
}

function canonicalUrl(page: StorefrontPageData): string {
  return absoluteUrl(page.canonicalPath, page.seo.siteUrl);
}

function priceText(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

function imageList(product: Product, images: { imageUrl: string }[], siteUrl: string): string[] {
  return [...new Set([product.imageUrl, ...images.map((image) => image.imageUrl)]
    .filter((value): value is string => Boolean(value))
    .map((value) => absoluteUrl(value, siteUrl)))];
}

function productCard(product: Product, siteUrl: string): string {
  const href = `/product/${encodeURIComponent(product.slug)}`;
  const image = product.imageUrl
    ? `<img src="${escapeHtml(absoluteUrl(product.imageUrl, siteUrl))}" alt="${escapeHtml(product.name)}" loading="lazy" />`
    : "";
  return `<li class="catalogue-card">
    <a href="${escapeHtml(href)}" class="catalogue-card-link">
      ${image}
      <h3 class="catalogue-card-name" style="display:inline;margin:0;font:inherit">${escapeHtml(product.name)}</h3>
    </a>
    <p class="catalogue-card-price">${escapeHtml(priceText(product.price))}</p>
  </li>`;
}

function productListing(title: string, products: Product[], siteUrl: string, subtitle = ""): string {
  return `<section class="catalogue-section">
    <h2>${escapeHtml(title)}</h2>
    ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
    <ul class="catalogue-grid">${products.map((product) => productCard(product, siteUrl)).join("")}</ul>
  </section>`;
}

function shopSectionListing(
  section: ShopSectionProductGroup,
  categories: Category[],
  siteUrl: string,
): string {
  const productCategoryIds = new Set(section.all.map(product => product.categoryId));
  const categoryLinks = categories
    .filter(category => productCategoryIds.has(category.id))
    .map(category =>
      `<a href="/category/${encodeURIComponent(category.slug)}">Shop ${escapeHtml(category.name)}</a>`,
    )
    .join(" ");

  return `<section class="catalogue-section${section.all.length ? "" : " hidden"}" data-shop-section="${escapeHtml(section.tag ?? section.label)}">
    <h2>${escapeHtml(section.label)}</h2>
    <p>${section.all.length} products</p>
    ${categoryLinks ? `<nav aria-label="${escapeHtml(section.label)} category links">${categoryLinks}</nav>` : ""}
    <ul class="catalogue-grid">${section.all.map(product => productCard(product, siteUrl)).join("")}</ul>
  </section>`;
}

function renderVariantOptions(product: Product, variants: ProductVariantOptions): string {
  const availableSizes = variants.sizes.filter((size) => !size.blurOnFront);
  if (availableSizes.length === 0) return "";

  const sizesHtml = availableSizes.map((size) => {
    const price = product.price + size.priceAdd;
    const colors = size.colors.filter((color) => !color.blurOnFront);
    const colorsHtml = colors.length
      ? `<span class="catalogue-variant-colors">Colors: ${colors.map((color) => escapeHtml(color.name)).join(", ")}</span>`
      : "";
    return `<li><strong>${escapeHtml(size.name)}</strong> — ${escapeHtml(priceText(price))}${colorsHtml}</li>`;
  }).join("");

  return `<section class="catalogue-variants">
    <h2>Available options</h2>
    <ul>${sizesHtml}</ul>
  </section>`;
}

function breadcrumbJsonLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function structuredData(page: StorefrontPageData): Record<string, unknown>[] {
  if (page.kind === "not-found") return [];
  const identity = siteIdentityStructuredData(page.seo.brandName, page.seo.siteUrl);
  if (page.kind === "home") return [...identity, storefrontFaqStructuredData()];
  if (page.kind === "product") {
    const images = imageList(page.product, page.images, page.seo.siteUrl);
    return [...identity, buildProductStructuredData({
      id: page.product.id,
      name: page.product.name,
      description: page.description,
      price: page.product.price,
      sku: page.product.sku,
      imageUrls: images,
      url: canonicalUrl(page),
      brandName: page.seo.brandName,
      variants: page.variants,
    })];
  }
  if (page.kind === "category") {
    return [...identity, breadcrumbJsonLd([
      { name: "Home", url: absoluteUrl("/", page.seo.siteUrl) },
      { name: page.category.name, url: canonicalUrl(page) },
    ])];
  }
  return identity;
}

function renderMeta(page: StorefrontPageData): string {
  const title = page.kind === "home"
    ? `${page.seo.brandName} - ${page.seo.tagline}`
    : `${page.title} | ${page.seo.brandName}`;
  const description = page.description.slice(0, 160);
  const image = absoluteUrl(page.imageUrl, page.seo.siteUrl);
  const canonical = canonicalUrl(page);
  const tags = [
    `<title data-storefront-seo>${escapeHtml(title)}</title>`,
    `<meta data-storefront-seo name="description" content="${escapeHtml(description)}" />`,
    `<link data-storefront-seo rel="canonical" href="${escapeHtml(canonical)}" />`,
    ...(page.noindex
      ? [`<meta data-storefront-seo name="robots" content="noindex, nofollow" />`]
      : []),
    `<meta data-storefront-seo property="og:title" content="${escapeHtml(title)}" />`,
    `<meta data-storefront-seo property="og:description" content="${escapeHtml(description)}" />`,
    `<meta data-storefront-seo property="og:type" content="${page.ogType}" />`,
    `<meta data-storefront-seo property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta data-storefront-seo property="og:image" content="${escapeHtml(image)}" />`,
    `<meta data-storefront-seo property="og:site_name" content="${escapeHtml(page.seo.brandName)}" />`,
    `<meta data-storefront-seo property="og:locale" content="en_IN" />`,
    `<meta data-storefront-seo name="twitter:card" content="summary_large_image" />`,
    `<meta data-storefront-seo name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta data-storefront-seo name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta data-storefront-seo name="twitter:image" content="${escapeHtml(image)}" />`,
    ...structuredData(page).map((jsonLd) =>
      `<script data-storefront-seo type="application/ld+json">${safeJson(jsonLd)}</script>`,
    ),
  ];
  return tags.join("\n  ");
}

function renderProductPage(
  product: Product,
  images: { imageUrl: string }[],
  variants: ProductVariantOptions,
  siteUrl: string,
  descriptionText: string,
): string {
  const productImages = imageList(product, images, siteUrl);
  const gallery = productImages.map((image, index) =>
    `<img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="${index === 0 ? "eager" : "lazy"}" />`,
  ).join("");
  const description = `<p>${escapeHtml(descriptionText).replace(/\n/g, "<br />")}</p>`;
  return `<main class="catalogue-product">
    <h1>${escapeHtml(product.name)}</h1>
    <div class="catalogue-product-images">${gallery}</div>
    <p class="catalogue-card-price">${escapeHtml(priceText(product.price))}</p>
    ${description}
    ${renderVariantOptions(product, variants)}
  </main>`;
}

function renderPlainText(body: string): string {
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let listType: "ul" | "ol" = "ul";
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${paragraph.map(escapeHtml).join("<br />")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) html.push(`<${listType}>${list.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</${listType}>`);
    list = [];
  };
  for (const line of body.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) {
      flushParagraph();
      flushList();
      continue;
    }
    const bullet = /^(?:•|-)\s+(.+)$/.exec(text);
    const numbered = /^\d+\.\s+(.+)$/.exec(text);
    if (bullet || numbered) {
      flushParagraph();
      const nextType = numbered ? "ol" : "ul";
      if (list.length && listType !== nextType) flushList();
      listType = nextType;
      list.push((bullet || numbered)![1]);
    } else {
      flushList();
      paragraph.push(text);
    }
  }
  flushParagraph();
  flushList();
  return html.join("");
}

function renderInfoPage(info: PublicInfoContent): string {
  if (info.kind === "contact") {
    return `<main class="catalogue-prerender-content">
      <h1>Contact Us</h1>
      <p>Have a question about a product, personalisation, delivery, or an existing order? Our customer support team is here to help.</p>
      <section><h2>Email support</h2><p><a href="mailto:${escapeHtml(businessDetails.supportEmail)}">${escapeHtml(businessDetails.supportEmail)}</a></p></section>
      <section><h2>Telephone</h2><p><a href="tel:${escapeHtml(businessDetails.telephone)}">${escapeHtml(businessDetails.supportPhone)}</a></p></section>
      <section><h2>WhatsApp</h2><p><a href="${escapeHtml(businessDetails.whatsappUrl)}">Message ${escapeHtml(businessDetails.supportPhone)}</a></p></section>
      <section><h2>Support hours</h2><p>Monday to Saturday, 10:00 AM to 6:00 PM IST</p></section>
      <section><h2>Business details</h2><p>TurtleLittle is owned and operated by ${escapeHtml(businessDetails.legalName)}.</p></section>
      <section><h2>Registered address</h2><address>${escapeHtml(businessDetails.registeredAddress)}</address></section>
    </main>`;
  }
  if (info.kind === "about") {
    const { config } = info;
    const whatsapp = config.contactWhatsapp.replace(/\D/g, "");
    return `<main class="catalogue-prerender-content">
      <h1>${escapeHtml(config.title)}</h1>
      ${renderPlainText(config.intro)}
      ${config.sections.map(section =>
        `<section><h2>${escapeHtml(section.heading)}</h2>${renderPlainText(section.body)}</section>`,
      ).join("")}
      <section><h2>Our values</h2>${config.valueCards.map(card =>
        `<article><h3>${escapeHtml(card.title)}</h3><p>${escapeHtml(card.description)}</p></article>`,
      ).join("")}</section>
      <section><h2>Get in Touch</h2><p>Reach out via WhatsApp at <a href="https://wa.me/${whatsapp}">${escapeHtml(config.contactWhatsapp)}</a> or email us at <a href="mailto:${escapeHtml(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a>. We're based in ${escapeHtml(config.contactLocation)}.</p></section>
    </main>`;
  }
  const { config } = info;
  return `<main class="catalogue-prerender-content">
    <h1>${escapeHtml(config.title)}</h1>
    <p>Last updated: ${escapeHtml(config.lastUpdated)}</p>
    ${config.sections.map(section =>
      `<section><h2>${escapeHtml(section.heading)}</h2>${renderPlainText(section.body)}</section>`,
    ).join("")}
  </main>`;
}

function renderHomeAnswers(): string {
  return `<section class="catalogue-section">
    <h2>Questions about TurtleLittle</h2>
    ${storefrontAnswers.map(({ question, answer }) =>
      `<article><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></article>`,
    ).join("")}
    <p><a href="/shipping">Shipping policy</a> · <a href="/refund-policy">Refund &amp; cancellation policy</a></p>
  </section>`;
}

function renderPageContent(page: StorefrontPageData): string {
  switch (page.kind) {
    case "home":
      return `<main class="catalogue-prerender-content">
        <h1>${escapeHtml(page.seo.tagline)}</h1>
        <p>${escapeHtml(storefrontIntro)}</p>
        ${page.sections.map((section) =>
          productListing(section.title, section.products, page.seo.siteUrl, section.subtitle),
        ).join("")}
        ${renderHomeAnswers()}
      </main>`;
    case "shop":
      return `<main class="catalogue-prerender-content">
        <h1>Shop All Products</h1>
        ${page.sections.map(section => shopSectionListing(section, page.categories, page.seo.siteUrl)).join("")}
      </main>`;
    case "category":
      return `<main class="catalogue-prerender-content">
        <h1>${escapeHtml(page.category.name)}</h1>
        <p>${page.products.length} products</p>
        ${productListing(page.category.name, page.products, page.seo.siteUrl)}
      </main>`;
    case "product":
      return renderProductPage(
        page.product,
        page.images,
        page.variants,
        page.seo.siteUrl,
        page.description,
      );
    case "info":
      return renderInfoPage(page.info);
    case "not-found":
      return `<main class="catalogue-prerender-content">
        <h1>${page.entity === "product" ? "Product not found" : "Category not found"}</h1>
        <a href="/shop">Browse the shop</a>
      </main>`;
  }
}

function renderSnapshot(page: StorefrontPageData): string {
  const content = renderPageContent(page);
  const queryData = safeJson({ queries: page.queries });
  return `<div id="catalogue-prerender" aria-label="Store catalogue">${content}</div>
    <script id="catalogue-initial-data" type="application/json">${queryData}</script>`;
}

export function injectStorefrontPage(template: string, page: StorefrontPageData): string {
  const seoBlock = `${SEO_START}\n  ${renderMeta(page)}\n  ${SEO_END}`;
  const seoPattern = new RegExp(`${SEO_START}[\\s\\S]*?${SEO_END}`);
  if (!seoPattern.test(template)) {
    throw new Error("Storefront SEO markers are missing from the HTML template");
  }
  if (!template.includes(CONTENT_MARKER)) {
    throw new Error("Storefront content marker is missing from the HTML template");
  }
  return template
    .replace(seoPattern, seoBlock)
    .replace(CONTENT_MARKER, renderSnapshot(page));
}

export function registerStorefrontDocumentRoutes(
  app: Express,
  storage: IStorage,
  options: StorefrontDocumentOptions,
): void {
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    try {
      const page = await buildStorefrontPageData(
        req.originalUrl,
        storage,
        options.loadHomeSections,
      );
      if (!page) return next();
      const template = await options.getTemplate(req.originalUrl);
      const injectedHtml = injectStorefrontPage(template, page);
      const html = await options.transformHtml(req.originalUrl, injectedHtml);
      res
        .status(page.kind === "not-found" ? 404 : 200)
        .set({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        })
        .send(html);
    } catch (error) {
      console.error("Storefront document rendering failed:", error);
      res
        .status(500)
        .set({
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        })
        .send("Storefront page could not be rendered");
    }
  });
}