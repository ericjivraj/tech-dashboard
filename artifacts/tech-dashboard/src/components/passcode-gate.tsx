import { useState, useEffect, useRef } from "react";

const SESSION_KEY = "delivery_dashboard_unlocked";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PasscodeGateProps {
  children: React.ReactNode;
  bypass?: boolean;
}

type GateStatus = "loading" | "open" | "required";

export default function PasscodeGate({ children, bypass = false }: PasscodeGateProps) {
  // Initial state: if a previous unlock is in sessionStorage, treat as open
  // optimistically; otherwise wait for /api/passcode/status to tell us
  // whether a passcode is even configured.
  const [status, setStatus] = useState<GateStatus>(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return "open";
    return "loading";
  });
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== "loading") return;
    let cancelled = false;
    fetch(`${basePath}/api/passcode/status`, { credentials: "include" })
      .then((r) => r.json())
      .then((body: { required?: boolean }) => {
        if (cancelled) return;
        setStatus(body.required ? "required" : "open");
      })
      .catch(() => {
        // Network failure → fail closed (require passcode). Better to lock
        // people out and let them retry than silently expose the dashboard.
        if (!cancelled) setStatus("required");
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status === "required" && !bypass && inputRef.current) {
      inputRef.current.focus();
    }
  }, [status, bypass]);

  if (bypass || status === "open") {
    return <>{children}</>;
  }

  if (status === "loading") {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30" />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${basePath}/api/passcode/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: value }),
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setStatus("open");
        return;
      }
      setError("Incorrect passcode. Please try again.");
      setShake(true);
      setValue("");
      setTimeout(() => setShake(false), 600);
      inputRef.current?.focus();
    } catch {
      setError("Couldn't reach server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-md">
        <div className="space-y-1 text-center">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="Tech Dashboard"
            className="mx-auto mb-4 h-7"
          />
          <p className="text-sm text-muted-foreground">
            Enter the passcode to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={shake ? "animate-shake" : ""}>
            <input
              ref={inputRef}
              type="password"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Passcode"
              autoComplete="current-password"
              disabled={submitting}
              className={[
                "w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none transition-colors",
                "placeholder:text-muted-foreground",
                "focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-60",
                error
                  ? "border-destructive focus:ring-destructive/40"
                  : "border-input bg-background",
              ].join(" ")}
            />
            {error && (
              <p className="mt-1.5 text-xs text-destructive">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !value}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {submitting ? "Checking…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
