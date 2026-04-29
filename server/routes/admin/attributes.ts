import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import { insertAgeGroupSchema, insertGenderSchema, insertThemeSchema, insertStyleSchema } from "@shared/schema";
import { z, ZodSchema } from "zod";
import { requirePermission, getAdminUsername } from "../../adminAuth";

// ── Shared handler builders ───────────────────────────────────────────────────

type GetListFn  = () => Promise<any[]>;
type CreateFn   = (data: any) => Promise<any>;
type UpdateFn   = (id: string, data: any) => Promise<any | undefined>;
type DeleteFn   = (id: string) => Promise<void>;

function makeHandlers(opts: {
  label: string;
  getList:  GetListFn;
  create:   CreateFn;
  update:   UpdateFn;
  delete:   DeleteFn;
  insertSchema: ZodSchema<any>;
  duplicateMsg: string;
  notFoundMsg:  string;
  failCreate:   string;
  failUpdate:   string;
}) {
  return {
    list: async (_req: Request, res: Response) => {
      res.json(await opts.getList());
    },
    create: async (req: Request, res: Response) => {
      try {
        const data = opts.insertSchema.parse(req.body);
        const created = await opts.create(data);
        await storage.createAuditLog({
          entityType: "attribute", entityId: created.id, entityName: created.name,
          action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
        });
        res.status(201).json(created);
      } catch (err: any) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
        if (err.code === "23505") return res.status(409).json({ message: opts.duplicateMsg });
        res.status(500).json({ message: opts.failCreate });
      }
    },
    update: async (req: Request, res: Response) => {
      const id = req.params.id as string;
      try {
        const data = opts.insertSchema.partial().parse(req.body);
        const updated = await opts.update(id, data);
        if (!updated) return res.status(404).json({ message: opts.notFoundMsg });
        await storage.createAuditLog({
          entityType: "attribute", entityId: id, entityName: updated.name,
          action: "updated", changes: JSON.stringify(data), username: getAdminUsername(req),
        });
        res.json(updated);
      } catch (err: any) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
        if (err.code === "23505") return res.status(409).json({ message: opts.duplicateMsg });
        res.status(500).json({ message: opts.failUpdate });
      }
    },
    del: async (req: Request, res: Response) => {
      await opts.delete(req.params.id as string);
      res.status(204).send();
    },
  };
}

// ── Per-type handler sets ─────────────────────────────────────────────────────

const ageGroupHandlers = makeHandlers({
  label: "age group",
  getList:  () => storage.getAgeGroups(),
  create:   (d) => storage.createAgeGroup(d),
  update:   (id, d) => storage.updateAgeGroup(id, d),
  delete:   (id) => storage.deleteAgeGroup(id),
  insertSchema: insertAgeGroupSchema,
  duplicateMsg: "An age group with that name already exists",
  notFoundMsg:  "Age group not found",
  failCreate:   "Failed to create age group",
  failUpdate:   "Failed to update age group",
});

const genderHandlers = makeHandlers({
  label: "gender",
  getList:  () => storage.getGenders(),
  create:   (d) => storage.createGender(d),
  update:   (id, d) => storage.updateGender(id, d),
  delete:   (id) => storage.deleteGender(id),
  insertSchema: insertGenderSchema,
  duplicateMsg: "A gender with that name already exists",
  notFoundMsg:  "Gender not found",
  failCreate:   "Failed to create gender",
  failUpdate:   "Failed to update gender",
});

const themeHandlers = makeHandlers({
  label: "theme",
  getList:  () => storage.getThemes(),
  create:   (d) => storage.createTheme(d),
  update:   (id, d) => storage.updateTheme(id, d),
  delete:   (id) => storage.deleteTheme(id),
  insertSchema: insertThemeSchema,
  duplicateMsg: "A theme with that name already exists",
  notFoundMsg:  "Theme not found",
  failCreate:   "Failed to create theme",
  failUpdate:   "Failed to update theme",
});

const styleHandlers = makeHandlers({
  label: "style",
  getList:  () => storage.getStyles(),
  create:   (d) => storage.createStyle(d),
  update:   (id, d) => storage.updateStyle(id, d),
  delete:   (id) => storage.deleteStyle(id),
  insertSchema: insertStyleSchema,
  duplicateMsg: "A style with that name already exists",
  notFoundMsg:  "Style not found",
  failCreate:   "Failed to create style",
  failUpdate:   "Failed to update style",
});

// ── Route registration ────────────────────────────────────────────────────────

export function registerAdminAttributeRoutes(app: Express) {

  // Bundled attributes (all types in one response)
  app.get("/api/admin/attributes", requirePermission("catalog"), async (_req, res) => {
    res.json(await storage.getAttributes());
  });

  // Product-level attribute assignment
  app.get("/api/admin/products/:id/attributes", requirePermission("catalog"), async (req, res) => {
    const id = req.params.id as string;
    if (!id) return res.status(400).json({ message: "Invalid product ID" });
    res.json(await storage.getProductAttributeIds(id));
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

  // Per-type CRUD — canonical paths at /api/admin/attributes/:type
  // Aliases at /api/admin/:type share the same handler instances (no duplication)
  const guard = requirePermission("catalog");

  for (const [slug, h] of [
    ["age-groups", ageGroupHandlers],
    ["genders",    genderHandlers],
    ["themes",     themeHandlers],
    ["styles",     styleHandlers],
  ] as const) {
    app.get(`/api/admin/attributes/${slug}`,      guard, h.list);
    app.post(`/api/admin/attributes/${slug}`,     guard, h.create);
    app.put(`/api/admin/attributes/${slug}/:id`,  guard, h.update);
    app.delete(`/api/admin/attributes/${slug}/:id`, guard, h.del);

    // Short aliases share the same handler references — no code duplication
    app.get(`/api/admin/${slug}`,      guard, h.list);
    app.post(`/api/admin/${slug}`,     guard, h.create);
    app.put(`/api/admin/${slug}/:id`,  guard, h.update);
    app.delete(`/api/admin/${slug}/:id`, guard, h.del);
  }
}
