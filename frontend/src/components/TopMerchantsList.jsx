import ChartCard from "./ChartCard.jsx";
import { EmptyNote } from "./MonthlyTrendChart.jsx";
import { formatRupeesShort } from "../utils/format.js";

export default function TopMerchantsList({ data }) {
  const rows = data || [];
  const max = rows[0]?.totalPaise || 1;

  return (
    <ChartCard title="Top Merchants / Counterparties" subtitle="By total amount sent">
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((m, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-xs text-ink-dim">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm text-ink">{m.merchant}</span>
                  <span className="shrink-0 text-sm font-medium text-ink">{formatRupeesShort(m.totalPaise)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-canvas">
                  <div
                    className="h-1.5 rounded-full bg-accent"
                    style={{ width: `${Math.max((m.totalPaise / max) * 100, 4)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
