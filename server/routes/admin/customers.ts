import type { Express, Request, Response } from "express";
import { requirePermission } from "../../adminAuth";
import { storage } from "../../storage";

export function registerAdminCustomerRoutes(app: Express) {
  app.get("/api/admin/customers", requirePermission("customers"), async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string) || undefined;

      const [customerList, total] = await Promise.all([
        storage.getAllCustomers({ search, limit, offset }),
        storage.getCustomersCount({ search }),
      ]);

      res.json({ customers: customerList, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (err) {
      console.error("Admin customers list error:", err);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/admin/customers/:id", requirePermission("customers"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [customer, orders] = await Promise.all([
        storage.getCustomerById(id),
        storage.getOrdersByCustomerId(id),
      ]);

      if (!customer) {
        res.status(404).json({ message: "Customer not found" });
        return;
      }

      const orderCount = orders.length;
      const totalSpent = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);
      const lastOrderAt = orders.length > 0
        ? orders.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())[0].createdAt
        : null;

      res.json({ customer, orderSummary: { orderCount, totalSpent, lastOrderAt }, orders });
    } catch (err) {
      console.error("Admin customer detail error:", err);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.patch("/api/admin/customers/:id", requirePermission("customers"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, phone, shippingAddress, shippingCity, shippingState, shippingPincode } = req.body;

      const existing = await storage.getCustomerById(id);
      if (!existing) {
        res.status(404).json({ message: "Customer not found" });
        return;
      }

      const updated = await storage.updateCustomer(id, {
        name: name ?? existing.name,
        phone: phone ?? existing.phone,
        shippingAddress: shippingAddress ?? existing.shippingAddress,
        shippingCity: shippingCity ?? existing.shippingCity,
        shippingState: shippingState ?? existing.shippingState,
        shippingPincode: shippingPincode ?? existing.shippingPincode,
      });

      res.json({ customer: updated });
    } catch (err) {
      console.error("Admin customer update error:", err);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });
}
