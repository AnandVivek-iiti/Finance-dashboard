import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { EmptyNote } from "./MonthlyTrendChart.jsx";
import { formatRupeesShort } from "../utils/format.js";

const PALETTE = ["#3661f0", "#0f9d67", "#e0483f", "#b7791f", "#8b5cf6", "#0ea5e9", "#f97316", "#14b8a6"];

export default function CategoryBreakdownChart({ data }) {
  const rows = (data || []).slice(0, 10).map((r) => ({
    category: r.category,
    amount: r.totalPaise / 100,
    count: r.count,
  }));

  return (
    <ChartCard title="Spending by Category" subtitle="Top 10 categories by total amount">
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid stroke="#e6e8ef" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} tickFormatter={(v) => formatRupeesShort(v * 100)} />
            <YAxis type="category" dataKey="category" width={140} tick={{ fontSize: 11, fill: "#171b2b" }} />
            <Tooltip
              formatter={(v, name, props) => [formatRupeesShort(v * 100), `${props.payload.count} txns`]}
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {rows.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
