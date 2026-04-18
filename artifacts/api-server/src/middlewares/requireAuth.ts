import { getAuth, createClerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const clerkClientInstance = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function getEditorEmails(): Set<string> {
  const raw = process.env.EDITOR_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const editorEmails = getEditorEmails();

  if (editorEmails.size > 0) {
    try {
      const user = await clerkClientInstance.users.getUser(userId);
      const primaryEmail = user.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
      if (!editorEmails.has(primaryEmail)) {
        logger.warn({ userId, primaryEmail }, "Authenticated user is not an authorized editor");
        res.status(403).json({ error: "Forbidden — not an authorized editor" });
        return;
      }
    } catch (err) {
      logger.error({ err, userId }, "Failed to verify editor authorization");
      res.status(403).json({ error: "Forbidden — could not verify editor status" });
      return;
    }
  } else {
    logger.warn(
      "EDITOR_EMAILS env var is not set — any authenticated Clerk user can write. Set EDITOR_EMAILS to restrict access.",
    );
  }

  next();
}
