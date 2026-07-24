export default function ChartCard({ title, subtitle, children, className = "", chartKey }) {
  return (
    <div className={`card flex flex-col gap-3 px-5 py-4 ${className}`}>
      <div>
        <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-xs text-ink-dim">{subtitle}</p>}
      </div>
      <div className="min-h-[220px] flex-1" data-chart-key={chartKey || undefined}>
        {children}
      </div>
    </div>
  );
}