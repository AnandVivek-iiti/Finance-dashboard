import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatRupees, formatDate } from "./format.js";

const money = (paise) => (paise == null ? "unavailable" : formatRupees(paise, { decimals: 2 }));
const date = (d) => (d == null ? "" : formatDate(d));

function getSummaryRows(metrics) {
  const rows = [
    ["Transactions counted", metrics.transactionCount?.toLocaleString("en-IN") ?? "0"],
    ["Unreconciled rows excluded", String(metrics.unreconciledCount ?? 0)],
  ];

  if (metrics.rangeStart && metrics.rangeEnd) {
    rows.push(["Date range", `${date(metrics.rangeStart)} - ${date(metrics.rangeEnd)}`]);
  }

  rows.push(
    ["Total spent", money(metrics.totalSpentPaise)],
    ["Total received", money(metrics.totalReceivedPaise)],
    [
      "Net savings",
      `${money(metrics.netSavingsPaise)}${
        metrics.savingsRatePercent != null ? ` (${metrics.savingsRatePercent.toFixed(2)}% savings rate)` : ""
      }`,
    ],
    ["Avg. monthly spend", money(metrics.avgMonthlySpendPaise)],
    ["Avg. monthly income", money(metrics.avgMonthlyIncomePaise)],
    [
      "Avg. yearly spend",
      metrics.avgYearlySpendPaise != null ? money(metrics.avgYearlySpendPaise) : "N/A (under 1 year)",
    ],
    ["Avg. transaction size", money(metrics.avgTransactionSizePaise)],
    [
      "Highest withdrawal",
      metrics.highestWithdrawal
        ? `${money(metrics.highestWithdrawal.amountPaise)} on ${date(metrics.highestWithdrawal.date)}`
        : "unavailable",
    ],
    [
      "Highest deposit",
      metrics.highestDeposit
        ? `${money(metrics.highestDeposit.amountPaise)} on ${date(metrics.highestDeposit.date)}`
        : "unavailable",
    ],
    [
      "Lowest balance point",
      metrics.lowestBalancePoint
        ? `${money(metrics.lowestBalancePoint.balancePaise)} on ${date(metrics.lowestBalancePoint.date)} - risk period`
        : "unavailable",
    ]
  );

  if (metrics.cashVsDigitalSplit) {
    const { cashPaise = 0, digitalPaise = 0 } = metrics.cashVsDigitalSplit;
    const total = cashPaise + digitalPaise;
    const pct = (v) => (total > 0 ? ` (${((v / total) * 100).toFixed(1)}%)` : "");
    rows.push(
      ["Cash spend (ATM withdrawals)", `${money(cashPaise)}${pct(cashPaise)}`],
      ["Digital spend", `${money(digitalPaise)}${pct(digitalPaise)}`]
    );
  }

  return rows;
}

const SECTIONS = [
  [
    "spendByCategory",
    "Spend by Category",
    [
      ["category", "Category", (v) => v ?? "Uncategorized"],
      ["totalPaise", "Total spent", money],
      ["count", "Transactions", (v) => v ?? 0],
    ],
  ],
  [
    "monthlySpendTrend",
    "Monthly Spend & Income Trend",
    [
      ["month", "Month", (v) => v],
      ["totalSpentPaise", "Spent", money],
      ["totalReceivedPaise", "Received", money],
      ["transactionCount", "Transactions", (v) => v ?? 0],
    ],
  ],
  [
    "balanceOverTime",
    "Balance Over Time",
    [
      ["date", "Date", date],
      ["balancePaise", "Balance", money],
    ],
  ],
  [
    "dayOfWeekPattern",
    "Day-of-Week Pattern",
    [
      ["day", "Day", (v) => v],
      ["spentPaise", "Spent", money],
      ["count", "Transactions", (v) => v ?? 0],
    ],
  ],
  [
    "topMerchants",
    "Top Merchants",
    [
      ["merchant", "Merchant", (v) => v],
      ["totalPaise", "Total spent", money],
      ["count", "Transactions", (v) => v ?? 0],
    ],
  ],
  [
    "transactionsPerMonth",
    "Transactions per Month",
    [
      ["month", "Month", (v) => v],
      ["count", "Transactions", (v) => v ?? 0],
      ["avgTransactionSizePaise", "Avg. transaction size", money],
    ],
  ],
  [
    "recurringPayments",
    "Recurring Payments",
    [
      ["merchantOrCategory", "Merchant / Category", (v) => v],
      ["occurrenceCount", "Occurrences", (v) => v ?? 0],
      ["avgAmountPaise", "Avg. amount", money],
      ["lastDate", "Last seen", date],
    ],
  ],
  [
    "largestExpenseCategoryPerMonth",
    "Largest Expense Category per Month",
    [
      ["month", "Month", (v) => v],
      ["category", "Category", (v) => v ?? "Uncategorized"],
      ["totalPaise", "Amount", money],
    ],
  ],
];

