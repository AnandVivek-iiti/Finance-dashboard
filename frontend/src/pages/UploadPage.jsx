import { useState, useRef, useEffect } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import FileDropzone from "../components/FileDropzone.jsx";
import UserMenu from "../components/UserMenu.jsx";
import { uploadStatement } from "../utils/api.js";
import { formatRupees, formatBankName, formatDateHyphen } from "../utils/format.js";

export default function UploadPage({
  statements,
  loading,
  onUploadComplete,
  onViewStatements,
  onDeleteStatement,
  user,
  onLogout,
}) {
  const [phase, setPhase] = useState("idle"); // idle | uploading | processing | error
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [passwordPrompt, setPasswordPrompt] = useState(null); // { file, error } | null

  const handleFileSelected = async (file, password = null) => {
    setPhase("uploading");
    setErrorMessage("");
    setProgress(0);
    try {
      const data = await uploadStatement(file, (pct) => {
        setProgress(pct);
        if (pct === 100) setPhase("processing");
      }, password);
      setPasswordPrompt(null);
      setResult(data);
      setTimeout(() => onUploadComplete(data.statementId), 600);
    } catch (err) {
      const status = err.response?.status;
      const code = err.response?.data?.code;
      if (status === 401 && code === "PASSWORD_REQUIRED") {
        setPasswordPrompt({ file, error: null });
        setPhase("idle");
        return;
      }
      if (status === 401 && code === "INVALID_PASSWORD") {
        setPasswordPrompt({ file, error: "That password didn't work. Try again." });
        setPhase("idle");
        return;
      }
      setPasswordPrompt(null);
      setPhase("error");
      setErrorMessage(err.response?.data?.error || err.message || "Upload failed.");
    }
  };

  const toggleSelected = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirmDelete = async (id) => {
    if (!window.confirm("Delete this statement and all its transactions? This can't be undone.")) return;
    setDeletingId(id);
    try {
      await onDeleteStatement(id);
      setSelected((prev) => prev.filter((x) => x !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-2.5">
            <LedgerMark />
            <span className="font-display text-[17px] font-bold text-ink">Statement Analysis</span>
          </div>
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </header>

      <div className="px-4 py-14">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-7 text-center">
            <h1 className="font-display text-3xl font-bold text-ink">Understand your spending in one upload</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Upload a bank statement (.xls, .xlsx, or .pdf) and get a full visual breakdown - no
              spreadsheets, no manual work. Every figure traces back to an actual row in your statement.
            </p>
          </div>

          {phase === "idle" && <FileDropzone onFileSelected={handleFileSelected} />}

          {(phase === "uploading" || phase === "processing") && (
            <div className="card flex flex-col items-center gap-4 px-8 py-16 text-center">
              <Loader2 size={30} className="animate-spin text-accent" />
              <div>
                <p className="font-display text-lg font-semibold text-ink">
                  {phase === "uploading" ? `Uploading… ${progress}%` : "Reading, parsing and verifying your statement…"}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {phase === "processing" &&
                    "Converting to structured data, checking every balance line, and categorizing transactions."}
                </p>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="card flex flex-col items-center gap-4 border-negative/30 px-8 py-12 text-center">
              <AlertTriangle size={28} className="text-negative" />
              <div>
                <p className="font-display text-lg font-semibold text-ink">Couldn't process that file</p>
                <p className="mt-1 max-w-md text-sm text-ink-muted">{errorMessage}</p>
              </div>
              <button
                onClick={() => setPhase("idle")}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                Try another file
              </button>
            </div>
          )}

          {result && phase !== "error" && phase !== "idle" && result.continuityWarning?.warning && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{result.continuityWarning.message}</span>
            </div>
          )}

          {result && result.parseErrorCount > 0 && phase !== "error" && phase !== "idle" && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
              <span>
                Parsed {result.transactionCount} transactions successfully. {result.parseErrorCount} row(s) couldn't
                be verified and were excluded - you'll see details on the dashboard.
              </span>
            </div>
          )}
        </div>

        <div className="mx-auto mt-16 w-full max-w-4xl">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-base font-bold text-ink">Your statements</h2>
            {selected.length > 0 && (
              <button
                onClick={() => onViewStatements(selected)}
                className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                View dashboard{selected.length > 1 ? ` (${selected.length} combined)` : ""}
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-2.5">
              {[1, 2].map((i) => (
                <div key={i} className="card h-16 animate-pulse bg-border/40" />
              ))}
            </div>
          ) : statements.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-dim">
              No statements uploaded yet. Upload one above to get started.
            </div>
          ) : (
            <div className="flex flex-col gap-3.05">
              {statements.map((s) => (
                <div key={s._id} className="card flex items-center gap-3.5 px-6.5 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.includes(s._id)}
                    onChange={() => toggleSelected(s._id)}
                    aria-label={`Select ${s.filename}`}
                    className="accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      {formatBankName(s.bankProfile)} ·{" "}
                      {s.accountNumber ? `••${s.accountNumber.slice(-4)}` : "Unknown account"}
                      {s.parseErrorCount > 0 && (
                        <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
                          {s.parseErrorCount} flagged row{s.parseErrorCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      {formatDateHyphen(s.periodStart)} – {formatDateHyphen(s.periodEnd)} · {s.transactionCount} transactions
                    </div>
                  </div>
                  <div className="whitespace-nowrap font-mono text-[13px] text-ink-muted">
                    closes {formatRupees(s.closingBalancePaise, { decimals: 2 })}
                  </div>
                  <button
                    onClick={() => onViewStatements([s._id])}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-ink"
                  >
                    View
                  </button>
                  <button
                    onClick={() => confirmDelete(s._id)}
                    disabled={deletingId === s._id}
                    className="rounded-lg border border-negative/30 bg-negative-soft px-3 py-1.5 text-sm text-negative disabled:opacity-60"
                  >
                    {deletingId === s._id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {passwordPrompt && (
        <PasswordModal
          fileName={passwordPrompt.file.name}
          error={passwordPrompt.error}
          onSubmit={(password) => handleFileSelected(passwordPrompt.file, password)}
          onCancel={() => setPasswordPrompt(null)}
        />
      )}
    </div>
  );
}

function PasswordModal({ fileName, error, onSubmit, onCancel }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!value) return;
    onSubmit(value);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enter file password"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
      onClick={onCancel}
    >
      <form
        className="card w-[360px] px-6 pb-5 pt-6"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="text-[15px] font-semibold text-ink">Password protected file</div>
        <div className="mb-4 mt-1 break-words text-[12.5px] text-ink-muted">
          "{fileName}" needs a password to open.
        </div>
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter password"
          autoComplete="off"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        {error && <div className="mt-2 text-xs text-negative">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
          >
            Unlock &amp; upload
          </button>
        </div>
      </form>
    </div>
  );
}

function LedgerMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="1" y="1" width="20" height="20" rx="5" className="stroke-accent" strokeWidth="1.5" />
      <line x1="6" y1="7" x2="16" y2="7" className="stroke-accent" strokeWidth="1.5" />
      <line x1="6" y1="11" x2="13" y2="11" className="stroke-accent" strokeWidth="1.5" />
      <line x1="6" y1="15" x2="15" y2="15" className="stroke-accent" strokeWidth="1.5" />
    </svg>
  );
}