import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
    }
  };

  const showImage = user?.picture && !imgFailed;
  const initial = (user?.email || user?.name || "?").charAt(0).toUpperCase();

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={user?.name || user?.email}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border shadow-card"
      >
        {showImage ? (
          <img
            src={user.picture}
            alt={user.name || user.email}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-accent-soft text-xs font-semibold text-accent">
            {initial}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-border bg-surface p-3 shadow-card">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            {showImage ? (
              <img
                src={user.picture}
                alt={user.name || user.email}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">{user?.name || "—"}</div>
              <div className="truncate text-xs text-ink-muted">{user?.email}</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-muted hover:bg-canvas disabled:opacity-50"
          >
            <LogOut size={14} />
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}