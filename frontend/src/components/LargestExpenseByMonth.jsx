import ChartCard from "./ChartCard.jsx";
import { EmptyNote } from "./MonthlyTrendChart.jsx";
import { formatMonth, formatRupeesShort } from "../utils/format.js";

export default function LargestExpenseByMonth({ data }) {
  const rows = data || [];

  return (
    <ChartCard title="Biggest Expense Category, Per Month" subtitle="Where most of each month's spend went">
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink-muted">{formatMonth(r.month)}</span>
              <span className="text-ink">{r.category}</span>
              <span className="font-medium text-ink">{formatRupeesShort(r.totalPaise)}</span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
