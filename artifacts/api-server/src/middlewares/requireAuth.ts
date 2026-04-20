import { getAuth, createClerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import type { UserRole } from "@workspace/db";
import { logger } from "../lib/logger";

const clerkClientInstance = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function getEditorEmails(): Set<string> | null {
  const raw = process.env.EDITOR_EMAILS ?? "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return emails.length > 0 ? new Set(emails) : null;
}

function getGuestEmailsMap(): Map<string, string> {
  const raw = process.env.GUEST_EMAILS ?? "";
  const map = new Map<string, string>();
  if (!raw.trim()) return map;
  for (const entry of raw.split(",")) {
    const [email, team] = entry.trim().split(":");
    if (email && team) map.set(email.trim().toLowerCase(), team.trim());
  }
  return map;
}

async function hasManagedUsers(): Promise<boolean> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  return (row?.count ?? 0) > 0;
}

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole | "admin";
  team: string | null;
  dbUserId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export async function resolveAuthContext(clerkUserId: string): Promise<AuthContext | null> {
  try {
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
    if (dbUser) {
      return {
        userId: clerkUserId,
        email: dbUser.email,
        role: dbUser.role,
        team: dbUser.team ?? null,
        dbUserId: dbUser.id,
      };
    }

    const clerkUser = await clerkClientInstance.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";

    if (email) {
      const [userByEmail] = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (userByEmail) {
        if (!userByEmail.clerkUserId) {
          await db.update(usersTable).set({ clerkUserId }).where(eq(usersTable.id, userByEmail.id)).catch(() => undefined);
        }
        return {
          userId: clerkUserId,
          email: userByEmail.email,
          role: userByEmail.role,
          team: userByEmail.team ?? null,
          dbUserId: userByEmail.id,
        };
      }
    }

    const guestEmailsMap = getGuestEmailsMap();

    if (guestEmailsMap.has(email)) {
      const team = guestEmailsMap.get(email)!;
      return { userId: clerkUserId, email, role: "guest", team, dbUserId: null };
    }

    const managedUsersExist = await hasManagedUsers();
    if (managedUsersExist) {
      return null;
    }

    const editorEmails = getEditorEmails();

    if (editorEmails !== null && editorEmails.has(email)) {
      return { userId: clerkUserId, email, role: "admin", team: null, dbUserId: null };
    }

    if (editorEmails === null && guestEmailsMap.size === 0) {
      if (process.env.NODE_ENV !== "production") {
        return { userId: clerkUserId, email, role: "admin", team: null, dbUserId: null };
      }
    }

    return null;
  } catch (err) {
    logger.error({ err, clerkUserId }, "Failed to resolve auth context");
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const ctx = await resolveAuthContext(userId);

  if (!ctx) {
    if (process.env.NODE_ENV === "production") {
      logger.error({ userId }, "EDITOR_EMAILS env var is not set in production. All write access is blocked.");
      res.status(403).json({
        error: "Write access is not configured. Set the EDITOR_EMAILS environment variable to authorize editors.",
      });
    } else {
      logger.warn({ userId }, "No auth context resolved — user is not authorized");
      res.status(403).json({ error: "Forbidden — not an authorized editor" });
    }
    return;
  }

  req.authContext = ctx;
  next();
}

export function requireRole(roles: Array<UserRole | "admin">) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const auth = getAuth(req);
    const userId = auth?.userId;

    if (!userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const ctx = req.authContext ?? (await resolveAuthContext(userId));

    if (!ctx) {
      res.status(403).json({ error: "Forbidden — not authorized" });
      return;
    }

    if (!roles.includes(ctx.role)) {
      res.status(403).json({ error: `Forbidden — requires one of roles: ${roles.join(", ")}` });
      return;
    }

    req.authContext = ctx;
    next();
  };
}
