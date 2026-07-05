import { useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Pencil, Check, X, AlertTriangle } from "lucide-react";
import { fetchTransactions, updateTransactionCategory } from "../utils/api.js";
import { formatRupees, formatDate } from "../utils/format.js";

export default function TransactionsTable({ selectedStatementIds, filters }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const limit = 25;

  useEffect(() => {
    if (!selectedStatementIds.length) return;
    setLoading(true);
    fetchTransactions({
      statementIds: selectedStatementIds.join(","),
      ...filters,
      search: search || undefined,
      page,
      limit,
      sortBy,
      sortDir,
    })
      .then((data) => {
        setRows(data.transactions);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [selectedStatementIds, filters, search, page, sortBy, sortDir]);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  };

  const startEdit = (t) => {
    setEditingId(t._id);
    setEditValue(t.category);
  };

  const saveEdit = async (t) => {
    const updated = await updateTransactionCategory(t._id, editValue);
    setRows((prev) => prev.map((r) => (r._id === t._id ? updated : r)));
    setEditingId(null);
  };

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return (
    <div className="card flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-ink">Transactions</h3>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search remarks…"
            className="w-56 rounded-md border border-border py-1.5 pl-8 pr-2.5 text-sm text-ink"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-dim">
              <Th label="Date" field="date" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <th className="py-2 pr-3 font-medium">Remarks</th>
              <th className="py-2 pr-3 font-medium">Category</th>
              <Th label="Withdrawal" field="withdrawalPaise" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
              <Th label="Deposit" field="depositPaise" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
              <Th label="Balance" field="balancePaise" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink-dim">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink-dim">
                  No transactions match.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t._id} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap py-2 pr-3 text-ink-muted">{formatDate(t.date)}</td>
                  <td className="max-w-[280px] truncate py-2 pr-3 text-ink" title={t.remarks}>
                    <span className="inline-flex items-center gap-1.5">
                      {!t.reconciled && (
                        <AlertTriangle size={12} className="shrink-0 text-warn" title="Excluded from totals — unverifiable" />
                      )}
                      {t.remarks}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {editingId === t._id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-32 rounded border border-border px-1.5 py-0.5 text-xs"
                          autoFocus
                        />
                        <button onClick={() => saveEdit(t)} className="text-positive">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-ink-dim">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(t)}
                        className="group flex items-center gap-1.5 rounded-full bg-canvas px-2 py-0.5 text-xs text-ink-muted hover:bg-accent-soft hover:text-accent"
                      >
                        {t.category}
                        <Pencil size={10} className="opacity-0 group-hover:opacity-100" />
                      </button>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right text-negative">
                    {t.withdrawalPaise !== null ? formatRupees(t.withdrawalPaise, { decimals: 2 }) : ""}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right text-positive">
                    {t.depositPaise !== null ? formatRupees(t.depositPaise, { decimals: 2 }) : ""}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right text-ink-muted">
                    {formatRupees(t.balancePaise, { decimals: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-ink-dim">
        <span>{total.toLocaleString("en-IN")} total transactions</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
            className="rounded p-1 hover:bg-canvas disabled:opacity-30"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="rounded p-1 hover:bg-canvas disabled:opacity-30"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Th({ label, field, sortBy, sortDir, onSort, align = "left" }) {
  const active = sortBy === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`cursor-pointer py-2 pr-3 font-medium ${align === "right" ? "text-right" : "text-left"} ${
        active ? "text-accent" : ""
      }`}
    >
      {label} {active ? (sortDir === "asc" ? "▲" : "▼") : ""}
    </th>
  );
}
