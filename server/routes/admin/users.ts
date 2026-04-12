import type { Express, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { storage } from "../../storage";
import { requireSuperAdmin, getAdminUsername, invalidateSessionsForUser } from "../../adminAuth";

const ALL_PERMISSIONS = [
  "catalog", "orders", "builder", "pages", "brand",
  "customers", "consent", "pricing", "offers", "seo", "export", "health", "audit",
];

const createUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, underscores and hyphens"),
  password: z.string().min(8),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).default([]),
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  password: z.string().min(8).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])).optional(),
  isActive: z.boolean().optional(),
});

export function registerAdminUserRoutes(app: Express) {
  app.get("/api/admin/users", requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const users = await storage.getAdminUsers();
      const safe = users.map(u => ({
        id: u.id,
        username: u.username,
        permissions: u.permissions,
        isActive: u.isActive,
        createdAt: u.createdAt,
      }));
      res.json(safe);
    } catch (err) {
      console.error("Get admin users error:", err);
      res.status(500).json({ message: "Failed to fetch admin users" });
    }
  });

  app.post("/api/admin/users", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const data = createUserSchema.parse(req.body);
      const existing = await storage.getAdminUserByUsername(data.username);
      if (existing) {
        return res.status(409).json({ message: "A user with that username already exists" });
      }
      const passwordHash = await bcrypt.hash(data.password, 10);
      const user = await storage.createAdminUser({
        username: data.username,
        passwordHash,
        permissions: data.permissions,
        isActive: data.isActive,
      });
      await storage.createAuditLog({
        entityType: "admin_user", entityId: user.id, entityName: user.username,
        action: "created", changes: JSON.stringify({ permissions: data.permissions }),
        username: getAdminUsername(req),
      });
      res.status(201).json({
        id: user.id, username: user.username, permissions: user.permissions,
        isActive: user.isActive, createdAt: user.createdAt,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Create admin user error:", err);
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });

  app.patch("/api/admin/users/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const data = updateUserSchema.parse(req.body);
      const before = await storage.getAdminUserById(id);
      if (!before) return res.status(404).json({ message: "User not found" });

      const updateData: Parameters<typeof storage.updateAdminUser>[1] = {};
      if (data.password !== undefined) {
        updateData.passwordHash = await bcrypt.hash(data.password, 10);
      }
      if (data.permissions !== undefined) updateData.permissions = data.permissions;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const updated = await storage.updateAdminUser(id, updateData);
      if (!updated) return res.status(404).json({ message: "User not found" });

      if (data.permissions !== undefined || data.isActive !== undefined) {
        invalidateSessionsForUser(updated.username);
      }

      await storage.createAuditLog({
        entityType: "admin_user", entityId: id, entityName: updated.username,
        action: "updated",
        changes: JSON.stringify({
          ...(data.permissions !== undefined && { permissions: { from: before.permissions, to: data.permissions } }),
          ...(data.isActive !== undefined && { isActive: { from: before.isActive, to: data.isActive } }),
          ...(data.password !== undefined && { password: "changed" }),
        }),
        username: getAdminUsername(req),
      });

      res.json({
        id: updated.id, username: updated.username, permissions: updated.permissions,
        isActive: updated.isActive, createdAt: updated.createdAt,
      });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: err.errors });
      console.error("Update admin user error:", err);
      res.status(500).json({ message: "Failed to update admin user" });
    }
  });

  app.delete("/api/admin/users/:id", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const user = await storage.getAdminUserById(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      await storage.updateAdminUser(id, { isActive: false });
      invalidateSessionsForUser(user.username);
      await storage.createAuditLog({
        entityType: "admin_user", entityId: id, entityName: user.username,
        action: "deactivated", changes: JSON.stringify({ username: user.username }),
        username: getAdminUsername(req),
      });
      res.status(204).send();
    } catch (err) {
      console.error("Deactivate admin user error:", err);
      res.status(500).json({ message: "Failed to deactivate admin user" });
    }
  });
}
