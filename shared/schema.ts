import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const history = pgTable("history", {
  id: serial("id").primaryKey(),
  expression: text("expression").notNull(),
  result: text("result").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHistorySchema = createInsertSchema(history).omit({ id: true, createdAt: true });

export type HistoryItem = typeof history.$inferSelect;
export type InsertHistory = z.infer<typeof insertHistorySchema>;
