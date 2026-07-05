import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import StatementSwitcher from "../components/StatementSwitcher.jsx";
import ContinuityBanner from "../components/ContinuityBanner.jsx";
import ParseErrorsPanel from "../components/ParseErrorsPanel.jsx";
import FilterBar from "../components/FilterBar.jsx";
import KpiCards from "../components/KpiCards.jsx";
import MonthlyTrendChart from "../components/MonthlyTrendChart.jsx";
import BalanceTrendChart from "../components/BalanceTrendChart.jsx";
import CategoryBreakdownChart from "../components/CategoryBreakdownChart.jsx";
import DayOfWeekChart from "../components/DayOfWeekChart.jsx";
import CashVsDigitalChart from "../components/CashVsDigitalChart.jsx";
import TopMerchantsList from "../components/TopMerchantsList.jsx";
import RecurringPaymentsList from "../components/RecurringPaymentsList.jsx";
import LargestExpenseByMonth from "../components/LargestExpenseByMonth.jsx";
import TransactionsTable from "../components/TransactionsTable.jsx";
import useMetrics from "../hooks/useMetrics.js";
import { formatBankName } from "../utils/format.js";

export default function DashboardPage({ statements, selectedIds, setSelectedIds, onUploadNew, onDeleteStatement }) {
  const [filters, setFilters] = useState({});
  const [tab, setTab] = useState("summary"); // "summary" | "transactions"
  const { metrics, loading } = useMetrics(selectedIds, filters);

  const selectedStatements = statements.filter((s) => selectedIds.includes(s._id));
  const primary = selectedStatements[0];
  const title = selectedStatements.map((s) => s.filename).join(" + ") || "Statements";
  const bankLabel = formatBankName(primary?.bankProfile);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <header className="border-b border-border bg-surface px-4 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onUploadNew}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink shadow-card"
            >
              <ArrowLeft size={15} /> Statements
            </button>
            <div>
              <h1 className="font-display text-base font-bold text-ink">{title}</h1>
              <div className="text-xs text-ink-muted">
                {bankLabel} · {selectedStatements.length} statement{selectedStatements.length === 1 ? "" : "s"}
                {selectedStatements.length > 1 ? " combined" : ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatementSwitcher
              statements={statements}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onUploadNew={onUploadNew}
              onDeleteStatement={onDeleteStatement}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setTab("summary")}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium ${
                  tab === "summary" ? "bg-accent text-white" : "border border-border bg-surface text-ink"
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setTab("transactions")}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium ${
                  tab === "transactions" ? "bg-accent text-white" : "border border-border bg-surface text-ink"
                }`}
              >
                Transactions
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-6 lg:px-8">
        <ContinuityBanner statements={statements} selectedIds={selectedIds} />
        <ParseErrorsPanel statements={statements} selectedIds={selectedIds} />

        <FilterBar selectedStatementIds={selectedIds} filters={filters} setFilters={setFilters} />

        {tab === "summary" ? (
          <>
            <KpiCards metrics={metrics} loading={loading} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <MonthlyTrendChart data={metrics?.monthlySpendTrend} />
              <BalanceTrendChart data={metrics?.balanceOverTime} />
              <CategoryBreakdownChart data={metrics?.spendByCategory} />
              <DayOfWeekChart data={metrics?.dayOfWeekPattern} />
              <CashVsDigitalChart data={metrics?.cashVsDigitalSplit} />
              <TopMerchantsList data={metrics?.topMerchants} />
              <RecurringPaymentsList data={metrics?.recurringPayments} />
              <LargestExpenseByMonth data={metrics?.largestExpenseCategoryPerMonth} />
            </div>
          </>
        ) : (
          <TransactionsTable selectedStatementIds={selectedIds} filters={filters} />
        )}
      </main>
    </div>
  );
}