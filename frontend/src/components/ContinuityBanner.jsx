export default function ContinuityBanner({ statements, selectedIds }) {
  const selected = statements.filter((s) => selectedIds.includes(s._id));
  const withContinuity = selected.filter((s) => s.continuityWarning);

  if (withContinuity.length === 0) return null;

  const issues = withContinuity.filter((s) => s.continuityWarning.warning);
  const clean = withContinuity.filter((s) => !s.continuityWarning.warning);
  const toShow = issues.length > 0 ? issues : clean;

  return (
    <div className="flex flex-col gap-2">
      {toShow.map((s) => {
        const isWarning = s.continuityWarning.warning;
        return (
          <div
            key={s._id}
            className={`card flex items-baseline gap-2.5 px-4 py-2.5 text-[12.5px] ${
              isWarning ? "border-warn/30 bg-warn-soft" : "border-positive/30 bg-positive-soft"
            }`}
          >
            <strong className={`whitespace-nowrap ${isWarning ? "text-warn" : "text-positive"}`}>
              {isWarning ? "Possible continuity issue:" : "Statements continue cleanly:"}
            </strong>
            <span className="text-ink">{s.continuityWarning.message}</span>
          </div>
        );
      })}
    </div>
  );
}