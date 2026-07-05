import { useEffect, useState } from "react";
import { fetchCategories } from "../utils/api.js";

export default function FilterBar({ selectedStatementIds, filters, setFilters }) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (!selectedStatementIds.length) return;
    fetchCategories({ statementIds: selectedStatementIds.join(",") }).then(setCategories);
  }, [selectedStatementIds]);

  const update = (key, value) => setFilters((prev) => ({ ...prev, [key]: value || undefined }));

  const clearAll = () => setFilters({});

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
      <label className="flex flex-col gap-1 text-xs text-ink-dim">
        From
        <input
          type="date"
          value={filters.startDate || ""}
          onChange={(e) => update("startDate", e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink-dim">
        To
        <input
          type="date"
          value={filters.endDate || ""}
          onChange={(e) => update("endDate", e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink-dim">
        Category
        <select
          value={filters.category || ""}
          onChange={(e) => update("category", e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm text-ink"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink-dim">
        Type
        <select
          value={filters.type || ""}
          onChange={(e) => update("type", e.target.value)}
          className="rounded-md border border-border px-2 py-1.5 text-sm text-ink"
        >
          <option value="">Debit + Credit</option>
          <option value="debit">Debit only</option>
          <option value="credit">Credit only</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink-dim">
        Min ₹
        <input
          type="number"
          placeholder="0"
          value={filters.minAmount || ""}
          onChange={(e) => update("minAmount", e.target.value)}
          className="w-24 rounded-md border border-border px-2 py-1.5 text-sm text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink-dim">
        Max ₹
        <input
          type="number"
          placeholder="Any"
          value={filters.maxAmount || ""}
          onChange={(e) => update("maxAmount", e.target.value)}
          className="w-24 rounded-md border border-border px-2 py-1.5 text-sm text-ink"
        />
      </label>

      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="ml-auto self-end rounded-md border border-negative/30 bg-negative-soft px-3 py-1.5 text-xs font-medium text-negative"
        >
          Clear filters ({activeCount})
        </button>
      )}
    </div>
  );
}
