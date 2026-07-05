import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { EmptyNote } from "./MonthlyTrendChart.jsx";
import { formatDate, formatRupeesShort } from "../utils/format.js";

export default function BalanceTrendChart({ data }) {
  const rows = (data || []).map((r) => ({
    date: formatDate(r.date),
    balance: r.balancePaise / 100,
  }));

  return (
    <ChartCard title="Balance Over Time" subtitle="Running balance across every transaction" className="lg:col-span-2">
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rows}>
            <CartesianGrid stroke="#e6e8ef" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => formatRupeesShort(v * 100)} />
            <Tooltip formatter={(v) => formatRupeesShort(v * 100)} />
            <Line type="monotone" dataKey="balance" stroke="#3661f0" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
