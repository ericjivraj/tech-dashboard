import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/health", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ok", db: "ok" });
  } catch (err) {
    // Log the actual error so it's visible in pod logs — the response stays
    // generic so we don't leak details over the wire.
    logger.error(
      {
        err,
        // Sanitised connection target (no password) so it's easy to confirm
        // which Postgres we're trying to reach from a failing pod.
        postgresHost: process.env.POSTGRES_HOST ?? null,
        postgresPort: process.env.POSTGRES_PORT ?? "5432",
        postgresUser: process.env.POSTGRES_USER ?? null,
        postgresDb:
          process.env.POSTGRES_DB ??
          process.env.POSTGRES_DATABASE ??
          process.env.POSTGRES_USER ??
          null,
        databaseUrlSet: !!process.env.DATABASE_URL,
      },
      "Healthcheck DB probe failed",
    );
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

export default router;
