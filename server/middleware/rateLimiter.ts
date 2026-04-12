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

function buildLimiter(tier: RateLimitTierConfig, label: string): RateLimitRequestHandler {
  return rateLimit({
    windowMs: tier.windowMs,
    limit:    tier.max,
    skip:     () => !tier.enabled,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { message: `Too many requests (${label} limit). Please try again later.` },
  });
}

function buildAllLimiters() {
  _globalLimiter   = buildLimiter(currentConfig.global,   "global");
  _moderateLimiter = buildLimiter(currentConfig.moderate, "moderate");
  _strictLimiter   = buildLimiter(currentConfig.strict,   "strict");
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
