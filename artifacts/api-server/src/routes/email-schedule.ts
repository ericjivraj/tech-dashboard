import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailScheduleTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { refreshSchedule, sendWeeklyReport, fetchProjectsForReport, buildHtmlSummary } from "../lib/emailScheduler";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function ensureScheduleRow() {
  const rows = await db.select().from(emailScheduleTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db
      .insert(emailScheduleTable)
      .values({ enabled: false, dayOfWeek: 1, hour: 8, recipients: "" })
      .returning();
    return row;
  }
  return rows[0];
}

router.get("/email-schedule", requireAuth, async (_req, res): Promise<void> => {
  try {
    const schedule = await ensureScheduleRow();
    res.json(schedule);
  } catch (err) {
    logger.error({ err }, "Failed to get email schedule");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/email-schedule", requireAuth, async (req, res): Promise<void> => {
  try {
    const schedule = await ensureScheduleRow();

    const { enabled, dayOfWeek, hour, recipients } = req.body as {
      enabled?: boolean;
      dayOfWeek?: number;
      hour?: number;
      recipients?: string;
    };

    const updates: Record<string, unknown> = {};
    if (enabled !== undefined) updates.enabled = enabled;
    if (dayOfWeek !== undefined && dayOfWeek >= 0 && dayOfWeek <= 6) updates.dayOfWeek = dayOfWeek;
    if (hour !== undefined && hour >= 0 && hour <= 23) updates.hour = hour;
    if (recipients !== undefined) updates.recipients = recipients;

    const [updated] = await db
      .update(emailScheduleTable)
      .set(updates)
      .where(eq(emailScheduleTable.id, schedule.id))
      .returning();

    await refreshSchedule();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Failed to update email schedule");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/email-schedule/preview", requireAuth, async (_req, res): Promise<void> => {
  try {
    const projects = await fetchProjectsForReport();
    const html = buildHtmlSummary(projects);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    logger.error({ err }, "Failed to generate email preview");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/email-schedule/send-now", requireAuth, async (_req, res): Promise<void> => {
  try {
    const result = await sendWeeklyReport({ ignoreEnabled: true });
    if (result.success) {
      res.json({ message: "Report sent successfully" });
    } else {
      res.status(400).json({ error: result.error ?? "Failed to send report" });
    }
  } catch (err) {
    logger.error({ err }, "Failed to send report");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
