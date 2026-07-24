import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatRupees, formatDate } from "./format.js";

const money = (paise) => (paise == null ? "unavailable" : formatRupees(paise, { decimals: 2 }));
const date = (d) => (d == null ? "" : formatDate(d));

const pdfSafe = (str) => String(str).replace(/₹/g, "Rs. ").replace(/Rs\. -/g, "-Rs. ");
const moneyPdf = (paise) => pdfSafe(money(paise));

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

function drawChartImage(doc, image, { marginX, usableWidth, pageHeight, y, label, subtitle }) {
  let displayWidth = usableWidth;
  let displayHeight = (image.height / image.width) * displayWidth;

  // A chart taller than a full fresh page would otherwise get silently
  // clipped at the page boundary instead of ever showing in full - cap it
  // to the tallest it could possibly be on its own page and scale the
  // width down to match, preserving aspect ratio.
  const maxHeightOnFreshPage = pageHeight - 46; // leaves room for title + subtitle + margins
  if (displayHeight > maxHeightOnFreshPage) {
    const ratio = maxHeightOnFreshPage / displayHeight;
    displayHeight = maxHeightOnFreshPage;
    displayWidth = displayWidth * ratio;
  }

  const headerHeight = (label ? 5 : 0) + (subtitle ? 4.5 : 0);
  if (y + headerHeight + displayHeight > pageHeight - 20) {
    doc.addPage();
    y = 18;
  }

  if (label) {
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(label, marginX, y);
    y += 5;
  }
  if (subtitle) {
    doc.setFontSize(8.5);
    doc.setTextColor(130);
    doc.text(subtitle, marginX, y);
    doc.setTextColor(0);
    y += 4.5;
  }

  doc.addImage(image.dataUrl, "PNG", marginX, y, displayWidth, displayHeight);
  return y + displayHeight + 9;
}

// Titles/subtitles mirroring exactly what's shown above each chart on the
// dashboard itself, so the PDF reads the same way the live page does.
const CHART_TITLES = {
  monthlySpendTrend: ["Monthly Spend vs Income", "Year-over-year / month-over-month trend"],
  balanceOverTime: ["Balance Over Time", "Running balance across every transaction"],
  spendByCategory: ["Spending by Category", "Top 10 categories by total amount"],
  dayOfWeekPattern: ["Spending by Day of Week", "Weekday vs weekend patterns"],
  cashVsDigitalSplit: ["Cash vs Digital Spending", "How money leaves the account"],
};

// Only these three row-level sections are shown on the dashboard's summary
// tab (as lists, not raw dumps) - the PDF summary export mirrors that,
// rather than including every transaction-level table.
const PDF_SUMMARY_LIST_KEYS = ["topMerchants", "recurringPayments", "largestExpenseCategoryPerMonth"];
const LIST_SECTION_META = {
  topMerchants: ["Top Merchants / Counterparties", "By total amount sent"],
  recurringPayments: ["Recurring Payments Detected", "Same payee, similar amount, ~monthly"],
  largestExpenseCategoryPerMonth: ["Biggest Expense Category, Per Month", "Where most of each month's spend went"],
};

function getKpiCards(metrics) {
  return [
    { label: "Total spent", value: moneyPdf(metrics.totalSpentPaise) },
    { label: "Total received", value: moneyPdf(metrics.totalReceivedPaise) },
    {
      label: "Net savings",
      value: moneyPdf(metrics.netSavingsPaise),
      sub: metrics.savingsRatePercent != null ? `${metrics.savingsRatePercent.toFixed(2)}% savings rate` : null,
    },
    { label: "Avg. monthly spend", value: moneyPdf(metrics.avgMonthlySpendPaise) },
    { label: "Avg. monthly income", value: moneyPdf(metrics.avgMonthlyIncomePaise) },
    {
      label: "Avg. yearly spend",
      value: metrics.avgYearlySpendPaise != null ? moneyPdf(metrics.avgYearlySpendPaise) : "N/A (under 1 year)",
    },
    {
      label: "Highest withdrawal",
      value: metrics.highestWithdrawal ? moneyPdf(metrics.highestWithdrawal.amountPaise) : "unavailable",
      sub: metrics.highestWithdrawal ? date(metrics.highestWithdrawal.date) : null,
    },
    {
      label: "Highest deposit",
      value: metrics.highestDeposit ? moneyPdf(metrics.highestDeposit.amountPaise) : "unavailable",
      sub: metrics.highestDeposit ? date(metrics.highestDeposit.date) : null,
    },
    {
      label: "Lowest balance point",
      value: metrics.lowestBalancePoint ? moneyPdf(metrics.lowestBalancePoint.balancePaise) : "unavailable",
      sub: metrics.lowestBalancePoint ? `${date(metrics.lowestBalancePoint.date)} - risk period` : null,
    },
    { label: "Avg. transaction size", value: moneyPdf(metrics.avgTransactionSizePaise) },
    { label: "Transactions counted", value: metrics.transactionCount?.toLocaleString("en-IN") ?? "0" },
  ];
}

