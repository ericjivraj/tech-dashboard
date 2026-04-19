import type { ProjectWithDetails } from "@workspace/api-client-react";
import { STATUS_LABELS } from "./constants";

function escapeCSV(value: string | null | undefined): string {
  const str = value ?? "";
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportProjectsToCSV(
  projects: ProjectWithDetails[],
  filename = "portfolio-export.csv"
) {
  const headers = [
    "Title",
    "Status",
    "Confidence",
    "Sponsor",
    "Team",
    "Stakeholder",
    "Story Points",
    "Cycle",
    "Goals",
    "Latest Update",
    "Start Date",
    "End Date",
  ];

  const rows = projects.map((p) => [
    escapeCSV(p.title),
    escapeCSV(STATUS_LABELS[p.status] ?? p.status),
    escapeCSV(p.confidence?.replace(/_/g, " ") ?? ""),
    escapeCSV(p.sponsor ?? ""),
    escapeCSV(p.team ?? ""),
    escapeCSV(p.stakeholder ?? ""),
    escapeCSV(p.storyPoints?.toString() ?? ""),
    escapeCSV(p.cycle?.name ?? ""),
    escapeCSV(p.goals?.map((g) => g.name).join("; ") ?? ""),
    escapeCSV(p.latestUpdate?.content ?? ""),
    escapeCSV(p.startDate ?? ""),
    escapeCSV(p.endDate ?? ""),
  ]);

  const csvContent = [headers.map(escapeCSV), ...rows]
    .map((row) => row.join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportProjectsToPDF(projects: ProjectWithDetails[]) {
  const statusCounts: Record<string, number> = {};
  for (const p of projects) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
  }

  const rows = projects
    .map(
      (p) => `
    <tr>
      <td>${escapeHtml(p.title)}</td>
      <td>${escapeHtml(STATUS_LABELS[p.status] ?? p.status)}</td>
      <td>${escapeHtml(p.confidence?.replace(/_/g, " ") ?? "—")}</td>
      <td>${escapeHtml(p.sponsor ?? "—")}</td>
      <td>${escapeHtml(p.team ?? "—")}</td>
      <td>${escapeHtml(p.stakeholder ?? "—")}</td>
      <td>${p.storyPoints ?? "—"}</td>
      <td>${escapeHtml(p.cycle?.name ?? "Unscheduled")}</td>
      <td>${escapeHtml(p.goals?.map((g) => g.name).join(", ") ?? "—")}</td>
      <td>${escapeHtml(p.latestUpdate?.content ?? "—")}</td>
    </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Portfolio Export – ${new Date().toLocaleDateString()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #111; padding: 24px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: #555; margin-bottom: 20px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e293b; color: #fff; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    td:last-child { max-width: 200px; overflow: hidden; }
    @media print {
      body { padding: 0; }
      h1 { font-size: 16px; }
      th { background: #1e293b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr:nth-child(even) td { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>Portfolio Report</h1>
  <p class="subtitle">Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · ${projects.length} project${projects.length !== 1 ? "s" : ""}</p>
  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>Status</th>
        <th>Confidence</th>
        <th>Sponsor</th>
        <th>Team</th>
        <th>Stakeholder</th>
        <th>Points</th>
        <th>Cycle</th>
        <th>Goals</th>
        <th>Latest Update</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 300);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
