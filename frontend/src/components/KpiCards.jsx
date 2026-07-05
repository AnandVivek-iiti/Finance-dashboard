import { formatRupees, formatDate } from "../utils/format.js";

function Card({ label, value, sub, tone = "default" }) {
  const toneClass = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : tone === "warn" ? "text-warn" : "text-ink";

  return (
    <div className="card flex flex-col gap-2 px-5 py-4">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={`font-mono text-xl font-semibold ${toneClass}`}>{value}</span>
      {sub && <span className="text-[11.5px] text-ink-dim">{sub}</span>}
    </div>
  );
}

export default function KpiCards({ metrics, loading }) {
  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 11 }).map((_, i) => (
          <div key={i} className="card h-[92px] animate-pulse bg-border/40" />
        ))}
      </div>
    );
  }

  if (metrics.empty) {
    return (
      <div className="card px-5 py-8 text-center text-sm text-ink-muted">
        No transactions match the current filters.
      </div>
    );
  }

  const netTone = metrics.netSavingsPaise >= 0 ? "positive" : "negative";

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Card label="Total spent" value={formatRupees(metrics.totalSpentPaise, { decimals: 2 })} tone="negative" />
      <Card label="Total received" value={formatRupees(metrics.totalReceivedPaise, { decimals: 2 })} tone="positive" />
      <Card
        label="Net savings"
        value={formatRupees(metrics.netSavingsPaise, { decimals: 2 })}
        sub={metrics.savingsRatePercent != null ? `${metrics.savingsRatePercent.toFixed(2)}% savings rate` : "unavailable"}
        tone={netTone}
      />
      <Card label="Avg. monthly spend" value={formatRupees(metrics.avgMonthlySpendPaise, { decimals: 2 })} tone="negative" />
      <Card label="Avg. monthly income" value={formatRupees(metrics.avgMonthlyIncomePaise, { decimals: 2 })} tone="positive" />
      <Card
        label="Avg. yearly spend"
        value={metrics.avgYearlySpendPaise != null ? formatRupees(metrics.avgYearlySpendPaise, { decimals: 2 }) : "N/A (under 1 year)"}
        tone="negative"
      />
      <Card
        label="Highest withdrawal"
        value={metrics.highestWithdrawal ? formatRupees(metrics.highestWithdrawal.amountPaise, { decimals: 2 }) : "unavailable"}
        sub={metrics.highestWithdrawal ? formatDate(metrics.highestWithdrawal.date) : null}
        tone="negative"
      />
      <Card
        label="Highest deposit"
        value={metrics.highestDeposit ? formatRupees(metrics.highestDeposit.amountPaise, { decimals: 2 }) : "unavailable"}
        sub={metrics.highestDeposit ? formatDate(metrics.highestDeposit.date) : null}
        tone="positive"
      />
      <Card
        label="Lowest balance point"
        value={metrics.lowestBalancePoint ? formatRupees(metrics.lowestBalancePoint.balancePaise, { decimals: 2 }) : "unavailable"}
        sub={metrics.lowestBalancePoint ? `on ${formatDate(metrics.lowestBalancePoint.date)} — risk period` : null}
        tone="warn"
      />
      <Card
        label="Avg. transaction size"
        value={metrics.avgTransactionSizePaise != null ? formatRupees(metrics.avgTransactionSizePaise, { decimals: 2 }) : "unavailable"}
      />
      <Card label="Transactions counted" value={metrics.transactionCount.toLocaleString("en-IN")} />
    </div>
  );
}