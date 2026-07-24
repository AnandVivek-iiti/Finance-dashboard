import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { EmptyNote } from "./MonthlyTrendChart.jsx";
import { formatRupeesShort } from "../utils/format.js";

export default function DayOfWeekChart({ data, showValues = false }) {
  const rows = (data || []).map((r) => ({
    day: r.day.slice(0, 3),
    amount: r.spentPaise / 100,
    count: r.count,
  }));

  const hasData = rows.some((r) => r.amount > 0);

  return (
    <ChartCard title="Spending by Day of Week" subtitle="Weekday vs weekend patterns" chartKey="dayOfWeekPattern">
      {!hasData ? (
        <EmptyNote />
      ) : (
        <ResponsiveContainer width="100%" height={showValues ? 250 : 220}>
          <BarChart data={rows} accessibilityLayer={false} margin={showValues ? { top: 20 } : undefined}>
            <CartesianGrid stroke="#e6e8ef" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => formatRupeesShort(v * 100)} />
            <Tooltip formatter={(v, n, props) => [formatRupeesShort(v * 100), `${props.payload.count} txns`]} />
            <Bar dataKey="amount" fill="#3661f0" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={!showValues}>
              {showValues && (
                <LabelList
                  dataKey="amount"
                  position="top"
                  formatter={(v) => formatRupeesShort(v * 100)}
                  style={{ fontSize: 9, fill: "#171b2b", fontWeight: 600 }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}