export const CHART_SECTION_KEYS = [
  "monthlySpendTrend",
  "balanceOverTime",
  "spendByCategory",
  "dayOfWeekPattern",
  "cashVsDigitalSplit",
];

function sectionToTable(arr, columns) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return {
    headers: columns.map(([, label]) => label),
    rows: arr.map((item) => columns.map(([field, , format]) => String(format(item?.[field])))),
  };
}

function humanizeKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/Paise$/i, "")
    .replace(/Percent$/i, " %")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

const EXPLICITLY_HANDLED_KEYS = new Set([
  "empty",
  "transactionCount",
  "unreconciledCount",
  "rangeStart",
  "rangeEnd",
  "totalSpentPaise",
  "totalReceivedPaise",
  "netSavingsPaise",
  "savingsRatePercent",
  "avgMonthlySpendPaise",
  "avgMonthlyIncomePaise",
  "avgYearlySpendPaise",
  "avgTransactionSizePaise",
  "highestWithdrawal",
  "highestDeposit",
  "lowestBalancePoint",
  "cashVsDigitalSplit",
  ...SECTIONS.map(([key]) => key),
]);

function getFallbackSummaryRows(metrics) {
  return Object.entries(metrics)
    .filter(
      ([k, v]) =>
        !EXPLICITLY_HANDLED_KEYS.has(k) &&
        (typeof v === "number" || typeof v === "string" || typeof v === "boolean")
    )
    .map(([k, v]) => [humanizeKey(k), typeof v === "number" && /paise/i.test(k) ? money(v) : String(v)]);
}

function buildReportMeta({ title, bankLabel, statementCount }) {
  return {
    title: title || "Statement Report",
    bankLabel: bankLabel || "",
    statementCount: statementCount || 0,
    generated: new Date().toLocaleString("en-IN"),
  };
}

