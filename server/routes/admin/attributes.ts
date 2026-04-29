import type { Express, Request, Response } from "express";
import { storage } from "../../storage";
import {
  insertAgeGroupSchema, insertGenderSchema, insertThemeSchema, insertStyleSchema,
  type InsertAgeGroup, type InsertGender, type InsertTheme, type InsertStyle,
} from "@shared/schema";
import type { AgeGroup, Gender, Theme, Style } from "@shared/types";
import { z } from "zod";
import { requirePermission, getAdminUsername } from "../../adminAuth";

// ── Shared handler builder ────────────────────────────────────────────────────

interface NamedRow { id: string; name: string }

interface ParseableSchema<T extends object> {
  parse: (data: unknown) => T;
  partial: () => { parse: (data: unknown) => Partial<T> };
}

function makeHandlers<
  TRow extends NamedRow,
  TInsert extends object,
>(opts: {
  getList:  () => Promise<TRow[]>;
  create:   (data: TInsert) => Promise<TRow>;
  update:   (id: string, data: Partial<TInsert>) => Promise<TRow | undefined>;
  delete:   (id: string) => Promise<void>;
  schema:   ParseableSchema<TInsert>;
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
        const data = opts.schema.parse(req.body);
        const created = await opts.create(data);
        await storage.createAuditLog({
          entityType: "attribute", entityId: created.id, entityName: created.name,
          action: "created", changes: JSON.stringify(data), username: getAdminUsername(req),
        });
        res.status(201).json(created);
      } catch (err: unknown) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
        if (typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505")
          return res.status(409).json({ message: opts.duplicateMsg });
        res.status(500).json({ message: opts.failCreate });
      }
    },
    update: async (req: Request, res: Response) => {
      const id = req.params.id as string;
      try {
        const data = opts.schema.partial().parse(req.body);
        const updated = await opts.update(id, data);
        if (!updated) return res.status(404).json({ message: opts.notFoundMsg });
        await storage.createAuditLog({
          entityType: "attribute", entityId: id, entityName: updated.name,
          action: "updated", changes: JSON.stringify(data), username: getAdminUsername(req),
        });
        res.json(updated);
      } catch (err: unknown) {
        if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
        if (typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "23505")
          return res.status(409).json({ message: opts.duplicateMsg });
        res.status(500).json({ message: opts.failUpdate });
      }
    },
    del: async (req: Request, res: Response) => {
      await opts.delete(req.params.id as string);
      res.status(204).send();
    },
  };
}

// ── Per-type handler sets (shared between canonical and alias paths) ───────────

const ageGroupHandlers = makeHandlers<AgeGroup, InsertAgeGroup>({
  getList:  () => storage.getAgeGroups(),
  create:   (d) => storage.createAgeGroup(d),
  update:   (id, d) => storage.updateAgeGroup(id, d),
  delete:   (id) => storage.deleteAgeGroup(id),
  schema:   insertAgeGroupSchema,
  duplicateMsg: "An age group with that name already exists",
  notFoundMsg:  "Age group not found",
  failCreate:   "Failed to create age group",
  failUpdate:   "Failed to update age group",
});

const genderHandlers = makeHandlers<Gender, InsertGender>({
  getList:  () => storage.getGenders(),
  create:   (d) => storage.createGender(d),
  update:   (id, d) => storage.updateGender(id, d),
  delete:   (id) => storage.deleteGender(id),
  schema:   insertGenderSchema,
  duplicateMsg: "A gender with that name already exists",
  notFoundMsg:  "Gender not found",
  failCreate:   "Failed to create gender",
  failUpdate:   "Failed to update gender",
});

const themeHandlers = makeHandlers<Theme, InsertTheme>({
  getList:  () => storage.getThemes(),
  create:   (d) => storage.createTheme(d),
  update:   (id, d) => storage.updateTheme(id, d),
  delete:   (id) => storage.deleteTheme(id),
  schema:   insertThemeSchema,
  duplicateMsg: "A theme with that name already exists",
  notFoundMsg:  "Theme not found",
  failCreate:   "Failed to create theme",
  failUpdate:   "Failed to update theme",
});

const styleHandlers = makeHandlers<Style, InsertStyle>({
  getList:  () => storage.getStyles(),
  create:   (d) => storage.createStyle(d),
  update:   (id, d) => storage.updateStyle(id, d),
  delete:   (id) => storage.deleteStyle(id),
  schema:   insertStyleSchema,
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
    const { ageGroupIds = [], genderIds = [], themeIds = [], styleIds = [] } = req.body as {
      ageGroupIds?: string[]; genderIds?: string[]; themeIds?: string[]; styleIds?: string[];
    };
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

  // Per-type CRUD — canonical paths and short aliases share the same handler instances
  const guard = requirePermission("catalog");

  for (const [slug, h] of [
    ["age-groups", ageGroupHandlers],
    ["genders",    genderHandlers],
    ["themes",     themeHandlers],
    ["styles",     styleHandlers],
  ] as const) {
    app.get(`/api/admin/attributes/${slug}`,        guard, h.list);
    app.post(`/api/admin/attributes/${slug}`,       guard, h.create);
    app.put(`/api/admin/attributes/${slug}/:id`,    guard, h.update);
    app.delete(`/api/admin/attributes/${slug}/:id`, guard, h.del);

    app.get(`/api/admin/${slug}`,        guard, h.list);
    app.post(`/api/admin/${slug}`,       guard, h.create);
    app.put(`/api/admin/${slug}/:id`,    guard, h.update);
    app.delete(`/api/admin/${slug}/:id`, guard, h.del);
  }
}
