import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { insertCategorySchema, insertProductSchema, insertTagSchema, insertTagTypeSchema, insertOccasionSchema } from "@shared/schema";
import { z } from "zod";
import { requirePermission, getAdminUsername } from "../../adminAuth";
import { generateSku } from "../../utils/sku";
import { fileStorage } from "../../providers/fileStorage";

const sseClients = new Set<Response>();

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
    const [prods, { productTagMap, productTagNameMap }, productImages] = await Promise.all([
      storage.getAllProductsByCategoryNoTags(categoryId),
      storage.getProductTagsForCatalog(categoryId),
      storage.getProductImagesByCategory(categoryId),
    ]);
    const products = prods.map(p => ({ ...p, tagNames: productTagNameMap[p.id] ?? [] }));
    res.json({ products, productTagMap, productImages });
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
    const allTags = await storage.getTags();
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

      for (let i = 0; i < productIds.length; i++) {
        const perProductSlots: { sortOrder: number; imageUrl: string }[] = [];
        for (const slot of imageSlots) {
          if (i === 0) {
            perProductSlots.push({ sortOrder: slot.sortOrder, imageUrl: slot.sourceUrl });
          } else {
            const copied = await fileStorage.copy(slot.sourceUrl);
            perProductSlots.push({ sortOrder: slot.sortOrder, imageUrl: copied.url });
          }
        }
        await storage.bulkReplaceProductImages([productIds[i]], perProductSlots);
      }

      res.json({ updated: productIds.length });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Bulk upload images error:", err);
      res.status(500).json({ message: "Failed to bulk upload images" });
    }
  });

  app.post("/api/admin/products/bulk-add-tags", requirePermission("catalog"), async (req, res) => {
    try {
      const { productIds, tagIds } = z.object({
        productIds: z.array(z.string()).min(1),
        tagIds: z.array(z.string()).min(1),
      }).parse(req.body);
      let updated = 0;
      for (const productId of productIds) {
        const existing = await storage.getProductTags(productId);
        const existingIds = existing.map(t => t.id);
        const merged = Array.from(new Set([...existingIds, ...tagIds]));
        await storage.setProductTags(productId, merged);
        updated++;
      }
      res.json({ updated });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Bulk add tags error:", err);
      res.status(500).json({ message: "Failed to bulk add tags" });
    }
  });

  app.post("/api/admin/products/bulk-remove-tags", requirePermission("catalog"), async (req, res) => {
    try {
      const { productIds, tagIds } = z.object({
        productIds: z.array(z.string()).min(1),
        tagIds: z.array(z.string()).min(1),
      }).parse(req.body);
      const removeSet = new Set(tagIds);
      let updated = 0;
      for (const productId of productIds) {
        const existing = await storage.getProductTags(productId);
        const remaining = existing.map(t => t.id).filter(id => !removeSet.has(id));
        await storage.setProductTags(productId, remaining);
        updated++;
      }
      res.json({ updated });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Bulk remove tags error:", err);
      res.status(500).json({ message: "Failed to bulk remove tags" });
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
        isDefault: z.boolean().default(false),
        blurOnFront: z.boolean().default(false),
        sortOrder: z.number().int().default(0),
        colors: z.array(colorSchema).default([]),
      });
      const bodySchema = z.object({
        tagId: z.string().min(1, "Tag is required"),
        sizes: z.array(sizeSchema).default([]),
      });
      const { tagId, sizes } = bodySchema.parse(req.body);
      const configId = await storage.upsertVariantConfig(categoryId, tagId, sizes);
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

  // ── Occasions CRUD ──
  app.get("/api/admin/occasions", requirePermission("catalog"), async (_req, res) => {
    const occ = await storage.getOccasions();
    res.json(occ);
  });

  app.post("/api/admin/occasions", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertOccasionSchema.parse(req.body);
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
      const data = insertOccasionSchema.partial().parse(req.body);
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
}
