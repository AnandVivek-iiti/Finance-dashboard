import { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import ChartCard from "./ChartCard.jsx";
import { formatMonth, formatRupeesShort } from "../utils/format.js";

const GRANULARITY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function getWeekKey(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

function getYearKey(dateStr) {
  return new Date(dateStr).getFullYear().toString();
}

function aggregateByGranularity(rows, granularity) {
  const groups = new Map();

  for (const row of rows) {
    let key;
    if (granularity === "yearly") {
      key = getYearKey(row.month + "-01");
    } else if (granularity === "weekly") {
      key = getWeekKey(row.month + "-01");
    } else {
      key = row.month;
    }

    if (!groups.has(key)) {
      groups.set(key, { key, spent: 0, received: 0 });
    }
    const g = groups.get(key);
    g.spent += row.Spent;
    g.received += row.Received;
  }

  return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function formatKey(key, granularity) {
  if (granularity === "yearly") return key;
  if (granularity === "weekly") {
    const d = new Date(key);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

export default function MonthlyTrendChart({ data, showValues = false }) {
  const [granularity, setGranularity] = useState("monthly");

  const rows = useMemo(() => {
    const baseRows = (data || []).map((r) => ({
      month: r.month,
      Spent: r.totalSpentPaise / 100,
      Received: r.totalReceivedPaise / 100,
    }));

    if (granularity === "monthly") {
      return baseRows.map((r) => ({
        ...r,
        label: formatMonth(r.month),
      }));
    }

    const aggregated = aggregateByGranularity(baseRows, granularity);
    return aggregated.map((r) => ({
      ...r,
      label: formatKey(r.key, granularity),
    }));
  }, [data, granularity]);

  const valueLabel = (color) => (showValues ? (
    <LabelList
      position="top"
      formatter={(v) => formatRupeesShort(v * 100)}
      style={{ fontSize: 9, fill: color, fontWeight: 600 }}
    />
  ) : null);

  return (
    <ChartCard
      title="Spend vs Income"
      subtitle={`${GRANULARITY_OPTIONS.find((g) => g.value === granularity).label} trend`}
      className="lg:col-span-2"
      chartKey="monthlySpendTrend"
      actions={
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value)}
          className="text-xs border border-border rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {GRANULARITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      }
    >
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ResponsiveContainer width="100%" height={showValues ? 290 : 260}>
          <ComposedChart data={rows} accessibilityLayer={false} margin={showValues ? { top: 20 } : undefined}>
            <CartesianGrid stroke="#e6e8ef" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => formatRupeesShort(v * 100)} />
            <Tooltip formatter={(v) => formatRupeesShort(v * 100)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Spent" fill="#e0483f" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={!showValues}>
              {valueLabel("#e0483f")}
            </Bar>
            <Bar dataKey="Received" fill="#0f9d67" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={!showValues}>
              {valueLabel("#0f9d67")}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function EmptyNote() {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-ink-dim">
      No data for the current filters.
    </div>
  );
}