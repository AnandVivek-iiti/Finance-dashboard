import { Repeat } from "lucide-react";
import ChartCard from "./ChartCard.jsx";
import { EmptyNote } from "./MonthlyTrendChart.jsx";
import { formatRupeesShort, formatDate } from "../utils/format.js";

export default function RecurringPaymentsList({ data }) {
  const rows = data || [];

  return (
    <ChartCard title="Recurring Payments Detected" subtitle="Same payee, similar amount, ~monthly">
      {rows.length === 0 ? (
        <EmptyNote />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Repeat size={14} />
                </span>
                <div>
                  <p className="text-sm text-ink">{r.merchantOrCategory}</p>
                  <p className="text-xs text-ink-dim">
                    {r.occurrenceCount}x · last {formatDate(r.lastDate)}
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium text-ink">~{formatRupeesShort(r.avgAmountPaise)}/mo</span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
