import { z } from "zod";
import type { Express } from "express";
import { storage } from "../storage";
import { getAuthenticatedCustomer } from "./helpers";

const submitReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().min(10, "Review must be at least 10 characters"),
});

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

  app.get("/api/products", async (_req, res) => {
    const prods = await storage.getProducts();
    res.json(prods);
  });

  app.get("/api/occasions", async (_req, res) => {
    const occs = await storage.getOccasions(true);
    res.json(occs);
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
    const prods = await storage.getProductsByCategory(categoryId);
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
