import type { ProjectWithDetails } from "@workspace/api-client-react";
import { STATUS_LABELS } from "./constants";
import { formatConfidence } from "./utils";

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
    escapeCSV(p.confidence ? formatConfidence(p.confidence) : ""),
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

export interface PdfColumn {
  key: string;
  label: string;
  width: number;
  getValue: (p: ProjectWithDetails) => string;
}

export const PDF_COLUMNS: PdfColumn[] = [
  {
    key: "title",
    label: "Title",
    width: 17,
    getValue: (p) => p.title,
  },
  {
    key: "status",
    label: "Status",
    width: 8,
    getValue: (p) => STATUS_LABELS[p.status] ?? p.status,
  },
  {
    key: "confidence",
    label: "Confidence",
    width: 8,
    getValue: (p) => p.confidence ? formatConfidence(p.confidence) : "—",
  },
  {
    key: "sponsor",
    label: "Sponsor",
    width: 9,
    getValue: (p) => p.sponsor ?? "—",
  },
  {
    key: "team",
    label: "Team",
    width: 9,
    getValue: (p) => p.team ?? "—",
  },
  {
    key: "stakeholder",
    label: "Stakeholder",
    width: 9,
    getValue: (p) => p.stakeholder ?? "—",
  },
  {
    key: "storyPoints",
    label: "Points",
    width: 5,
    getValue: (p) => (p.storyPoints != null ? String(p.storyPoints) : "—"),
  },
  {
    key: "cycle",
    label: "Cycle",
    width: 8,
    getValue: (p) => p.cycle?.name ?? "Unscheduled",
  },
  {
    key: "goals",
    label: "Goals",
    width: 10,
    getValue: (p) => p.goals?.map((g) => g.name).join(", ") ?? "—",
  },
  {
    key: "latestUpdate",
    label: "Latest Update",
    width: 17,
    getValue: (p) => p.latestUpdate?.content ?? "—",
  },
];

export const DEFAULT_PDF_COLUMN_KEYS = PDF_COLUMNS.map((c) => c.key);

export function exportProjectsToPDF(
  projects: ProjectWithDetails[],
  selectedColumnKeys: string[] = DEFAULT_PDF_COLUMN_KEYS
) {
  const columnMap = new Map(PDF_COLUMNS.map((c) => [c.key, c]));
  const columns = selectedColumnKeys
    .map((k) => columnMap.get(k))
    .filter((c): c is PdfColumn => c !== undefined);

  if (columns.length === 0) return;

  const totalDefinedWidth = columns.reduce((sum, c) => sum + c.width, 0);

  const colWidths = columns.map(
    (c) => `${((c.width / totalDefinedWidth) * 100).toFixed(2)}%`
  );

  const colGroupHtml = columns
    .map((c, i) => `<col style="width:${colWidths[i]}" />`)
    .join("\n      ");

  const theadHtml = columns.map((c) => `<th>${c.label}</th>`).join("");

  const rows = projects
    .map((p) => {
      const cells = columns
        .map((c) => `<td>${escapeHtml(c.getValue(p))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("\n    ");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Portfolio Export – ${new Date().toLocaleDateString()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 10px; color: #111; padding: 24px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: #555; margin-bottom: 20px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { background: #1e293b; color: #fff; text-align: left; padding: 5px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
    tr:nth-child(even) td { background: #f8fafc; }
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
    <colgroup>
      ${colGroupHtml}
    </colgroup>
    <thead>
      <tr>${theadHtml}</tr>
    </thead>
    <tbody>
    ${rows}
    </tbody>
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
