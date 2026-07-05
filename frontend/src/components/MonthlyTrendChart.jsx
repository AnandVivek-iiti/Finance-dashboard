import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { formatMonth, formatRupeesShort } from "../utils/format.js";

export default function MonthlyTrendChart({ data }) {
  const rows = (data || []).map((r) => ({
    month: formatMonth(r.month),
    Spent: r.totalSpentPaise / 100,
    Received: r.totalReceivedPaise / 100,
  }));

  return (
    <ChartCard title="Monthly Spend vs Income" subtitle="Year-over-year / month-over-month trend" className="lg:col-span-2">
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={rows}>
            <CartesianGrid stroke="#e6e8ef" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => formatRupeesShort(v * 100)} />
            <Tooltip formatter={(v) => formatRupeesShort(v * 100)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Spent" fill="#e0483f" radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Bar dataKey="Received" fill="#0f9d67" radius={[3, 3, 0, 0]} maxBarSize={26} />
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
