import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "./storage";

const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

interface SessionData {
  expiresAt: number;
  username: string;
  isSuperAdmin: boolean;
  permissions: string[];
}

const activeSessions = new Map<string, SessionData>();

const failedLoginTimestamps: number[] = [];
const MAX_FAILED_LOGIN_AGE_MS = 24 * 60 * 60 * 1000;

function recordFailedLogin() {
  const now = Date.now();
  failedLoginTimestamps.push(now);
  const cutoff = now - MAX_FAILED_LOGIN_AGE_MS;
  while (failedLoginTimestamps.length > 0 && failedLoginTimestamps[0] < cutoff) {
    failedLoginTimestamps.shift();
  }
}

export function getFailedLoginStats(): { lastHour: number; last24h: number } {
  const now = Date.now();
  const cutoff24h = now - MAX_FAILED_LOGIN_AGE_MS;
  const cutoff1h  = now - 60 * 60 * 1000;
  const relevant = failedLoginTimestamps.filter(t => t >= cutoff24h);
  return {
    lastHour: relevant.filter(t => t >= cutoff1h).length,
    last24h:  relevant.length,
  };
}

function getEnvAdminCredentials() {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const plainPassword = process.env.ADMIN_PASSWORD;
  if (!username || (!passwordHash && !plainPassword)) {
    return null;
  }
  return { username, passwordHash, plainPassword };
}

export async function handleAdminLogin(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  const envCreds = getEnvAdminCredentials();

  if (envCreds && username === envCreds.username) {
    let valid = false;
    if (envCreds.passwordHash && envCreds.passwordHash.startsWith("$2b$")) {
      valid = await bcrypt.compare(password, envCreds.passwordHash);
    } else if (envCreds.plainPassword) {
      valid = password === envCreds.plainPassword;
    }

    if (!valid) {
      recordFailedLogin();
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    activeSessions.set(sessionToken, {
      expiresAt: Date.now() + SESSION_MAX_AGE,
      username,
      isSuperAdmin: true,
      permissions: [],
    });

    res.cookie(ADMIN_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE,
      sameSite: "lax",
      secure: false,
      path: "/",
    });

    return res.json({ success: true });
  }

  const dbUser = await storage.getAdminUserByUsername(username);
  if (!dbUser || !dbUser.isActive) {
    recordFailedLogin();
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    recordFailedLogin();
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  activeSessions.set(sessionToken, {
    expiresAt: Date.now() + SESSION_MAX_AGE,
    username: dbUser.username,
    isSuperAdmin: false,
    permissions: dbUser.permissions,
  });

  res.cookie(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
    sameSite: "lax",
    secure: false,
    path: "/",
  });

  return res.json({ success: true });
}

export function handleAdminLogout(req: Request, res: Response) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (token) {
    activeSessions.delete(token);
  }
  res.clearCookie(ADMIN_SESSION_COOKIE);
  return res.json({ success: true });
}

export function handleAdminCheck(req: Request, res: Response) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (!token) {
    return res.json({ authenticated: false, isSuperAdmin: false, permissions: [] });
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    res.clearCookie(ADMIN_SESSION_COOKIE);
    return res.json({ authenticated: false, isSuperAdmin: false, permissions: [] });
  }

  return res.json({
    authenticated: true,
    isSuperAdmin: session.isSuperAdmin,
    permissions: session.permissions,
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const envCreds = getEnvAdminCredentials();
  if (!envCreds) {
    return next();
  }

  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    res.clearCookie(ADMIN_SESSION_COOKIE);
    return res.status(401).json({ message: "Session expired" });
  }

  next();
}

export function requirePermission(permission: string) {
  return function(req: Request, res: Response, next: NextFunction) {
    const envCreds = getEnvAdminCredentials();
    if (!envCreds) return next();

    const token = req.cookies?.[ADMIN_SESSION_COOKIE];
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const session = activeSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      activeSessions.delete(token);
      res.clearCookie(ADMIN_SESSION_COOKIE);
      return res.status(401).json({ message: "Session expired" });
    }

    if (session.isSuperAdmin || session.permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({ message: `Permission denied: requires '${permission}'` });
  };
}

export function requireSnapshotAccess(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  const compareToken = req.headers["x-db-compare-token"];
  const snapshotToken = process.env.DB_COMPARE_TOKEN || "";

  if (compareToken && snapshotToken && compareToken === snapshotToken) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    res.clearCookie(ADMIN_SESSION_COOKIE);
    return res.status(401).json({ message: "Session expired" });
  }

  if (session.isSuperAdmin || session.permissions.includes("health")) {
    return next();
  }

  return res.status(403).json({ message: "Permission denied: requires 'health'" });
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    res.clearCookie(ADMIN_SESSION_COOKIE);
    return res.status(401).json({ message: "Session expired" });
  }

  if (!session.isSuperAdmin) {
    return res.status(403).json({ message: "Superadmin access required" });
  }

  next();
}

export function getAdminUsername(req: Request): string {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (token) {
    const session = activeSessions.get(token);
    if (session && session.expiresAt >= Date.now()) {
      return session.username;
    }
  }
  return "unknown";
}

export function getAdminRole(req: Request): { username: string; isSuperAdmin: boolean; permissions: string[] } {
  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  if (token) {
    const session = activeSessions.get(token);
    if (session && session.expiresAt >= Date.now()) {
      return { username: session.username, isSuperAdmin: session.isSuperAdmin, permissions: session.permissions };
    }
  }
  return { username: "unknown", isSuperAdmin: false, permissions: [] };
}

export function invalidateSessionsForUser(username: string): void {
  for (const [token, session] of activeSessions.entries()) {
    if (session.username === username) {
      activeSessions.delete(token);
    }
  }
}

export async function generatePasswordHash(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function getAdminSessionCount(): number {
  const now = Date.now();
  let active = 0;
  for (const [, session] of activeSessions.entries()) {
    if (session.expiresAt >= now) active++;
  }
  return active;
}

export function requireAdminAny(req: Request, res: Response, next: NextFunction) {
  const envCreds = getEnvAdminCredentials();
  if (!envCreds) return next();

  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  const session = token ? activeSessions.get(token) : null;
  if (session && session.expiresAt >= Date.now()) return next();

  const headerPassword = req.headers["x-admin-password"] as string | undefined;
  if (headerPassword && envCreds.plainPassword && headerPassword === envCreds.plainPassword) return next();

  return res.status(401).json({ message: "Authentication required" });
}
