import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.history.list.path, async (req, res) => {
    const history = await storage.getHistory();
    res.json(history);
  });

  app.post(api.history.create.path, async (req, res) => {
    try {
      const input = api.history.create.input.parse(req.body);
      const item = await storage.createHistory(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input" });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete(api.history.clear.path, async (req, res) => {
    await storage.clearHistory();
    res.status(204).send();
  });

  return httpServer;
}