function slugify(str) {
  const s = (str || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return s || "report";
}

function metaSubtitle(meta) {
  return `${meta.bankLabel ? meta.bankLabel + " - " : ""}${meta.statementCount} statement${
    meta.statementCount === 1 ? "" : "s"
  } - generated ${meta.generated}`;
}

// Fits an image inside a box, preserving aspect ratio and centering it —
// used to lay multiple charts out on a single page instead of giving every
// chart its own full page.
function drawImageInBox(doc, image, { x, y, width, height }) {
  if (!image) return;
  const aspect = image.width / image.height;
  let w = width;
  let h = w / aspect;
  if (h > height) {
    h = height;
    w = h * aspect;
  }
  doc.addImage(image.dataUrl, "PNG", x + (width - w) / 2, y + (height - h) / 2, w, h);
}

function sectionColumns(key) {
  return SECTIONS.find(([k]) => k === key)?.[2];
}

export function downloadPdfReport({ metrics, title, bankLabel, statementCount, chartImages = {} }) {
  const meta = buildReportMeta({ title, bankLabel, statementCount });
  const doc = new jsPDF();
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - marginX * 2;
  let y = 18;

  doc.setFontSize(16);
  doc.text(meta.title, marginX, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(metaSubtitle(meta), marginX, y);
  doc.setTextColor(0);
  y += 8;

  if (!metrics || metrics.empty) {
    doc.setFontSize(11);
    doc.text("No transactions match the current filters / selected statement(s).", marginX, y);
    doc.save(`${slugify(meta.title)}-report.pdf`);
    return;
  }

  // ---- Page 1: the same KPI numbers shown on the dashboard's summary cards ----
  const summary = [...getSummaryRows(metrics), ...getFallbackSummaryRows(metrics)];
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: summary,
    margin: { left: marginX, right: marginX },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  // ---- Page 2: Monthly Spend vs Income + Balance Over Time ----
  doc.addPage();
  let py = 20;
  const chartGap = 14;
  const halfHeight = (pageHeight - py - 16 - chartGap) / 2 - 8;

  doc.setFontSize(13);
  doc.text("Monthly Spend vs Income", marginX, py);
  drawImageInBox(doc, chartImages.monthlySpendTrend, { x: marginX, y: py + 5, width: usableWidth, height: halfHeight });
  py += halfHeight + chartGap;

  doc.setFontSize(13);
  doc.text("Balance Over Time", marginX, py);
  drawImageInBox(doc, chartImages.balanceOverTime, { x: marginX, y: py + 5, width: usableWidth, height: halfHeight });

  // ---- Page 3: Category / Day-of-Week / Cash vs Digital + Top Merchants, 2x2 ----
  doc.addPage();
  const gap = 10;
  const colWidth = (usableWidth - gap) / 2;
  const gridTop = 20;
  const rowHeight = (pageHeight - gridTop - 16 - gap) / 2 - 10;
  const col2X = marginX + colWidth + gap;
  const row2Y = gridTop + rowHeight + gap + 10;

  doc.setFontSize(12);
  doc.text("Spending by Category", marginX, gridTop);
  drawImageInBox(doc, chartImages.spendByCategory, { x: marginX, y: gridTop + 5, width: colWidth, height: rowHeight });

  doc.text("Spending by Day of Week", col2X, gridTop);
  drawImageInBox(doc, chartImages.dayOfWeekPattern, { x: col2X, y: gridTop + 5, width: colWidth, height: rowHeight });

  doc.text("Cash vs Digital Spending", marginX, row2Y);
  drawImageInBox(doc, chartImages.cashVsDigitalSplit, { x: marginX, y: row2Y + 5, width: colWidth, height: rowHeight });

  doc.text("Top Merchants", col2X, row2Y);
  const merchantsTable = sectionToTable(metrics?.topMerchants, sectionColumns("topMerchants"));
  if (merchantsTable) {
    autoTable(doc, {
      startY: row2Y + 5,
      head: [merchantsTable.headers],
      body: merchantsTable.rows,
      margin: { left: col2X, right: pageWidth - (col2X + colWidth) },
      tableWidth: colWidth,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 41, 59] },
    });
  }

  // ---- Page 4: Recurring Payments + Largest Expense per Month ----
  doc.addPage();
  const p4Top = 20;

  doc.setFontSize(12);
  doc.text("Recurring Payments Detected", marginX, p4Top);
  const recurringTable = sectionToTable(metrics?.recurringPayments, sectionColumns("recurringPayments"));
  if (recurringTable) {
    autoTable(doc, {
      startY: p4Top + 5,
      head: [recurringTable.headers],
      body: recurringTable.rows,
      margin: { left: marginX, right: pageWidth - (marginX + colWidth) },
      tableWidth: colWidth,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59] },
    });
  }

  doc.text("Biggest Expense Category, Per Month", col2X, p4Top);
  const largestTable = sectionToTable(metrics?.largestExpenseCategoryPerMonth, sectionColumns("largestExpenseCategoryPerMonth"));
  if (largestTable) {
    autoTable(doc, {
      startY: p4Top + 5,
      head: [largestTable.headers],
      body: largestTable.rows,
      margin: { left: col2X, right: pageWidth - (col2X + colWidth) },
      tableWidth: colWidth,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59] },
    });
  }

  doc.save(`${slugify(meta.title)}-report.pdf`);
}

export function downloadXlsxReport({ metrics, title, bankLabel, statementCount }) {
  const meta = buildReportMeta({ title, bankLabel, statementCount });
  const wb = XLSX.utils.book_new();

  if (!metrics || metrics.empty) {
    const sheet = XLSX.utils.aoa_to_sheet([
      [meta.title],
      [metaSubtitle(meta)],
      [],
      ["No transactions match the current filters / selected statement(s)."],
    ]);
    XLSX.utils.book_append_sheet(wb, sheet, "Summary");
    XLSX.writeFile(wb, `${slugify(meta.title)}-report.xlsx`);
    return;
  }

  const summary = [...getSummaryRows(metrics), ...getFallbackSummaryRows(metrics)];
  const summarySheetData = [[meta.title], [metaSubtitle(meta)], [], ["Metric", "Value"], ...summary];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summarySheetData), "Summary");

  const usedNames = new Set(["Summary"]);
  for (const [key, label, columns] of SECTIONS) {
    const table = sectionToTable(metrics?.[key], columns);
    if (!table) continue;

    // Excel sheet names: max 31 chars, must be unique.
    let sheetName = label.slice(0, 31);
    let n = 2;
    while (usedNames.has(sheetName)) {
      sheetName = `${label.slice(0, 28)} ${n}`.slice(0, 31);
      n += 1;
    }
    usedNames.add(sheetName);

    const sheetData = [table.headers, ...table.rows];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheetData), sheetName);
  }

  XLSX.writeFile(wb, `${slugify(meta.title)}-report.xlsx`);
}