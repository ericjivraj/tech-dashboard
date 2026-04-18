import { getAuth, createClerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
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

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const editorEmails = getEditorEmails();

  if (editorEmails === null) {
    if (process.env.NODE_ENV === "production") {
      logger.error(
        "EDITOR_EMAILS env var is not set in production. All write access is blocked. Set EDITOR_EMAILS to a comma-separated list of authorized editor email addresses.",
      );
      res.status(403).json({
        error:
          "Write access is not configured. Set the EDITOR_EMAILS environment variable to authorize editors.",
      });
      return;
    }
    logger.warn(
      { userId },
      "EDITOR_EMAILS is not set — any authenticated user can write (development mode). Set EDITOR_EMAILS before going to production.",
    );
    next();
    return;
  }

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

  next();
}
