import type { Express } from "express";
import { storage } from "../../storage";
import { insertAgeGroupSchema, insertGenderSchema, insertThemeSchema, insertStyleSchema } from "@shared/schema";
import { z } from "zod";
import { requirePermission, getAdminUsername } from "../../adminAuth";

export function registerAdminAttributeRoutes(app: Express) {

  // ── GET all attributes (bundled) ────────────────────────────────────────────
  app.get("/api/admin/attributes", requirePermission("catalog"), async (_req, res) => {
    const attrs = await storage.getAttributes();
    res.json(attrs);
  });

  // ── Product attribute IDs (for loading current selections) ──────────────────
  app.get("/api/admin/products/:id/attributes", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const ids = await storage.getProductAttributeIds(id);
    res.json(ids);
  });

  app.put("/api/admin/products/:id/attributes", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    const { ageGroupIds = [], genderIds = [], themeIds = [], styleIds = [] } = req.body;
    await Promise.all([
      storage.setProductAgeGroups(id, ageGroupIds),
      storage.setProductGenders(id, genderIds),
      storage.setProductThemes(id, themeIds),
      storage.setProductStyles(id, styleIds),
    ]);
    await storage.createAuditLog({
      entityType: "product", entityId: id, entityName: id,
      action: "updated", changes: JSON.stringify({ attributes: { ageGroupIds, genderIds, themeIds, styleIds } }),
      username: getAdminUsername(req),
    });
    res.json({ success: true });
  });

  // ── Per-type GET handlers ────────────────────────────────────────────────────
  app.get("/api/admin/attributes/age-groups", requirePermission("catalog"), async (_req, res) => {
    res.json(await storage.getAgeGroups());
  });
  app.get("/api/admin/attributes/genders", requirePermission("catalog"), async (_req, res) => {
    res.json(await storage.getGenders());
  });
  app.get("/api/admin/attributes/themes", requirePermission("catalog"), async (_req, res) => {
    res.json(await storage.getThemes());
  });
  app.get("/api/admin/attributes/styles", requirePermission("catalog"), async (_req, res) => {
    res.json(await storage.getStyles());
  });

  // ── Short aliases (/api/admin/{type}) with real handlers (not redirects) ────
  app.get("/api/admin/age-groups", requirePermission("catalog"), async (_req, res) => {
    res.json(await storage.getAgeGroups());
  });
  app.get("/api/admin/genders", requirePermission("catalog"), async (_req, res) => {
    res.json(await storage.getGenders());
  });
  app.get("/api/admin/themes", requirePermission("catalog"), async (_req, res) => {
    res.json(await storage.getThemes());
  });
  app.get("/api/admin/styles", requirePermission("catalog"), async (_req, res) => {
    res.json(await storage.getStyles());
  });

  // ── Age Groups CRUD ──────────────────────────────────────────────────────────
  app.post("/api/admin/attributes/age-groups", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertAgeGroupSchema.parse(req.body);
      const created = await storage.createAgeGroup(data);
      await storage.createAuditLog({
        entityType: "attribute", entityId: created.id, entityName: created.name,
        action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "An age group with that name already exists" });
      res.status(500).json({ message: "Failed to create age group" });
    }
  });

  app.put("/api/admin/attributes/age-groups/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    try {
      const data = insertAgeGroupSchema.partial().parse(req.body);
      const updated = await storage.updateAgeGroup(id, data);
      if (!updated) return res.status(404).json({ message: "Age group not found" });
      await storage.createAuditLog({
        entityType: "attribute", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "An age group with that name already exists" });
      res.status(500).json({ message: "Failed to update age group" });
    }
  });

  app.delete("/api/admin/attributes/age-groups/:id", requirePermission("catalog"), async (req, res) => {
    await storage.deleteAgeGroup(req.params.id as string);
    res.status(204).send();
  });

  // ── Genders CRUD ─────────────────────────────────────────────────────────────
  app.post("/api/admin/attributes/genders", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertGenderSchema.parse(req.body);
      const created = await storage.createGender(data);
      await storage.createAuditLog({
        entityType: "attribute", entityId: created.id, entityName: created.name,
        action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A gender with that name already exists" });
      res.status(500).json({ message: "Failed to create gender" });
    }
  });

  app.put("/api/admin/attributes/genders/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    try {
      const data = insertGenderSchema.partial().parse(req.body);
      const updated = await storage.updateGender(id, data);
      if (!updated) return res.status(404).json({ message: "Gender not found" });
      await storage.createAuditLog({
        entityType: "attribute", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A gender with that name already exists" });
      res.status(500).json({ message: "Failed to update gender" });
    }
  });

  app.delete("/api/admin/attributes/genders/:id", requirePermission("catalog"), async (req, res) => {
    await storage.deleteGender(req.params.id as string);
    res.status(204).send();
  });

  // ── Themes CRUD ──────────────────────────────────────────────────────────────
  app.post("/api/admin/attributes/themes", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertThemeSchema.parse(req.body);
      const created = await storage.createTheme(data);
      await storage.createAuditLog({
        entityType: "attribute", entityId: created.id, entityName: created.name,
        action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A theme with that name already exists" });
      res.status(500).json({ message: "Failed to create theme" });
    }
  });

  app.put("/api/admin/attributes/themes/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    try {
      const data = insertThemeSchema.partial().parse(req.body);
      const updated = await storage.updateTheme(id, data);
      if (!updated) return res.status(404).json({ message: "Theme not found" });
      await storage.createAuditLog({
        entityType: "attribute", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A theme with that name already exists" });
      res.status(500).json({ message: "Failed to update theme" });
    }
  });

  app.delete("/api/admin/attributes/themes/:id", requirePermission("catalog"), async (req, res) => {
    await storage.deleteTheme(req.params.id as string);
    res.status(204).send();
  });

  // ── Styles CRUD ──────────────────────────────────────────────────────────────
  app.post("/api/admin/attributes/styles", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertStyleSchema.parse(req.body);
      const created = await storage.createStyle(data);
      await storage.createAuditLog({
        entityType: "attribute", entityId: created.id, entityName: created.name,
        action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A style with that name already exists" });
      res.status(500).json({ message: "Failed to create style" });
    }
  });

  app.put("/api/admin/attributes/styles/:id", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    try {
      const data = insertStyleSchema.partial().parse(req.body);
      const updated = await storage.updateStyle(id, data);
      if (!updated) return res.status(404).json({ message: "Style not found" });
      await storage.createAuditLog({
        entityType: "attribute", entityId: id, entityName: updated.name,
        action: "updated", changes: JSON.stringify(data), username: getAdminUsername(req),
      });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A style with that name already exists" });
      res.status(500).json({ message: "Failed to update style" });
    }
  });

  app.delete("/api/admin/attributes/styles/:id", requirePermission("catalog"), async (req, res) => {
    await storage.deleteStyle(req.params.id as string);
    res.status(204).send();
  });

  // ── Short-alias POST/DELETE (/api/admin/{type}) ──────────────────────────────
  app.post("/api/admin/age-groups", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertAgeGroupSchema.parse(req.body);
      const created = await storage.createAgeGroup(data);
      await storage.createAuditLog({ entityType: "attribute", entityId: created.id, entityName: created.name, action: "created", changes: JSON.stringify(data), username: getAdminUsername(req) });
      res.status(201).json(created);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "An age group with that name already exists" });
      res.status(500).json({ message: "Failed to create age group" });
    }
  });
  app.delete("/api/admin/age-groups/:id", requirePermission("catalog"), async (req, res) => {
    await storage.deleteAgeGroup(req.params.id as string);
    res.status(204).send();
  });

  app.post("/api/admin/genders", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertGenderSchema.parse(req.body);
      const created = await storage.createGender(data);
      await storage.createAuditLog({ entityType: "attribute", entityId: created.id, entityName: created.name, action: "created", changes: JSON.stringify(data), username: getAdminUsername(req) });
      res.status(201).json(created);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A gender with that name already exists" });
      res.status(500).json({ message: "Failed to create gender" });
    }
  });
  app.delete("/api/admin/genders/:id", requirePermission("catalog"), async (req, res) => {
    await storage.deleteGender(req.params.id as string);
    res.status(204).send();
  });

  app.post("/api/admin/themes", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertThemeSchema.parse(req.body);
      const created = await storage.createTheme(data);
      await storage.createAuditLog({ entityType: "attribute", entityId: created.id, entityName: created.name, action: "created", changes: JSON.stringify(data), username: getAdminUsername(req) });
      res.status(201).json(created);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A theme with that name already exists" });
      res.status(500).json({ message: "Failed to create theme" });
    }
  });
  app.delete("/api/admin/themes/:id", requirePermission("catalog"), async (req, res) => {
    await storage.deleteTheme(req.params.id as string);
    res.status(204).send();
  });

  app.post("/api/admin/styles", requirePermission("catalog"), async (req, res) => {
    try {
      const data = insertStyleSchema.parse(req.body);
      const created = await storage.createStyle(data);
      await storage.createAuditLog({ entityType: "attribute", entityId: created.id, entityName: created.name, action: "created", changes: JSON.stringify(data), username: getAdminUsername(req) });
      res.status(201).json(created);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      if (err.code === "23505") return res.status(409).json({ message: "A style with that name already exists" });
      res.status(500).json({ message: "Failed to create style" });
    }
  });
  app.delete("/api/admin/styles/:id", requirePermission("catalog"), async (req, res) => {
    await storage.deleteStyle(req.params.id as string);
    res.status(204).send();
  });
}
