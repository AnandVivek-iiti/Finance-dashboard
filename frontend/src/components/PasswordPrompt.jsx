import { useState } from "react";
import { Lock, X, Eye, EyeOff } from "lucide-react";

export default function PasswordPrompt({ filename, wrongPassword, onSubmit, onCancel }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password) return;
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Lock size={16} />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-ink">Password protected</p>
              <p className="max-w-[220px] truncate text-xs text-ink-dim">{filename}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-ink-dim hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs text-ink-dim">
            {wrongPassword ? (
              <span className="text-negative">That password didn't work. Try again.</span>
            ) : (
              <span>Enter the password to open this file.</span>
            )}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 pr-10 text-sm text-ink"
                placeholder="File password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <p className="text-[11px] leading-snug text-ink-dim">
            This is only used to open the file for this upload - it isn't saved anywhere.
          </p>

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-border py-2 text-sm text-ink-muted hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password}
              className="flex-1 rounded-lg bg-accent py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              Unlock &amp; Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}