import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { EmptyNote } from "./MonthlyTrendChart.jsx";
import { formatDate, formatRupeesShort } from "../utils/format.js";

// A statement can have hundreds of transactions, so labeling every point on
// this line would be unreadable in a static PDF. Instead we call out the
// three points that actually matter: where the balance started, its peak,
// and where it ended up.
function pickKeyPoints(rows) {
  if (rows.length === 0) return new Set();
  let peakIdx = 0;
  rows.forEach((r, i) => {
    if (r.balance > rows[peakIdx].balance) peakIdx = i;
  });
  return new Set([0, peakIdx, rows.length - 1]);
}

function KeyPointDot({ cx, cy, index, keyIndices, value }) {
  if (!keyIndices.has(index)) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill="#3661f0" stroke="#fff" strokeWidth={1.5} />
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fill="#171b2b" fontWeight={600}>
        {formatRupeesShort(value * 100)}
      </text>
    </g>
  );
}

export default function BalanceTrendChart({ data, showValues = false }) {
  const rows = (data || []).map((r) => ({
    date: formatDate(r.date),
    balance: r.balancePaise / 100,
  }));
  const keyIndices = showValues ? pickKeyPoints(rows) : new Set();

  return (
    <ChartCard
      title="Balance Over Time"
      subtitle="Running balance across every transaction"
      className="lg:col-span-2"
      chartKey="balanceOverTime"
    >
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rows} accessibilityLayer={false} margin={showValues ? { top: 24 } : undefined}>
            <CartesianGrid stroke="#e6e8ef" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} minTickGap={40} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} tickFormatter={(v) => formatRupeesShort(v * 100)} />
            <Tooltip formatter={(v) => formatRupeesShort(v * 100)} />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#3661f0"
              strokeWidth={2}
              dot={showValues ? (props) => <KeyPointDot key={props.index} {...props} keyIndices={keyIndices} /> : false}
              isAnimationActive={!showValues}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}