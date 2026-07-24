import { useState, useRef } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { captureChartsByKey, waitForPaint } from "../utils/chartCapture.js";
import { CHART_SECTION_KEYS } from "../utils/reportGenerators.js";
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
import UserMenu from "../components/UserMenu.jsx";
import ReportDownloadMenu from "../components/ReportDownloadMenu.jsx";
import useMetrics from "../hooks/useMetrics.js";
import { formatBankName } from "../utils/format.js";

export default function DashboardPage({
  statements,
  selectedIds,
  setSelectedIds,
  onUploadNew,
  onDeleteStatement,
  user,
  onLogout,
}) {
  const [filters, setFilters] = useState({});
  const [tab, setTab] = useState("summary");
  const [exportMode, setExportMode] = useState(false);
  const chartsGridRef = useRef(null);
  const { metrics, loading } = useMetrics(selectedIds, filters);

  const captureChartsForExport = async () => {
    const previousTab = tab;
    const hadToSwitchTab = previousTab !== "summary";

    flushSync(() => {
      setTab("summary");
      setExportMode(true);
    });

    try {
      if (hadToSwitchTab) {
        await new Promise((resolve) => setTimeout(resolve, 1600));
      }
      await waitForPaint(3);
      return await captureChartsByKey(chartsGridRef.current, CHART_SECTION_KEYS);
    } finally {
      flushSync(() => {
        setExportMode(false);
        if (hadToSwitchTab) setTab(previousTab);
      });
    }
  };

  const selectedStatements = statements.filter((s) => selectedIds.includes(s._id));
  const primary = selectedStatements[0];
  const title = selectedStatements.map((s) => s.filename).join(" + ") || "Statements";
  const bankLabel = formatBankName(primary?.bankProfile);

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <header className="border-b border-border bg-surface px-4 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={onUploadNew}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink shadow-card"
            >
              <ArrowLeft size={15} /> Statements
            </button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-base font-bold text-ink">{title}</h1>
              <div className="truncate text-xs text-ink-muted">
                {bankLabel} · {selectedStatements.length} statement{selectedStatements.length === 1 ? "" : "s"}
                {selectedStatements.length > 1 ? " combined" : ""}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-medium sm:px-3.5 sm:py-2 sm:text-sm ${
                  tab === "summary" ? "bg-accent text-white" : "border border-border bg-surface text-ink"
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setTab("transactions")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium sm:px-3.5 sm:py-2 sm:text-sm ${
                  tab === "transactions" ? "bg-accent text-white" : "border border-border bg-surface text-ink"
                }`}
              >
                Transactions
              </button>
            </div>
            <ReportDownloadMenu
              metrics={metrics}
              title={title}
              bankLabel={bankLabel}
              statementCount={selectedStatements.length}
              disabled={loading || !metrics}
              onCaptureCharts={captureChartsForExport}
            />
            <UserMenu user={user} onLogout={onLogout} />
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

            <div ref={chartsGridRef} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <MonthlyTrendChart data={metrics?.monthlySpendTrend} showValues={exportMode} />
              <BalanceTrendChart data={metrics?.balanceOverTime} showValues={exportMode} />
              <CategoryBreakdownChart data={metrics?.spendByCategory} showValues={exportMode} />
              <DayOfWeekChart data={metrics?.dayOfWeekPattern} showValues={exportMode} />
              <CashVsDigitalChart data={metrics?.cashVsDigitalSplit} showValues={exportMode} />
              <TopMerchantsList data={metrics?.topMerchants} />
              <RecurringPaymentsList data={metrics?.recurringPayments} />
              <LargestExpenseByMonth data={metrics?.largestExpenseCategoryPerMonth} />
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <TransactionsTable selectedStatementIds={selectedIds} filters={filters} />
          </div>
        )}
      </main>
    </div>
  );
}