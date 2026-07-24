import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { EmptyNote } from "./MonthlyTrendChart.jsx";
import { formatRupeesShort } from "../utils/format.js";

const COLORS = ["#3661f0", "#0f9d67"];

function renderSliceLabel({ name, value, percent }) {
  return `${name}: ${formatRupeesShort(value * 100)} (${(percent * 100).toFixed(0)}%)`;
}

export default function CashVsDigitalChart({ data, showValues = false }) {
  const rows = [
    { name: "Digital (UPI/NEFT/Card)", value: (data?.digitalPaise || 0) / 100 },
    { name: "Cash (ATM)", value: (data?.cashPaise || 0) / 100 },
  ].filter((r) => r.value > 0);

  return (
    <ChartCard title="Cash vs Digital Spending" subtitle="How money leaves the account" chartKey="cashVsDigitalSplit">
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ResponsiveContainer width="100%" height={showValues ? 260 : 220}>
          <PieChart accessibilityLayer={false}>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              label={showValues ? renderSliceLabel : false}
              labelLine={showValues}
              isAnimationActive={!showValues}
            >
              {rows.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatRupeesShort(v * 100)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}