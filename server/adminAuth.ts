import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";

const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const activeSessions = new Map<string, { expiresAt: number; username: string }>();

function getAdminCredentials() {
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

  const creds = getAdminCredentials();
  if (!creds) {
    return res.status(500).json({ message: "Admin credentials not configured" });
  }

  if (username !== creds.username) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  let valid = false;
  if (creds.passwordHash && creds.passwordHash.startsWith("$2b$")) {
    valid = await bcrypt.compare(password, creds.passwordHash);
  } else if (creds.plainPassword) {
    valid = password === creds.plainPassword;
  }

  if (!valid) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  activeSessions.set(sessionToken, {
    expiresAt: Date.now() + SESSION_MAX_AGE,
    username,
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
    return res.json({ authenticated: false });
  }

  const session = activeSessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    activeSessions.delete(token);
    res.clearCookie(ADMIN_SESSION_COOKIE);
    return res.json({ authenticated: false });
  }

  return res.json({ authenticated: true });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const creds = getAdminCredentials();
  if (!creds) {
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

export async function generatePasswordHash(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function requireAdminAny(req: Request, res: Response, next: NextFunction) {
  const creds = getAdminCredentials();
  if (!creds) return next();

  const token = req.cookies?.[ADMIN_SESSION_COOKIE];
  const session = token ? activeSessions.get(token) : null;
  if (session && session.expiresAt >= Date.now()) return next();

  const headerPassword = req.headers["x-admin-password"] as string | undefined;
  if (headerPassword && creds.plainPassword && headerPassword === creds.plainPassword) return next();

  return res.status(401).json({ message: "Authentication required" });
}
