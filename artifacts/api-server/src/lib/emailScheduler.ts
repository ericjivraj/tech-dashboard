import * as cron from "node-cron";
import { Resend } from "resend";
import { db, emailScheduleTable, projectsTable, projectGoalsTable, goalsTable, projectUpdatesTable, cyclesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

let scheduledTask: cron.ScheduledTask | null = null;

export function buildCsvContent(projects: ProjectRow[]): string {
  const statusLabels: Record<string, string> = {
    new_request: "New Request",
    backlog: "Backlog",
    up_next: "Up Next",
    in_progress: "In Progress",
    blocked: "Blocked",
    done: "Done",
  };

  function csvCell(value: string | null | undefined): string {
    const str = value ?? "";
    if (str.includes('"') || str.includes(",") || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const headers = ["Title", "Status", "Confidence", "Sponsor", "Team", "Story Points", "Cycle", "Goals", "Latest Update", "Start Date", "End Date"];

  const rows = projects.map((p) => [
    csvCell(p.title),
    csvCell(statusLabels[p.status] ?? p.status),
    csvCell(p.confidence?.replace(/_/g, " ") ?? ""),
    csvCell(p.sponsor ?? ""),
    csvCell(p.team ?? ""),
    csvCell(p.storyPoints?.toString() ?? ""),
    csvCell(p.cycleName ?? ""),
    csvCell(p.goals.map((g) => g.name).join("; ")),
    csvCell(p.latestUpdate ?? ""),
    csvCell(p.startDate ?? ""),
    csvCell(p.endDate ?? ""),
  ].join(","));

  return [headers.map(csvCell).join(","), ...rows].join("\n");
}

export function buildHtmlSummary(projects: ProjectRow[]): string {
  const statusLabels: Record<string, string> = {
    new_request: "New Request",
    backlog: "Backlog",
    up_next: "Up Next",
    in_progress: "In Progress",
    blocked: "Blocked",
    done: "Done",
  };

  const statusColors: Record<string, string> = {
    new_request: "#8b5cf6",
    backlog: "#6b7280",
    up_next: "#3b82f6",
    in_progress: "#f59e0b",
    blocked: "#ef4444",
    done: "#10b981",
  };

  const statusCounts: Record<string, number> = {};
  for (const p of projects) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
  }

  const summaryRows = Object.entries(statusCounts).map(([status, count]) => {
    const label = statusLabels[status] ?? status;
    const color = statusColors[status] ?? "#6b7280";
    return `<tr>
      <td style="padding:8px 16px;"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};margin-right:8px;"></span>${label}</td>
      <td style="padding:8px 16px;font-weight:600;">${count}</td>
    </tr>`;
  }).join("");

  const projectRows = projects.map((p) => {
    const statusLabel = statusLabels[p.status] ?? p.status;
    const color = statusColors[p.status] ?? "#6b7280";
    return `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:8px 12px;font-weight:500;">${escapeHtml(p.title)}</td>
      <td style="padding:8px 12px;"><span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${color}22;color:${color};font-size:12px;font-weight:600;">${statusLabel}</span></td>
      <td style="padding:8px 12px;color:#6b7280;">${escapeHtml(p.team ?? "")}</td>
      <td style="padding:8px 12px;color:#6b7280;">${escapeHtml(p.sponsor ?? "")}</td>
      <td style="padding:8px 12px;color:#6b7280;">${p.storyPoints ?? ""}</td>
      <td style="padding:8px 12px;color:#6b7280;max-width:280px;">${escapeHtml(p.latestUpdate ?? "")}</td>
    </tr>`;
  }).join("");

  const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#111827;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:900px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <h1 style="margin:0 0 4px;font-size:24px;">Weekly Portfolio Report</h1>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${date}</p>

    <h2 style="font-size:16px;margin:0 0 12px;">Status Summary</h2>
    <table style="border-collapse:collapse;margin-bottom:32px;background:#f9fafb;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:8px 16px;text-align:left;font-size:13px;color:#6b7280;">Status</th>
        <th style="padding:8px 16px;text-align:left;font-size:13px;color:#6b7280;">Count</th>
      </tr></thead>
      <tbody>${summaryRows}</tbody>
      <tfoot><tr style="background:#f3f4f6;font-weight:700;">
        <td style="padding:8px 16px;">Total</td>
        <td style="padding:8px 16px;">${projects.length}</td>
      </tr></tfoot>
    </table>

    <h2 style="font-size:16px;margin:0 0 12px;">All Projects</h2>
    <div style="overflow-x:auto;">
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead><tr style="background:#f3f4f6;">
          <th style="padding:8px 12px;text-align:left;color:#6b7280;">Title</th>
          <th style="padding:8px 12px;text-align:left;color:#6b7280;">Status</th>
          <th style="padding:8px 12px;text-align:left;color:#6b7280;">Team</th>
          <th style="padding:8px 12px;text-align:left;color:#6b7280;">Sponsor</th>
          <th style="padding:8px 12px;text-align:left;color:#6b7280;">Points</th>
          <th style="padding:8px 12px;text-align:left;color:#6b7280;">Latest Update</th>
        </tr></thead>
        <tbody>${projectRows}</tbody>
      </table>
    </div>

    <p style="margin:32px 0 0;font-size:12px;color:#9ca3af;">This report was automatically generated by PortcoDash. A CSV of all projects is attached.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ProjectRow = {
  id: number;
  title: string;
  status: string;
  confidence: string | null;
  sponsor: string | null;
  team: string | null;
  storyPoints: number | null;
  startDate: string | null;
  endDate: string | null;
  cycleName: string | null;
  goals: { name: string }[];
  latestUpdate: string | null;
};

export async function fetchProjectsForReport(): Promise<ProjectRow[]> {
  const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);

  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);

  const goalRows = await db
    .select({ projectId: projectGoalsTable.projectId, goal: goalsTable })
    .from(projectGoalsTable)
    .innerJoin(goalsTable, eq(projectGoalsTable.goalId, goalsTable.id))
    .where(inArray(projectGoalsTable.projectId, projectIds));

  const updateRows = await db
    .select()
    .from(projectUpdatesTable)
    .where(inArray(projectUpdatesTable.projectId, projectIds))
    .orderBy(projectUpdatesTable.createdAt);

  const cycleIds = [...new Set(projects.filter((p) => p.cycleId).map((p) => p.cycleId as number))];
  const cycles = cycleIds.length > 0
    ? await db.select().from(cyclesTable).where(inArray(cyclesTable.id, cycleIds))
    : [];
  const cycleMap = new Map(cycles.map((c) => [c.id, c]));

  const goalsByProject = new Map<number, { name: string }[]>();
  for (const r of goalRows) {
    const existing = goalsByProject.get(r.projectId) ?? [];
    existing.push({ name: r.goal.name });
    goalsByProject.set(r.projectId, existing);
  }

  const latestUpdateByProject = new Map<number, string>();
  for (const u of updateRows) {
    latestUpdateByProject.set(u.projectId, u.content);
  }

  return projects.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    confidence: p.confidence ?? null,
    sponsor: p.sponsor ?? null,
    team: p.team ?? null,
    storyPoints: p.storyPoints ?? null,
    startDate: p.startDate ?? null,
    endDate: p.endDate ?? null,
    cycleName: p.cycleId ? (cycleMap.get(p.cycleId)?.name ?? null) : null,
    goals: goalsByProject.get(p.id) ?? [],
    latestUpdate: latestUpdateByProject.get(p.id) ?? null,
  }));
}

