import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

export default function DataQualityBanner({ statements, selectedIds }) {
  const [expanded, setExpanded] = useState(false);
  const selected = statements.filter((s) => selectedIds.includes(s._id));

  const warnings = selected.filter((s) => s.continuityWarning?.warning);
  const totalParseErrors = selected.reduce((sum, s) => sum + (s.parseErrorCount || 0), 0);

  if (warnings.length === 0 && totalParseErrors === 0) return null;

  return (
    <div className="rounded-lg border border-warn/30 bg-warn-soft">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-warn"
      >
        <AlertTriangle size={15} className="shrink-0" />
        <span className="flex-1">
          {warnings.length > 0 && `${warnings.length} statement(s) with balance continuity warnings. `}
          {totalParseErrors > 0 && `${totalParseErrors} row(s) excluded from totals as unverifiable.`}
        </span>
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-warn/20 px-4 py-3 text-xs text-warn">
          {warnings.map((s) => (
            <p key={s._id}>
              <strong>{s.filename}:</strong> {s.continuityWarning.message}
            </p>
          ))}
          {totalParseErrors > 0 && (
            <p>
              Rows that couldn't be verified against the statement's own balance column (or had
              unparseable amounts/dates) are excluded from every total and chart above, rather than
              being silently included. See the transaction table's "unreconciled" filter for details.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
