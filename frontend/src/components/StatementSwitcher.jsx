import { useState } from "react";
import { ChevronDown, Trash2, Plus, FileSpreadsheet, FileText } from "lucide-react";
import { formatDate } from "../utils/format.js";

export default function StatementSwitcher({ statements, selectedIds, setSelectedIds, onUploadNew, onDeleteStatement }) {
  const [open, setOpen] = useState(false);

  const toggle = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const label =
    selectedIds.length === 1
      ? statements.find((s) => s._id === selectedIds[0])?.filename || "1 statement"
      : `${selectedIds.length} statements combined`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-ink shadow-card"
      >
        <span className="max-w-[220px] truncate">{label}</span>
        <ChevronDown size={15} className="text-ink-dim" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-30 w-80 rounded-xl border border-border bg-surface p-2 shadow-lg">
          <button
            onClick={() => {
              setOpen(false);
              onUploadNew();
            }}
            className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-accent hover:bg-accent-soft"
          >
            <Plus size={15} /> Upload another statement
          </button>

          <div className="max-h-72 overflow-y-auto">
            {statements.map((s) => {
              const ext = s.filename.split(".").pop().toLowerCase();
              const Icon = ext === "pdf" ? FileText : FileSpreadsheet;
              return (
                <div
                  key={s._id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-canvas"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(s._id)}
                    onChange={() => toggle(s._id)}
                    className="accent-accent"
                  />
                  <Icon size={14} className="shrink-0 text-ink-dim" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ink">{s.filename}</p>
                    <p className="text-xs text-ink-dim">
                      {s.periodStart ? formatDate(s.periodStart) : "?"} – {s.periodEnd ? formatDate(s.periodEnd) : "?"} · {s.transactionCount} txns
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${s.filename}" and all its transactions? This can't be undone.`)) {
                        onDeleteStatement(s._id);
                      }
                    }}
                    className="shrink-0 text-ink-dim hover:text-negative"
                    title="Delete statement"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
