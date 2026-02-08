import { history, type HistoryItem, type InsertHistory } from "@shared/schema";
import { db } from "./db";
import { desc } from "drizzle-orm";

export interface IStorage {
  getHistory(): Promise<HistoryItem[]>;
  createHistory(item: InsertHistory): Promise<HistoryItem>;
  clearHistory(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getHistory(): Promise<HistoryItem[]> {
    return await db.select().from(history).orderBy(desc(history.createdAt));
  }

  async createHistory(insertItem: InsertHistory): Promise<HistoryItem> {
    const [item] = await db.insert(history).values(insertItem).returning();
    return item;
  }

  async clearHistory(): Promise<void> {
    await db.delete(history);
  }
}

export const storage = new DatabaseStorage();
