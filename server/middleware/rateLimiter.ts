import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export interface RateLimitTierConfig {
  enabled: boolean;
  windowMs: number;
  max: number;
}

export interface RateLimitConfig {
  global: RateLimitTierConfig;
  moderate: RateLimitTierConfig;
  strict: RateLimitTierConfig;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  global:   { enabled: true, windowMs: 60_000,       max: 200 },
  moderate: { enabled: true, windowMs: 60_000,       max: 60  },
  strict:   { enabled: true, windowMs: 3_600_000,    max: 10  },
};

let currentConfig: RateLimitConfig = { ...DEFAULT_CONFIG };

let _globalLimiter:   RateLimitRequestHandler;
let _moderateLimiter: RateLimitRequestHandler;
let _strictLimiter:   RateLimitRequestHandler;

interface BlockKey { tier: string; cat: string; }
const pendingBlocks = new Map<string, number>();

function incBlock(tier: string, cat: string) {
  const key = `${tier}::${cat}`;
  pendingBlocks.set(key, (pendingBlocks.get(key) ?? 0) + 1);
}

export function getPendingBlockSnapshot(): Array<{ tier: string; cat: string; count: number }> {
  return Array.from(pendingBlocks.entries()).map(([key, count]) => {
    const [tier, cat] = key.split("::");
    return { tier, cat, count };
  });
}

export function clearPendingBlocks(): void {
  pendingBlocks.clear();
}

function categoriseEndpoint(path: string): string {
  if (/\/(send-otp|verify-otp)/.test(path)) return "otp";
  if (/\/checkout|\/razorpay/.test(path)) return "checkout";
  if (/\/cart/.test(path)) return "cart";
  if (/\/consent|\/discount/.test(path)) return "consent";
  return "other";
}

function buildLimiter(tier: string, tierCfg: RateLimitTierConfig): RateLimitRequestHandler {
  return rateLimit({
    windowMs: tierCfg.windowMs,
    limit:    tierCfg.max,
    skip:     () => !tierCfg.enabled,
    standardHeaders: true,
    legacyHeaders:   false,
    handler: (req: Request, res: Response) => {
      incBlock(tier, categoriseEndpoint(req.path));
      res.status(429).json({ message: `Too many requests (${tier} limit). Please try again later.` });
    },
  });
}

function buildAllLimiters() {
  _globalLimiter   = buildLimiter("global",   currentConfig.global);
  _moderateLimiter = buildLimiter("moderate", currentConfig.moderate);
  _strictLimiter   = buildLimiter("strict",   currentConfig.strict);
}

buildAllLimiters();

export const globalLimiter   = (req: Request, res: Response, next: NextFunction) => _globalLimiter(req, res, next);
export const moderateLimiter = (req: Request, res: Response, next: NextFunction) => _moderateLimiter(req, res, next);
export const strictLimiter   = (req: Request, res: Response, next: NextFunction) => _strictLimiter(req, res, next);

export function getRateLimitConfig(): RateLimitConfig {
  return currentConfig;
}

export async function loadRateLimitConfig(): Promise<void> {
  try {
    const record = await storage.getSiteConfig("rate-limits");
    if (record) {
      const parsed = JSON.parse(record.value) as RateLimitConfig;
      currentConfig = { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    currentConfig = { ...DEFAULT_CONFIG };
  }
  buildAllLimiters();
}

export async function saveRateLimitConfig(config: RateLimitConfig): Promise<void> {
  currentConfig = config;
  buildAllLimiters();
  await storage.upsertSiteConfig("rate-limits", JSON.stringify(config));
}
