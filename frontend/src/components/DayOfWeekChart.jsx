import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { EmptyNote } from "./MonthlyTrendChart.jsx";
import { formatRupeesShort } from "../utils/format.js";

export default function DayOfWeekChart({ data }) {
  const rows = (data || []).map((r) => ({
    day: r.day.slice(0, 3),
    amount: r.spentPaise / 100,
    count: r.count,
  }));

  const hasData = rows.some((r) => r.amount > 0);

  return (
    <ChartCard title="Spending by Day of Week" subtitle="Weekday vs weekend patterns">
      {!hasData ? (
        <EmptyNote />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows}>
            <CartesianGrid stroke="#e6e8ef" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => formatRupeesShort(v * 100)} />
            <Tooltip formatter={(v, n, props) => [formatRupeesShort(v * 100), `${props.payload.count} txns`]} />
            <Bar dataKey="amount" fill="#3661f0" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