export async function sendWeeklyReport(
  opts: { ignoreEnabled?: boolean } = {}
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping email report");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const [schedule] = await db.select().from(emailScheduleTable).limit(1);
  if (!schedule) {
    return { success: false, error: "No email schedule configured" };
  }
  if (!opts.ignoreEnabled && !schedule.enabled) {
    return { success: false, error: "Email schedule is disabled" };
  }

  const recipients = schedule.recipients
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  if (recipients.length === 0) {
    return { success: false, error: "No recipients configured" };
  }

  const projects = await fetchProjectsForReport();
  const csvContent = buildCsvContent(projects);
  const htmlBody = buildHtmlSummary(projects);

  const date = new Date().toISOString().split("T")[0];
  const resend = new Resend(apiKey);

  const fromAddress = process.env["RESEND_FROM_EMAIL"] ?? "reports@portcodash.io";

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: recipients,
    subject: `Weekly Portfolio Report — ${date}`,
    html: htmlBody,
    attachments: [
      {
        filename: `portfolio-${date}.csv`,
        content: Buffer.from(csvContent).toString("base64"),
      },
    ],
  });

  if (error) {
    logger.error({ error }, "Failed to send weekly report email");
    return { success: false, error: error.message };
  }

  await db
    .update(emailScheduleTable)
    .set({ lastSentAt: new Date() })
    .where(eq(emailScheduleTable.id, schedule.id));

  logger.info({ recipients, count: projects.length }, "Weekly portfolio report sent");
  return { success: true };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function startEmailScheduler(): void {
  logger.info("Email scheduler starting...");
  refreshSchedule();
}

export async function refreshSchedule(): Promise<void> {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  let schedule;
  try {
    const rows = await db.select().from(emailScheduleTable).limit(1);
    schedule = rows[0];
  } catch (err) {
    logger.error({ err }, "Failed to fetch email schedule from DB");
    return;
  }

  if (!schedule || !schedule.enabled) {
    logger.info("Email schedule is disabled — no cron task registered");
    return;
  }

  const cronExpr = `0 ${schedule.hour} * * ${schedule.dayOfWeek}`;
  logger.info({ cronExpr, day: DAY_NAMES[schedule.dayOfWeek], hour: schedule.hour }, "Registering email report cron");

  scheduledTask = cron.schedule(cronExpr, async () => {
    logger.info("Running scheduled weekly portfolio report");
    const result = await sendWeeklyReport();
    if (!result.success) {
      logger.warn({ error: result.error }, "Weekly report send failed");
    }
  }, { timezone: "UTC" });
}
