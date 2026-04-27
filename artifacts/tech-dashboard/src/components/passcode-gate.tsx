import { useState, useEffect, useRef } from "react";
import { runtimeConfig } from "@/lib/runtime-config";

const RAW_PASSCODE = runtimeConfig.sitePasscode;
const PASSCODES: string[] = RAW_PASSCODE
  ? RAW_PASSCODE.split(",").map((p) => p.trim()).filter(Boolean)
  : [];
const SESSION_KEY = "delivery_dashboard_unlocked";

interface PasscodeGateProps {
  children: React.ReactNode;
}

export default function PasscodeGate({ children }: PasscodeGateProps) {
  const [unlocked, setUnlocked] = useState(() => {
    if (PASSCODES.length === 0) return true;
    return sessionStorage.getItem(SESSION_KEY) === "1";
  });
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!unlocked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [unlocked]);

  if (unlocked) {
    return <>{children}</>;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (PASSCODES.includes(value)) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setShake(true);
      setValue("");
      setTimeout(() => setShake(false), 600);
      inputRef.current?.focus();
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
          <div
            className={shake ? "animate-shake" : ""}
          >
            <input
              ref={inputRef}
              type="password"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(false);
              }}
              placeholder="Passcode"
              autoComplete="current-password"
              className={[
                "w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none transition-colors",
                "placeholder:text-muted-foreground",
                "focus:ring-2 focus:ring-ring focus:border-transparent",
                error
                  ? "border-destructive focus:ring-destructive/40"
                  : "border-input bg-background",
              ].join(" ")}
            />
            {error && (
              <p className="mt-1.5 text-xs text-destructive">
                Incorrect passcode. Please try again.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
