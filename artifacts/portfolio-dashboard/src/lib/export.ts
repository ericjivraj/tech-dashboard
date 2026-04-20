import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ProjectWithDetails } from "@workspace/api-client-react";
import { STATUS_LABELS } from "./constants";
import { formatConfidence, storyPointsToTShirt } from "./utils";

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
    "Sizing",
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
    escapeCSV(p.storyPoints != null ? storyPointsToTShirt(p.storyPoints).label : ""),
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
    key: "size",
    label: "Sizing",
    width: 6,
    getValue: (p) => (p.storyPoints != null ? storyPointsToTShirt(p.storyPoints).label : "—"),
  },
  {
    key: "cycle",
    label: "Cycle",
    width: 13,
    getValue: (p) => {
      if (!p.cycle) return "Unscheduled";
      if (p.cycle.startDate && p.cycle.endDate) {
        return `${p.cycle.name}: ${shortDate(p.cycle.startDate)} – ${shortDate(p.cycle.endDate, true)}`;
      }
      return p.cycle.name;
    },
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

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 28;
  const tableWidth = pageWidth - marginX * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Technology Report", marginX, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  const subtitle = `Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}  ·  ${projects.length} project${projects.length !== 1 ? "s" : ""}`;
  doc.text(subtitle, marginX, 52);
  doc.setTextColor(0);

  const head = [columns.map((c) => c.label.toUpperCase())];
  const body = projects.map((p) => columns.map((c) => c.getValue(p)));

  const columnStyles: Record<number, { cellWidth: number }> = {};
  columns.forEach((c, i) => {
    columnStyles[i] = { cellWidth: (c.width / totalDefinedWidth) * tableWidth };
  });

  autoTable(doc, {
    head,
    body,
    startY: 62,
    margin: { left: marginX, right: marginX },
    columnStyles,
    tableWidth,
    styles: {
      fontSize: 8,
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
      valign: "top",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data: { pageNumber: number }) => {
      const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - marginX,
        doc.internal.pageSize.getHeight() - 14,
        { align: "right" }
      );
      doc.setTextColor(0);
    },
  });

  const date = new Date().toISOString().split("T")[0];
  doc.save(`tech-${date}.pdf`);
}

function shortDate(dateStr: string, includeYear = false): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  return includeYear
    ? `${month} ${day}, ${d.getFullYear()}`
    : `${month} ${day}`;
}

function ordinalDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? "st" :
    day % 10 === 2 && day !== 12 ? "nd" :
    day % 10 === 3 && day !== 13 ? "rd" : "th";
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  return `${day}${suffix} of ${month}`;
}

