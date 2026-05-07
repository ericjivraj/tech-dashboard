import type { Request, Response, NextFunction } from "express";
import { formatDisplayName, readSessionFromRequest } from "../lib/adminAuth";

export interface AuthContext {
  userId: string;
  email: string;
  role: "admin";
  team: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

function adminCookieAuthContext(req: Request): AuthContext | null {
  const session = readSessionFromRequest(req);
  if (!session) return null;
  return {
    userId: `admin:${session.username}`,
    email: formatDisplayName(session),
    role: "admin",
    team: null,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ctx = adminCookieAuthContext(req);
  if (!ctx) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  req.authContext = ctx;
  next();
}

export function requireRole(roles: Array<"admin">) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ctx = req.authContext ?? adminCookieAuthContext(req);
    if (!ctx) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(ctx.role)) {
      res.status(403).json({ error: `Forbidden: requires one of roles: ${roles.join(", ")}` });
      return;
    }
    req.authContext = ctx;
    next();
  };
}
