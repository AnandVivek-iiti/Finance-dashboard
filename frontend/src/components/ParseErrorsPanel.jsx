import { useEffect, useState } from "react";
import { fetchParseErrors } from "../utils/api.js";

export default function ParseErrorsPanel({ statements, selectedIds }) {
  const [open, setOpen] = useState(false);
  const [errorsByStatement, setErrorsByStatement] = useState({});

  const selected = statements.filter((s) => selectedIds.includes(s._id));
  const totalCount = selected.reduce((sum, s) => sum + (s.parseErrorCount || 0), 0);

  useEffect(() => {
    if (!open || totalCount === 0) return;
    const withErrors = selected.filter((s) => s.parseErrorCount > 0);
    Promise.all(
      withErrors.map((s) => fetchParseErrors(s._id).then((errors) => [s._id, errors]))
    ).then((pairs) => {
      setErrorsByStatement(Object.fromEntries(pairs));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedIds.join(",")]);

  if (totalCount === 0) return null;

  const allErrors = selected.flatMap((s) =>
    (errorsByStatement[s._id] || []).map((e) => ({ ...e, statementFilename: s.filename }))
  );

  return (
    <div className="card px-4 py-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-left text-[13px] font-semibold text-warn"
      >
        {open ? "▾" : "▸"} {totalCount} row{totalCount === 1 ? "" : "s"} flagged during parsing — click to review
      </button>

      {open && (
        <div className="mt-3 flex max-h-60 flex-col gap-2 overflow-y-auto">
          {allErrors.length === 0 && <div className="text-xs text-ink-dim">Loading…</div>}
          {allErrors.map((e, i) => (
            <div key={i} className="border-b border-border pb-2 text-xs">
              <div className="text-ink-muted">
                {e.statementFilename} · row {e.rowIndex + 1}
              </div>
              <div className="text-ink">{e.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}