function drawKpiCards(doc, cards, { marginX, usableWidth, pageHeight, y }) {
  const cols = 3;
  const gap = 4;
  const cardWidth = (usableWidth - gap * (cols - 1)) / cols;
  const cardHeight = 21;
  const rowGap = 4;

  for (let i = 0; i < cards.length; i += cols) {
    const row = cards.slice(i, i + cols);
    if (y + cardHeight > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
    row.forEach((card, col) => {
      const x = marginX + col * (cardWidth + gap);
      doc.setDrawColor(224, 226, 230);
      doc.setFillColor(248, 249, 251);
      doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, "FD");

      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(card.label, x + 3.5, y + 6.5, { maxWidth: cardWidth - 7 });

      doc.setFontSize(11.5);
      doc.setTextColor(20);
      doc.setFont(undefined, "bold");
      doc.text(String(card.value), x + 3.5, y + 13.5, { maxWidth: cardWidth - 7 });
      doc.setFont(undefined, "normal");

      if (card.sub) {
        doc.setFontSize(7);
        doc.setTextColor(140);
        doc.text(String(card.sub), x + 3.5, y + 18, { maxWidth: cardWidth - 7 });
      }
      doc.setTextColor(0);
    });
    y += cardHeight + rowGap;
  }
  return y;
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

  // Informational line only - date range + how many rows were excluded as
  // unreconciled. Everything else lives in the KPI cards below, matching
  // what's actually shown on the dashboard's summary tab.
  const metaBits = [];
  if (metrics.rangeStart && metrics.rangeEnd) {
    metaBits.push(`${date(metrics.rangeStart)} to ${date(metrics.rangeEnd)}`);
  }
  metaBits.push(`${metrics.unreconciledCount ?? 0} unreconciled row(s) excluded from totals`);
  doc.setFontSize(8.5);
  doc.setTextColor(130);
  doc.text(metaBits.join("   ·   "), marginX, y);
  doc.setTextColor(0);
  y += 7;

  if (Object.keys(chartImages).length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(150, 100, 0);
    doc.text("Charts couldn't be captured for this export - some sections below may be missing.", marginX, y);
    doc.setTextColor(0);
    y += 8;
  }

  // KPI cards - same numbers shown in the dashboard's summary cards.
  y = drawKpiCards(doc, getKpiCards(metrics), { marginX, usableWidth, pageHeight, y });
  y += 4;

  // Charts - in the same order they appear on the dashboard.
  for (const key of CHART_SECTION_KEYS) {
    const image = chartImages[key];
    if (!image) continue;
    const [chartTitle, chartSubtitle] = CHART_TITLES[key] || [humanizeKey(key), null];
    y = drawChartImage(doc, image, { marginX, usableWidth, pageHeight, y, label: chartTitle, subtitle: chartSubtitle });
  }

  // Summary lists - Top Merchants, Recurring Payments, Biggest Expense per
  // Month - the same three lists shown on the dashboard's summary tab.
  // Deliberately not including the raw per-row tables (every category, every
  // month, every balance point, every day) - this export is a summary,
  // not a transaction dump.
  for (const [key, , columns] of SECTIONS) {
    if (!PDF_SUMMARY_LIST_KEYS.includes(key)) continue;
    const table = sectionToTable(metrics?.[key], columns);
    if (!table) continue;

    const [listTitle, listSubtitle] = LIST_SECTION_META[key];
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 18;
    }
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(listTitle, marginX, y);
    y += 5;
    doc.setFontSize(8.5);
    doc.setTextColor(130);
    doc.text(listSubtitle, marginX, y);
    doc.setTextColor(0);
    y += 4;

    if (y > pageHeight - 30) {
      doc.addPage();
      y = 18;
    }
    autoTable(doc, {
      startY: y,
      head: [table.headers],
      body: table.rows.map((row) => row.map(pdfSafe)),
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: [30, 41, 59] },
    });
    y = doc.lastAutoTable.finalY + 8;
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