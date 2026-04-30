import { z } from "zod";
import type { Express } from "express";
import type { Request } from "express";
import { storage } from "../storage";
import { getAuthenticatedCustomer } from "./helpers";
import type { Product, Attributes } from "@shared/types";

const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().min(10, "Review must be at least 10 characters"),
});

/** Safely extract the first string value from an Express query param (handles string | string[] | undefined). */
function qs(val: unknown): string {
  if (typeof val === "string") return val.trim();
  if (Array.isArray(val) && typeof val[0] === "string") return (val[0] as string).trim();
  return "";
}

/**
 * Parse attribute filter query params that accept either a name or an ID.
 * Returns a resolved lowercase name, or undefined if no filter specified.
 *
 * Accepted query param pairs (for each type):
 *   ageGroup / ageGroupId
 *   gender   / genderId
 *   theme    / themeId
 *   style    / styleId
 */
async function resolveAttributeFilters(
  req: Request,
): Promise<{
  ageGroupName?: string;
  genderName?: string;
  themeName?: string;
  styleName?: string;
}> {
  const ageGroupRaw = qs(req.query.ageGroup);
  const ageGroupId  = qs(req.query.ageGroupId);
  const genderRaw   = qs(req.query.gender);
  const genderId    = qs(req.query.genderId);
  const themeRaw    = qs(req.query.theme);
  const themeId     = qs(req.query.themeId);
  const styleRaw    = qs(req.query.style);
  const styleId     = qs(req.query.styleId);

  const needsLookup = ageGroupId || genderId || themeId || styleId;

  let attrs: Attributes | undefined;
  if (needsLookup) {
    attrs = await storage.getAttributes();
  }

  const resolveId = (
    id: string,
    list: { id: string; name: string }[],
  ): string | undefined => list.find(a => a.id === id)?.name.toLowerCase();

  const ageGroupName = ageGroupId
    ? resolveId(ageGroupId, attrs?.ageGroups ?? [])
    : (ageGroupRaw ? ageGroupRaw.toLowerCase() : undefined);

  const genderName = genderId
    ? resolveId(genderId, attrs?.genders ?? [])
    : (genderRaw ? genderRaw.toLowerCase() : undefined);

  const themeName = themeId
    ? resolveId(themeId, attrs?.themes ?? [])
    : (themeRaw ? themeRaw.toLowerCase() : undefined);

  const styleName = styleId
    ? resolveId(styleId, attrs?.styles ?? [])
    : (styleRaw ? styleRaw.toLowerCase() : undefined);

  return { ageGroupName, genderName, themeName, styleName };
}

function applyAttributeFilters(
  prods: Product[],
  filters: { ageGroupName?: string; genderName?: string; themeName?: string; styleName?: string },
): Product[] {
  let result = prods;
  if (filters.ageGroupName) result = result.filter(p => (p.ageGroups ?? []).some(a => a.toLowerCase() === filters.ageGroupName));
  if (filters.genderName)   result = result.filter(p => (p.genders   ?? []).some(g => g.toLowerCase() === filters.genderName));
  if (filters.themeName)    result = result.filter(p => (p.themes    ?? []).some(t => t.toLowerCase() === filters.themeName));
  if (filters.styleName)    result = result.filter(p => (p.styles    ?? []).some(s => s.toLowerCase() === filters.styleName));
  return result;
}

export function registerProductRoutes(app: Express) {
  app.get("/api/categories", async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.get("/api/categories/:slug", async (req, res) => {
    const cat = await storage.getCategoryBySlug(req.params.slug as string);
    if (!cat) return res.status(404).json({ message: "Category not found" });
    res.json(cat);
  });

  app.get("/api/products", async (req, res) => {
    const filters = await resolveAttributeFilters(req);
    let prods = await storage.getProducts();
    prods = applyAttributeFilters(prods, filters);
    res.json(prods);
  });

  app.get("/api/occasions", async (_req, res) => {
    const occs = await storage.getOccasions(true);
    res.json(occs);
  });

  app.get("/api/attributes", async (_req, res) => {
    const attrs = await storage.getAttributes();
    res.json(attrs);
  });

  app.post("/api/products/batch", async (req, res) => {
    const raw = req.body?.ids;
    if (!Array.isArray(raw)) return res.status(400).json({ message: "ids must be an array" });
    const ids: string[] = [...new Set(raw.filter((x: unknown) => typeof x === "string"))].slice(0, 20) as string[];
    const results = await Promise.all(
      ids.map(async id => {
        const p = await storage.getProductById(id).catch(() => null);
        if (!p) return null;
        const imgs = await storage.getProductImages(id).catch(() => []);
        const galleryImages = imgs.slice(0, 5).map(i => i.imageUrl);
        return { id: p.id, name: p.name, slug: p.slug, imageUrl: p.imageUrl ?? null, galleryImages };
      })
    );
    res.json(results.filter(Boolean));
  });

  app.get("/api/products/search", async (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q) return res.json([]);
    const prods = await storage.searchProducts(q);
    res.json(prods);
  });

  app.get("/api/products/category/:categoryId", async (req, res) => {
    const categoryId = req.params.categoryId as string;
    if (!categoryId) return res.status(400).json({ message: "Invalid category ID" });
    const filters = await resolveAttributeFilters(req);
    let prods = await storage.getProductsByCategory(categoryId);
    prods = applyAttributeFilters(prods, filters);
    res.json(prods);
  });

  app.get("/api/products/:slug", async (req, res) => {
    const prod = await storage.getProductBySlug(req.params.slug as string);
    if (!prod) return res.status(404).json({ message: "Product not found" });
    res.json(prod);
  });

  app.get("/api/products/:id/images", async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const images = await storage.getProductImages(id);
    res.json(images);
  });

  app.get("/api/products/:id/reviews", async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const reviews = await storage.getProductReviews(id);
    res.json(reviews);
  });

  app.get("/api/products/:id/my-review", async (req, res) => {
    const productId = req.params.id as string;
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) return res.status(401).json({ message: "Not authenticated" });
    const review = await storage.getCustomerReviewForProduct(customer.id, productId);
    if (!review) return res.status(404).json({ message: "No review found" });
    res.json(review);
  });

  app.post("/api/products/:id/reviews", async (req, res) => {
    const productId = req.params.id as string;
    const customer = await getAuthenticatedCustomer(req);
    if (!customer) return res.status(401).json({ message: "Not authenticated" });

    const parsed = submitReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const { rating, title, body } = parsed.data;

    const existing = await storage.getCustomerReviewForProduct(customer.id, productId);
    const verifiedPurchase = await storage.customerHasOrderedProduct(customer.id, productId);

    if (existing) {
      const updated = await storage.updateProductReview(existing.id, {
        rating,
        title: title || null,
        body,
        verifiedPurchase,
      });
      return res.json(updated);
    }

    const review = await storage.createProductReview({
      productId,
      customerId: customer.id,
      reviewerName: customer.name || customer.email.split("@")[0],
      rating,
      title: title || null,
      body,
      verifiedPurchase,
    });
    return res.status(201).json(review);
  });

  app.get("/api/products/:id/variants", async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const variants = await storage.getProductVariants(id);
    res.json(variants);
  });

  app.get("/api/products/:id/variant-options", async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const opts = await storage.getProductVariantOptions(id);
    res.json(opts);
  });
}
