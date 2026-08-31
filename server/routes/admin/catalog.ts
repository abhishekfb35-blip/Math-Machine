import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { insertCategorySchema, insertProductSchema, insertTagSchema, insertTagTypeSchema } from "@shared/schema";
import { z } from "zod";
import { requirePermission, getAdminUsername } from "../../adminAuth";
import { generateSku } from "../../utils/sku";
import {
  getCatalogByCategory,
  bulkUpdateAttributes,
  bulkRemoveAttributes,
  bulkReplaceAttributes,
  bulkClearAttributes,
  bulkRestoreAttributes,
  bulkUploadImages,
} from "../../services/catalogService";

const sseClients = new Set<Response>();

const occasionInputSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  boostTags: z.record(z.number()).nullable().optional(),
  penaltyTags: z.record(z.number()).nullable().optional(),
  preferredStyles: z.string().nullable().optional(),
  preferredThemes: z.string().nullable().optional(),
  active: z.boolean().nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
});

function broadcastProductUpdate(product: object) {
  const data = `event: product-updated\ndata: ${JSON.stringify(product)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
      (client as any).flush?.();
    } catch { sseClients.delete(client); }
  }
}

export function registerAdminCatalogRoutes(app: Express) {

  app.get("/api/admin/product-updates/stream", requirePermission("catalog"), (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    sseClients.add(res);
    const heartbeat = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
        (res as any).flush?.();
      } catch { clearInterval(heartbeat); sseClients.delete(res); }
    }, 25000);
    req.on("close", () => { clearInterval(heartbeat); sseClients.delete(res); });
  });

  app.get("/api/admin/categories", requirePermission("catalog"), async (_req, res) => {
    const cats = await storage.getCategories();
    res.json(cats);
  });

  app.post("/api/admin/categories", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const cat = await storage.createCategory(data);
      await storage.createAuditLog({
        entityType: "category", entityId: cat.id, entityName: cat.name,
        action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.status(201).json(cat);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A category with that slug already exists" });
      console.error("Create category error:", err);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/admin/categories/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const before = await storage.getCategoryById(id);
      const data = insertCategorySchema.partial().parse(req.body);
      const updated = await storage.updateCategory(id, data);
      if (!updated) return res.status(404).json({ message: "Category not found" });
      await storage.createAuditLog({
        entityType: "category", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify({ before, after: data }), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A category with that slug already exists" });
      console.error("Update category error:", err);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/admin/categories/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const before = await storage.getCategoryById(id);
    await storage.deleteCategory(id);
    await storage.createAuditLog({
      entityType: "category", entityId: id, entityName: before?.name || "Unknown",
      action: "deleted", changes: JSON.stringify(before), username: getAdminUsername(req),
    });
    res.status(204).send();
  });

  app.get("/api/admin/products", requirePermission("catalog"), async (_req, res) => {
    const prods = await storage.getAllProducts();
    res.json(prods);
  });

  app.get("/api/admin/products/search", requirePermission("catalog"), async (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q) return res.json([]);
    const prods = await storage.searchAllProducts(q);
    res.json(prods);
  });

  app.get("/api/admin/products/category/:categoryId", requirePermission("catalog"), async (req, res) => {
    const categoryId = req.params.categoryId as string;
    if (!categoryId) return res.status(400).json({ message: "Invalid category ID" });
    const prods = await storage.getAllProductsByCategory(categoryId);
    res.json(prods);
  });

  // Combined catalog endpoint — products + tags + images in one request
  app.get("/api/admin/catalog/category/:categoryId", requirePermission("catalog"), async (req, res) => {
    const categoryId = req.params.categoryId as string;
    if (!categoryId) return res.status(400).json({ message: "Invalid category ID" });
    res.json(await getCatalogByCategory(categoryId));
  });

  app.post("/api/admin/products", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      data.sku = generateSku();
      const prod = await storage.createProduct(data);
      await storage.createAuditLog({
        entityType: "product", entityId: prod.id, entityName: prod.name,
        action: "created", changes: JSON.stringify({ name: data.name, slug: data.slug, price: data.price, categoryId: data.categoryId }),
        username: getAdminUsername(req),
      });
      res.status(201).json(prod);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A product with that slug already exists" });
      console.error("Create product error:", err);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.post("/api/admin/products/from-draft", requirePermission("catalog"), async (req, res) => {
    try {
      const draftSchema = z.object({
        // Drafts omit identity fields; the storage layer assigns a fresh SKU
        // when the copied product is saved.
        product: insertProductSchema.omit({ sku: true }),
        tagIds: z.array(z.string()),
        audienceIds: z.array(z.string()),
        genderIds: z.array(z.string()),
        themeIds: z.array(z.string()),
        styleIds: z.array(z.string()),
        images: z.array(z.object({
          imageUrl: z.string().min(1),
          sortOrder: z.number().int().min(0),
          isPrimary: z.boolean(),
        })),
        variants: z.array(z.object({
          color: z.string(),
          size: z.string(),
          available: z.boolean(),
        })),
      });
      const draft = draftSchema.parse(req.body);
      const product = await storage.createProductFromDraft(draft.product, draft);
      await storage.createAuditLog({
        entityType: "product",
        entityId: product.id,
        entityName: product.name,
        action: "created",
        changes: JSON.stringify({ name: product.name, slug: product.slug, price: product.price, categoryId: product.categoryId, source: "copy-draft" }),
        username: getAdminUsername(req),
      });
      broadcastProductUpdate(product);
      res.status(201).json(product);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A product with that slug or SKU already exists" });
      console.error("Create product from draft error:", err);
      res.status(500).json({ message: "Failed to create product draft" });
    }
  });

  app.post("/api/admin/products/:id/copy", requirePermission("catalog"), async (req, res) => {
    const sourceProductId = req.params.id as string;
    if (!sourceProductId) return res.status(400).json({ message: "Invalid product ID" });
    try {
      const copied = await storage.copyProduct(sourceProductId);
      if (!copied) return res.status(404).json({ message: "Product not found" });
      await storage.createAuditLog({
        entityType: "product",
        entityId: copied.id,
        entityName: copied.name,
        action: "copied",
        changes: JSON.stringify({ sourceProductId, name: copied.name, slug: copied.slug, sku: copied.sku }),
        username: getAdminUsername(req),
      });
      broadcastProductUpdate(copied);
      res.status(201).json(copied);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ message: "A copied product conflicts with an existing slug or SKU" });
      console.error("Copy product error:", err);
      res.status(500).json({ message: "Failed to copy product" });
    }
  });

  app.get("/api/admin/products/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const product = await storage.getProductById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.put("/api/admin/products/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const before = await storage.getProductById(id);
      const data = insertProductSchema.partial().parse(req.body);
      const updated = await storage.updateProduct(id, data);
      if (!updated) return res.status(404).json({ message: "Product not found" });
      const changedFields: Record<string, { from: any; to: any }> = {};
      if (before) {
        for (const key of Object.keys(data) as (keyof typeof data)[]) {
          if (data[key] !== undefined && (before as any)[key] !== data[key]) {
            changedFields[key] = { from: (before as any)[key], to: data[key] };
          }
        }
      }
      await storage.createAuditLog({
        entityType: "product", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify(changedFields), username: getAdminUsername(req),
      });
      broadcastProductUpdate(updated);
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A product with that slug already exists" });
      console.error("Update product error:", err);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.post("/api/admin/products/bulk-update-fields", requirePermission("catalog"), async (req, res) => {
    try {
      const updateSchema = z.object({
        updates: z.array(
          insertProductSchema.partial().extend({ id: z.string() })
        ).min(1),
      });
      const { updates } = updateSchema.parse(req.body);
      const count = await storage.bulkUpdateProductFields(updates);
      await storage.createAuditLog({
        entityType: "product", entityId: "bulk", entityName: `${count} products`,
        action: "bulk-updated-fields",
        changes: JSON.stringify({ productIds: updates.map(u => u.id), fields: Object.keys(updates[0] ?? {}).filter(k => k !== "id") }),
        username: getAdminUsername(req),
      });
      res.json({ updated: count });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Bulk update fields error:", err);
      res.status(500).json({ message: "Failed to bulk update products" });
    }
  });

  app.delete("/api/admin/products/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const before = await storage.getProductById(id);
    await storage.deleteProduct(id);
    await storage.createAuditLog({
      entityType: "product", entityId: id, entityName: before?.name || "Unknown",
      action: "deleted", changes: JSON.stringify({ name: before?.name, sku: before?.sku, categoryId: before?.categoryId }),
      username: getAdminUsername(req),
    });
    res.status(204).send();
  });

  app.post("/api/admin/products/:id/images", requirePermission("catalog"), async (req, res) => {
    const productId = req.params.id as string;
    if (!productId) return res.status(400).json({ message: "Invalid product ID" });
    try {
      const img = await storage.createProductImage({ ...req.body, productId });
      res.status(201).json(img);
    } catch (err) {
      console.error("Create product image error:", err);
      res.status(500).json({ message: "Failed to add image" });
    }
  });

  app.delete("/api/admin/products/:productId/images/:imageId", requirePermission("catalog"), async (req, res) => {
    const imageId = req.params.imageId as string;
    if (!imageId) return res.status(400).json({ message: "Invalid image ID" });
    await storage.deleteProductImage(imageId);
    res.status(204).send();
  });

  app.put("/api/admin/products/:id/images/reorder", requirePermission("catalog"), async (req, res) => {
    const productId = req.params.id as string;
    const { imageIds } = req.body;
    if (!productId || !Array.isArray(imageIds)) return res.status(400).json({ message: "Invalid request" });
    try {
      await storage.reorderProductImages(productId, imageIds);
      res.json({ success: true });
    } catch (err) {
      console.error("Reorder images error:", err);
      res.status(500).json({ message: "Failed to reorder images" });
    }
  });

  app.post("/api/admin/products/:id/reviews", requirePermission("catalog"), async (req, res) => {
    const productId = req.params.id as string;
    if (!productId) return res.status(400).json({ message: "Invalid product ID" });
    try {
      const review = await storage.createProductReview({ ...req.body, productId });
      res.status(201).json(review);
    } catch (err) {
      console.error("Create product review error:", err);
      res.status(500).json({ message: "Failed to add review" });
    }
  });

  app.put("/api/admin/products/:productId/reviews/:reviewId", requirePermission("catalog"), async (req, res) => {
    const reviewId = req.params.reviewId as string;
    if (!reviewId) return res.status(400).json({ message: "Invalid review ID" });
    try {
      const review = await storage.updateProductReview(reviewId, req.body);
      res.json(review);
    } catch (err) {
      console.error("Update review error:", err);
      res.status(500).json({ message: "Failed to update review" });
    }
  });

  app.delete("/api/admin/products/:productId/reviews/:reviewId", requirePermission("catalog"), async (req, res) => {
    const reviewId = req.params.reviewId as string;
    if (!reviewId) return res.status(400).json({ message: "Invalid review ID" });
    await storage.deleteProductReview(reviewId);
    res.status(204).send();
  });

  app.get("/api/admin/tag-types", requirePermission("catalog"), async (_req, res) => {
    const types = await storage.getTagTypes();
    res.json(types);
  });

  app.post("/api/admin/tag-types", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertTagTypeSchema.parse(req.body);
      const tagType = await storage.createTagType(data);
      await storage.createAuditLog({
        entityType: "tag_type", entityId: tagType.id, entityName: tagType.name,
        action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.status(201).json(tagType);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A tag type with that name already exists" });
      console.error("Create tag type error:", err);
      res.status(500).json({ message: "Failed to create tag type" });
    }
  });

  app.put("/api/admin/tag-types/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const data = insertTagTypeSchema.partial().parse(req.body);
      const updated = await storage.updateTagType(id, data);
      if (!updated) return res.status(404).json({ message: "Tag type not found" });
      await storage.createAuditLog({
        entityType: "tag_type", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A tag type with that name already exists" });
      console.error("Update tag type error:", err);
      res.status(500).json({ message: "Failed to update tag type" });
    }
  });

  app.delete("/api/admin/tag-types/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const types = await storage.getTagTypes();
    const before = types.find(t => t.id === id);
    await storage.deleteTagType(id);
    await storage.createAuditLog({
      entityType: "tag_type", entityId: id, entityName: before?.name || "Unknown",
      action: "deleted", changes: JSON.stringify(before), username: getAdminUsername(req),
    });
    res.status(204).send();
  });

  app.get("/api/admin/tags", requirePermission("catalog"), async (_req, res) => {
    const allTags = await storage.getTagsWithProductCount();
    res.json(allTags);
  });

  app.post("/api/admin/tags", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(data);
      await storage.createAuditLog({
        entityType: "tag", entityId: tag.id, entityName: tag.name,
        action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.status(201).json(tag);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A tag with that name already exists" });
      console.error("Create tag error:", err);
      res.status(500).json({ message: "Failed to create tag" });
    }
  });

  app.put("/api/admin/tags/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const before = await storage.getTags().then(t => t.find(x => x.id === id));
      const data = insertTagSchema.partial().parse(req.body);
      const updated = await storage.updateTag(id, data);
      if (!updated) return res.status(404).json({ message: "Tag not found" });
      await storage.createAuditLog({
        entityType: "tag", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify({ before, after: data }), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A tag with that name already exists" });
      console.error("Update tag error:", err);
      res.status(500).json({ message: "Failed to update tag" });
    }
  });

  app.delete("/api/admin/tags/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    const before = await storage.getTags().then(t => t.find(x => x.id === id));
    await storage.deleteTag(id);
    await storage.createAuditLog({
      entityType: "tag", entityId: id, entityName: before?.name || "Unknown",
      action: "deleted", changes: JSON.stringify(before), username: getAdminUsername(req),
    });
    res.status(204).send();
  });

  app.get("/api/admin/categories/:id/product-tags", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid category ID" });
    const map = await storage.getProductTagIdsByCategory(id);
    res.json(map);
  });

  app.post("/api/admin/products/bulk-upload-images", requirePermission("catalog"), async (req, res) => {
    try {
      const { productIds, imageSlots } = z.object({
        productIds: z.array(z.string()).min(1),
        imageSlots: z.array(z.object({
          sortOrder: z.number().int().min(0),
          sourceUrl: z.string().min(1),
        })).min(1),
      }).parse(req.body);
      const updated = await bulkUploadImages(productIds, imageSlots);
      res.json({ updated });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Bulk upload images error:", err);
      res.status(500).json({ message: "Failed to bulk upload images" });
    }
  });

  app.get("/api/admin/products/:id/tags", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const productTagsList = await storage.getProductTags(id);
    res.json(productTagsList);
  });

  app.put("/api/admin/products/:id/tags", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    try {
      const { tagIds } = z.object({ tagIds: z.array(z.string()) }).parse(req.body);
      await storage.setProductTags(id, tagIds);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Set product tags error:", err);
      res.status(500).json({ message: "Failed to set product tags" });
    }
  });

  app.get("/api/admin/products/:id/variants", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const variants = await storage.getProductVariants(id);
    res.json(variants);
  });

  app.put("/api/admin/products/:id/variants", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    try {
      const schema = z.object({
        variants: z.array(z.object({
          color: z.string(),
          size: z.string(),
          available: z.boolean(),
        })),
      });
      const { variants } = schema.parse(req.body);
      await storage.upsertProductVariants(id, variants);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Upsert product variants error:", err);
      res.status(500).json({ message: "Failed to save product variants" });
    }
  });

  app.get("/api/admin/products/:id/variant-options", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const opts = await storage.getProductVariantOptions(id);
    res.json(opts);
  });

  app.put("/api/admin/products/:id/variant-options", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    try {
      const schema = z.object({
        colors: z.array(z.object({
          name: z.string(),
          hexCode: z.string(),
          blurOnFront: z.boolean().default(false),
          hideFromFront: z.boolean().default(false),
        })),
        sizes: z.array(z.object({
          name: z.string(),
          value: z.string(),
          description: z.string().optional(),
          isDefault: z.boolean().default(false),
          blurOnFront: z.boolean().default(false),
          hideFromFront: z.boolean().default(false),
        })),
      });
      const { colors, sizes } = schema.parse(req.body);
      await storage.upsertProductVariantOptions(id, colors, sizes);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Upsert product variant options error:", err);
      res.status(500).json({ message: "Failed to save product variant options" });
    }
  });

  app.get("/api/admin/categories/:id/variant-configs", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid category ID" });
    const configs = await storage.listCategoryTagVariantConfigs(id);
    res.json(configs);
  });

  app.put("/api/admin/categories/:id/variant-configs", requirePermission("catalog"), async (req, res) => {
    const categoryId = req.params.id as string;
    if (!categoryId) return res.status(400).json({ message: "Invalid category ID" });
    try {
      const colorSchema = z.object({
        name: z.string().min(1),
        swatchUrl: z.string().optional(),
        blurOnFront: z.boolean().default(false),
        sortOrder: z.number().int().default(0),
      });
      const sizeSchema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        descriptionFontSize: z.number().int().min(8).max(72).optional().default(12),
        priceAdd: z.number().int().default(0),
        mrpAdd: z.number().int().default(0),
        isDefault: z.boolean().default(false),
        blurOnFront: z.boolean().default(false),
        sortOrder: z.number().int().default(0),
        colors: z.array(colorSchema).default([]),
      });
      const bodySchema = z.object({
        sizes: z.array(sizeSchema).default([]),
        audienceId: z.string().nullable().optional(),
      });
      const { sizes, audienceId = null } = bodySchema.parse(req.body);
      const configId = await storage.upsertVariantConfig(categoryId, null, audienceId ?? null, sizes);
      const config = await storage.getVariantConfig(configId);
      res.json(config);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Upsert variant config error:", err);
      res.status(500).json({ message: "Failed to save variant config" });
    }
  });

  app.delete("/api/admin/variant-configs/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid config ID" });
    try {
      await storage.deleteVariantConfig(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete variant config error:", err);
      res.status(500).json({ message: "Failed to delete variant config" });
    }
  });

  const attrBodySchema = z.object({
    productIds:   z.array(z.string()).min(1),
    audienceIds:  z.array(z.string()).optional(),
    genderIds:    z.array(z.string()).optional(),
    themeIds:     z.array(z.string()).optional(),
    styleIds:     z.array(z.string()).optional(),
    tagIds:       z.array(z.string()).optional(),
  });

  // ── Bulk Update Attributes ──
  app.post("/api/admin/products/bulk-update-attributes", requirePermission("catalog"), async (req, res) => {
    try {
      const { productIds, ...attrs } = attrBodySchema.parse(req.body);
      const updated = await bulkUpdateAttributes(productIds, attrs, getAdminUsername(req));
      res.json({ updated });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Bulk update attributes error:", err);
      res.status(500).json({ message: "Failed to bulk update attributes" });
    }
  });

  // ── Bulk Remove Attributes ──
  app.post("/api/admin/products/bulk-remove-attributes", requirePermission("catalog"), async (req, res) => {
    try {
      const { productIds, ...attrs } = attrBodySchema.parse(req.body);
      const updated = await bulkRemoveAttributes(productIds, attrs, getAdminUsername(req));
      res.json({ updated });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Bulk remove attributes error:", err);
      res.status(500).json({ message: "Failed to bulk remove attributes" });
    }
  });

  // ── Bulk Replace Attributes ──
  app.post("/api/admin/products/bulk-replace-attributes", requirePermission("catalog"), async (req, res) => {
    try {
      const { productIds, ...attrs } = attrBodySchema.parse(req.body);
      const updated = await bulkReplaceAttributes(productIds, attrs, getAdminUsername(req));
      res.json({ updated });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Bulk replace attributes error:", err);
      res.status(500).json({ message: "Failed to bulk replace attributes" });
    }
  });

  // ── Bulk Clear Attributes ──
  app.post("/api/admin/products/bulk-clear-attributes", requirePermission("catalog"), async (req, res) => {
    try {
      const { productIds } = z.object({ productIds: z.array(z.string()).min(1) }).parse(req.body);
      const result = await bulkClearAttributes(productIds, getAdminUsername(req));
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Bulk clear attributes error:", err);
      res.status(500).json({ message: "Failed to bulk clear attributes" });
    }
  });

  // ── Bulk Restore Attributes (undo clear) ──
  app.post("/api/admin/products/bulk-restore-attributes", requirePermission("catalog"), async (req, res) => {
    try {
      const { undoToken } = z.object({ undoToken: z.string() }).parse(req.body);
      const result = await bulkRestoreAttributes(undoToken, getAdminUsername(req));
      if ("expired" in result) return res.status(410).json({ message: "Undo window has expired. Please re-apply attributes manually." });
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Bulk restore attributes error:", err);
      res.status(500).json({ message: "Failed to restore attributes" });
    }
  });

  // ── Occasions CRUD ──
  app.get("/api/admin/occasions", requirePermission("catalog"), async (_req, res) => {
    const occ = await storage.getOccasions();
    res.json(occ);
  });

  app.post("/api/admin/occasions", requirePermission("catalog"), async (req, res) => {
    try {
      const data = occasionInputSchema.parse(req.body);
      const occ = await storage.createOccasion(data);
      await storage.createAuditLog({
        entityType: "occasion", entityId: occ.id, entityName: occ.name,
        action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.status(201).json(occ);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "An occasion with that slug already exists" });
      console.error("Create occasion error:", err);
      res.status(500).json({ message: "Failed to create occasion" });
    }
  });

  app.patch("/api/admin/occasions/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      const data = occasionInputSchema.partial().parse(req.body);
      const updated = await storage.updateOccasion(id, data);
      if (!updated) return res.status(404).json({ message: "Occasion not found" });
      await storage.createAuditLog({
        entityType: "occasion", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "An occasion with that slug already exists" });
      console.error("Update occasion error:", err);
      res.status(500).json({ message: "Failed to update occasion" });
    }
  });

  app.delete("/api/admin/occasions/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid ID" });
    try {
      await storage.deleteOccasion(id);
      await storage.createAuditLog({
        entityType: "occasion", entityId: id, entityName: null,
        action: "deleted", changes: null, username: getAdminUsername(req),
      });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete occasion error:", err);
      res.status(500).json({ message: "Failed to delete occasion" });
    }
  });

  // ── Global Colour Swatches ──
  app.get("/api/admin/color-swatches", requirePermission("catalog"), async (_req, res) => {
    res.json(await storage.listColorSwatches());
  });

  app.post("/api/admin/color-swatches", requirePermission("catalog"), async (req, res) => {
    try {
      const bodySchema = z.object({
        name: z.string().min(1),
        swatchUrl: z.string().optional().nullable(),
        sortOrder: z.number().int().default(0),
      });
      const data = bodySchema.parse(req.body);
      const swatch = await storage.createColorSwatch(data);
      res.status(201).json(swatch);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      res.status(500).json({ message: "Failed to create colour swatch" });
    }
  });

  app.patch("/api/admin/color-swatches/:id", requirePermission("catalog"), async (req, res) => {
    const { id } = req.params;
    try {
      const bodySchema = z.object({
        name: z.string().min(1).optional(),
        swatchUrl: z.string().optional().nullable(),
        sortOrder: z.number().int().optional(),
      });
      const data = bodySchema.parse(req.body);
      const swatch = await storage.updateColorSwatch(id as string, data);
      if (!swatch) return res.status(404).json({ message: "Swatch not found" });
      res.json(swatch);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      res.status(500).json({ message: "Failed to update colour swatch" });
    }
  });

  app.delete("/api/admin/color-swatches/:id", requirePermission("catalog"), async (req, res) => {
    await storage.deleteColorSwatch(req.params.id as string);
    res.json({ success: true });
  });

  // ── Category Size Definitions ──
  app.get("/api/admin/categories/:id/size-definitions", requirePermission("catalog"), async (req, res) => {
    res.json(await storage.listCategorySizeDefinitions(req.params.id as string));
  });

  app.post("/api/admin/categories/:id/size-definitions", requirePermission("catalog"), async (req, res) => {
    try {
      const bodySchema = z.object({
        name: z.string().min(1),
        description: z.string().optional().nullable(),
        sortOrder: z.number().int().default(0),
      });
      const data = bodySchema.parse(req.body);
      const def = await storage.createCategorySizeDefinition({ categoryId: req.params.id as string, ...data });
      res.status(201).json(def);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      res.status(500).json({ message: "Failed to create size definition" });
    }
  });

  app.patch("/api/admin/categories/:categoryId/size-definitions/:id", requirePermission("catalog"), async (req, res) => {
    try {
      const bodySchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        sortOrder: z.number().int().optional(),
      });
      const data = bodySchema.parse(req.body);
      const def = await storage.updateCategorySizeDefinition(req.params.id as string, data);
      if (!def) return res.status(404).json({ message: "Size definition not found" });
      res.json(def);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      res.status(500).json({ message: "Failed to update size definition" });
    }
  });

  app.delete("/api/admin/categories/:categoryId/size-definitions/:id", requirePermission("catalog"), async (req, res) => {
    await storage.deleteCategorySizeDefinition(req.params.id as string);
    res.json({ success: true });
  });

  // ── Bulk Price Rules ─────────────────────────────────────────────────────────
  app.get("/api/admin/bulk-price-rules", requirePermission("catalog"), async (_req, res) => {
    try {
      res.json(await storage.getBulkPriceRules());
    } catch {
      res.status(500).json({ message: "Failed to fetch bulk price rules" });
    }
  });

  app.put("/api/admin/bulk-price-rules", requirePermission("catalog"), async (req, res) => {
    try {
      const schema = z.object({ sellingPrice: z.number().int().positive(), bulkRate: z.number().int().positive() });
      const data = schema.parse(req.body);
      const rule = await storage.upsertBulkPriceRule(data);
      await storage.createAuditLog({
        entityType: "bulk_price_rule",
        entityId: String(data.sellingPrice),
        action: "upsert",
        changes: JSON.stringify(data),
        username: getAdminUsername(req),
      });
      res.json(rule);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("upsert bulk-price-rule error:", err);
      res.status(500).json({ message: "Failed to save bulk price rule" });
    }
  });

  app.delete("/api/admin/bulk-price-rules/:id", requirePermission("catalog"), async (req, res) => {
    try {
      await storage.deleteBulkPriceRule(req.params.id as string);
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete bulk price rule" });
    }
  });
}
