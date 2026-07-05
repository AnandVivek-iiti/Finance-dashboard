import { useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  ShieldCheck,
  PieChart,
  Layers,
  ChevronDown,
  Lock,
} from "lucide-react";

const FAQS = [
  {
    q: "Which banks are supported?",
    a: "Canara Bank and SBI are fully verified today. Other banks can be tried via a generic parser; unverified or odd rows are always flagged, never silently guessed.",
  },
  {
    q: "What file formats can I upload?",
    a: ".pdf, .xls, and .xlsx. Scanned or photographed PDFs, and spreadsheets with an unfamiliar bank's column layout, are handled by an AI-assisted fallback when one is configured on the server - otherwise text-based tables from known bank formats work best.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Only your signed-in Google account can ever see your statements, transactions, or account details - see the Privacy section above.",
  },
  {
    q: "Do you store my bank password or account password?",
    a: "There's no password at all. Google handles sign-in, and file-level passwords for protected PDF/Excel exports are used once to decrypt the file in memory - they're never stored.",
  },
  {
    q: "Can I delete my data?",
    a: "Yes, permanently, at any time, per statement - deleting a statement removes its transactions and parse errors too.",
  },
  {
    q: "What if a transaction doesn't add up?",
    a: "It's flagged as unreconciled and excluded from every total shown on the dashboard. You'll see it called out, not silently absorbed into your numbers.",
  },
  {
    q: "Is this free to use?",
    a: "Yes - the dashboard is free to use.",
  },
];

function GoogleButton({ onCredential, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google || !ref.current) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => onCredential(response.credential),
    });
    window.google.accounts.id.renderButton(ref.current, {
      theme: "filled_blue",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 280,
    });
  }, [onCredential]);

  return <div ref={ref} className={className} />;
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="font-display text-sm font-semibold text-ink">{q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-5 pb-4 text-sm leading-relaxed text-ink-muted">{a}</div>}
    </div>
  );
}

export default function LandingPage({ onLogin }) {
  const [authError, setAuthError] = useState("");

  const handleCredential = async (idToken) => {
    setAuthError("");
    try {
      await onLogin(idToken);
    } catch (err) {
      setAuthError("Sign-in failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Hero */}
      <header className="border-b border-border bg-surface px-4 py-16 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <span className="eyebrow">Finance Dashboard</span>
          <h1 className="font-display text-3xl font-bold text-ink lg:text-4xl">
            Turn your bank statement into a clear spending report - for your eyes only.
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-ink-muted lg:text-base">
            Reading a bank statement PDF or Excel file by hand is tedious and error-prone, and a
            single wrong spreadsheet formula can silently throw off every total. This tool checks
            every transaction against the bank's own running balance, so nothing on your dashboard
            is guessed.
          </p>
          <div className="flex flex-col items-center gap-2">
            <GoogleButton onCredential={handleCredential} />
            <p className="text-xs text-ink-dim">No signup form, no password to create - just your Google account.</p>
            {authError && <p className="text-xs text-negative">{authError}</p>}
          </div>
        </div>
      </header>

      {/* What it does */}
      <section className="px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-xl font-bold text-ink">What it does</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5">
              <UploadCloud className="text-accent" size={22} />
              <h3 className="mt-3 font-display text-sm font-semibold text-ink">Upload and go</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                Drop in a .pdf, .xls, or .xlsx statement and get a full dashboard in seconds - no
                manual data entry.
              </p>
            </div>
            <div className="card p-5">
              <ShieldCheck className="text-positive" size={22} />
              <h3 className="mt-3 font-display text-sm font-semibold text-ink">Verified, not guessed</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                Every transaction is checked against the bank's running balance. Anything that
                doesn't reconcile is flagged and excluded from your totals.
              </p>
            </div>
            <div className="card p-5">
              <PieChart className="text-accent" size={22} />
              <h3 className="mt-3 font-display text-sm font-semibold text-ink">See the full picture</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                Spend by category, monthly trends, recurring payments, top merchants, cash vs.
                digital split, and balance over time - computed live from your own transactions.
              </p>
            </div>
            <div className="card p-5">
              <Layers className="text-accent" size={22} />
              <h3 className="mt-3 font-display text-sm font-semibold text-ink">Multi-statement continuity</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                Upload statements over time and it automatically flags gaps, missing statements, or
                duplicate uploads.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Supported banks */}
      <section className="border-t border-border bg-surface px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-xl font-bold text-ink">Supported banks</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            <strong className="text-ink">Canara Bank and State Bank of India (SBI)</strong>{" "}
            statements are fully supported and verified - header detection and column mapping are
            tuned to each bank's exact format.
          </p>
          <p className="mt-2 text-xs text-ink-dim">
            Other banks can be tried through a generic parser and may still work, but haven't been
            verified end-to-end yet. Flagged rows are always shown, never silently dropped.
          </p>
        </div>
      </section>

      {/* Privacy */}
      <section className="px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-center gap-2">
            <Lock size={18} className="text-accent" />
            <h2 className="font-display text-xl font-bold text-ink">Your data is yours alone</h2>
          </div>
          <ul className="mt-6 space-y-3 text-sm leading-relaxed text-ink-muted">
            <li className="card px-5 py-4">
              Sign-in is Google-only - no password is ever created, stored, or capable of being
              leaked.
            </li>
            <li className="card px-5 py-4">
              Every statement and transaction is tied privately to your Google account. No other
              user, and no unauthenticated request, can ever read it.
            </li>
            <li className="card px-5 py-4">
              Uploaded files are deleted from the server the moment parsing finishes - nothing is
              stored beyond the structured transaction data you can see and delete yourself.
            </li>
            <li className="card px-5 py-4">
              Any statement can be permanently deleted, anytime, from the dashboard - deleting
              removes its transactions and parse errors too.
            </li>
            <li className="card px-5 py-4">
              No ads, no selling of data, and no third-party analytics or trackers reading
              transaction content.
            </li>
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-surface px-4 py-14 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center font-display text-xl font-bold text-ink">FAQs</h2>
          <div className="mt-6 flex flex-col gap-2.5">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="px-4 py-16 lg:px-8">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <h2 className="font-display text-lg font-bold text-ink">Ready to see where your money went?</h2>
          <GoogleButton onCredential={handleCredential} />
          {authError && <p className="text-xs text-negative">{authError}</p>}
        </div>
      </footer>
    </div>
  );
}