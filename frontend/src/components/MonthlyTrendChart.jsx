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

export default function MonthlyTrendChart({ data, showValues = false }) {
  const rows = (data || []).map((r) => ({
    month: formatMonth(r.month),
    Spent: r.totalSpentPaise / 100,
    Received: r.totalReceivedPaise / 100,
  }));

  const valueLabel = (color) => (showValues ? (
    <LabelList
      position="top"
      formatter={(v) => formatRupeesShort(v * 100)}
      style={{ fontSize: 9, fill: color, fontWeight: 600 }}
    />
  ) : null);

  return (
    <ChartCard
      title="Monthly Spend vs Income"
      subtitle="Year-over-year / month-over-month trend"
      className="lg:col-span-2"
      chartKey="monthlySpendTrend"
    >
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ResponsiveContainer width="100%" height={showValues ? 290 : 260}>
          <ComposedChart data={rows} accessibilityLayer={false} margin={showValues ? { top: 20 } : undefined}>
            <CartesianGrid stroke="#e6e8ef" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
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