import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { requirePermission, getAdminUsername } from "../../adminAuth";
import { handleAdminLogin, handleAdminLogout, handleAdminCheck } from "../../adminAuth";
import { notificationService } from "../../providers/notification";
import { enrichItemsWithImages } from "../../utils/imageEnrichment";

const orderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
  courierPartner: z.string().optional(),
  serviceType: z.enum(["land", "air"]).optional(),
  trackingNumber: z.string().optional(),
});

const orderNotesSchema = z.object({
  notes: z.string().default(""),
});

export function registerAdminOrderRoutes(app: Express) {
  app.post("/api/admin/login", handleAdminLogin);
  app.post("/api/admin/logout", handleAdminLogout);
  app.get("/api/admin/check", handleAdminCheck);

  app.get("/api/admin/orders", requirePermission("orders"), async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const filters = { status: status || undefined, search: search || undefined, limit, offset };
      const [ordersList, total] = await Promise.all([
        storage.getAllOrders(filters),
        storage.getOrderCount({ status: filters.status, search: filters.search }),
      ]);
      res.json({ orders: ordersList, total, limit, offset });
    } catch (err) {
      console.error("Admin orders list error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/orders/:id", requirePermission("orders"), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const order = await storage.getOrderById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const rawItems = await storage.getOrderItems(id);
      const items = await enrichItemsWithImages(rawItems);
      res.json({ ...order, items });
    } catch (err) {
      console.error("Admin order detail error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/orders/:id/status", requirePermission("orders"), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status, courierPartner, serviceType, trackingNumber } = orderStatusSchema.parse(req.body);
      const order = await storage.getOrderById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const shippingInfo = status === "shipped" ? { courierPartner, serviceType, trackingNumber } : undefined;
      const updated = await storage.updateOrderStatus(id, status, shippingInfo);
      await storage.createAuditLog({
        entityType: "order",
        entityId: id,
        entityName: `Order #${id.slice(-8).toUpperCase()}`,
        action: "status_updated",
        changes: JSON.stringify({ from: order.status, to: status }),
        username: getAdminUsername(req),
      });
      if (status === "confirmed" && order.customerEmail) {
        const items = await storage.getOrderItems(id);
        notificationService.sendOrderConfirmed({
          orderId: id,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone || "",
          total: order.total,
          itemCount: items.length,
          items: items.map(i => ({
            productName: i.productName,
            productPrice: i.productPrice,
            quantity: i.quantity,
            personalizationName: i.personalizationName ?? null,
            isFree: i.isFree ?? null,
          })),
        }).catch(err => console.error("Order confirmed notification error:", err));
      } else if (["shipped", "delivered", "cancelled"].includes(status) && order.customerEmail) {
        notificationService.sendOrderStatusUpdate(id, status, order.customerEmail, shippingInfo)
          .catch(err => console.error("Status notification error:", err));
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      console.error("Admin order status update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/orders/:id/notes", requirePermission("orders"), async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { notes } = orderNotesSchema.parse(req.body);
      const order = await storage.getOrderById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const updated = await storage.updateOrderNotes(id, notes || "");
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: err.errors });
      }
      console.error("Admin order notes update error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
