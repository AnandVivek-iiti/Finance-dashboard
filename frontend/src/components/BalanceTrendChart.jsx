import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { EmptyNote } from "./MonthlyTrendChart.jsx";
import { formatDate, formatRupeesShort } from "../utils/format.js";

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function formatDateForGranularity(date, granularity) {
  const d = new Date(date);
  switch (granularity) {
    case "yearly":
      return d.getFullYear().toString();
    case "monthly":
      return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    case "weekly":
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    default:
      return formatDate(date);
  }
}

function aggregateBalanceByGranularity(rows, granularity) {
  const groups = new Map();
  
  for (const row of rows) {
    const d = new Date(row.date);
    let key;
    
    switch (granularity) {
      case "yearly":
        key = d.getFullYear().toString();
        break;
      case "monthly":
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        break;
      case "weekly":
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().split("T")[0];
        break;
      default:
        key = d.toISOString().split("T")[0];
    }
    
    if (!groups.has(key)) {
      groups.set(key, { date: row.date, balances: [] });
    }
    groups.get(key).balances.push(row.balance);
  }
  
  const result = [];
  for (const [key, group] of groups.entries()) {
    const lastBalance = group.balances[group.balances.length - 1];
    result.push({
      date: group.date,
      balance: lastBalance,
      key,
    });
  }
  
  return result.sort((a, b) => new Date(a.date) - new Date(b.date));
}

export default function BalanceTrendChart({ data, showValues = false }) {
  const [granularity, setGranularity] = useState("monthly");
  
  const rows = useMemo(() => {
    const baseRows = (data || []).map((r) => ({
      date: r.date,
      balance: r.balancePaise / 100,
    }));
    
    if (granularity !== "daily") {
      return aggregateBalanceByGranularity(baseRows, granularity);
    }
    return baseRows;
  }, [data, granularity]);

  const formattedRows = useMemo(() => 
    rows.map((r) => ({
      ...r,
      formattedDate: formatDateForGranularity(r.date, granularity),
    })), [rows, granularity]);

  return (
    <ChartCard
      title="Balance Over Time"
      subtitle={`Running balance (${GRANULARITY_OPTIONS.find(g => g.value === granularity).label})`}
      className="lg:col-span-2"
      chartKey="balanceOverTime"
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
      {formattedRows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={formattedRows} accessibilityLayer={false} margin={showValues ? { top: 24 } : undefined}>
            <CartesianGrid stroke="#e6e8ef" vertical={false} />
            <XAxis 
              dataKey="formattedDate" 
              tick={{ fontSize: 10, fill: "#6b7280" }} 
              minTickGap={40} 
            />
            <YAxis 
              tick={{ fontSize: 11, fill: "#6b7280" }} 
              tickFormatter={(v) => formatRupeesShort(v * 100)} 
            />
            <Tooltip 
              formatter={(v) => formatRupeesShort(v * 100)}
              labelFormatter={(label) => label}
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#3661f0"
              strokeWidth={2}
              dot={false}
              isAnimationActive={!showValues}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}