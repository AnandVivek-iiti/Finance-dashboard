// frontend/src/components/ReportDownloadMenu.jsx
import { useEffect, useRef, useState } from "react";
import { Download, FileText, FileSpreadsheet, ChevronDown, Loader2 } from "lucide-react";
import { downloadPdfReport, downloadXlsxReport } from "../utils/reportGenerators.js";

export default function ReportDownloadMenu({ metrics, title, bankLabel, statementCount, disabled, onCaptureCharts }) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(null); // "pdf" | "xlsx" | null
  const [error, setError] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleDownload = async (format) => {
    setOpen(false);
    setError("");
    setGenerating(format);
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (format === "pdf") {
        const chartImages = onCaptureCharts ? await onCaptureCharts() : {};
        downloadPdfReport({ metrics, title, bankLabel, statementCount, chartImages });
      } else {
        downloadXlsxReport({ metrics, title, bankLabel, statementCount });
      }
    } catch (err) {
      setError("Couldn't generate the report. Please try again.");
    } finally {
      setGenerating(null);
    }
  };

  const isBusy = generating !== null;
  const isDisabled = disabled || isBusy;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isDisabled}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink shadow-card disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isBusy ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Download size={15} className="shrink-0" />}
        <span className="hidden sm:inline">
          {isBusy ? `Preparing ${generating.toUpperCase()}…` : "Download report"}
        </span>
        <span className="sm:hidden">{isBusy ? "…" : "Report"}</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          <button
            role="menuitem"
            onClick={() => handleDownload("pdf")}
            className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-ink hover:bg-canvas"
          >
            <FileText size={15} className="shrink-0 text-accent" />
            <span>Download as PDF</span>
          </button>
          <button
            role="menuitem"
            onClick={() => handleDownload("xlsx")}
            className="flex w-full items-center gap-2 border-t border-border px-3.5 py-2.5 text-left text-sm text-ink hover:bg-canvas"
          >
            <FileSpreadsheet size={15} className="shrink-0 text-positive" />
            <span>Download as Excel</span>
          </button>
        </div>
      )}

      {error && (
        <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-negative/30 bg-negative-soft px-3 py-2 text-xs text-negative">
          {error}
        </div>
      )}
    </div>
  );
}