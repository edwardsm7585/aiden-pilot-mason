"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const COOKIE = "deskline_signin_retry_at";

/** When sign-in reopens (ms since epoch), from the cookie the 429 sets. */
function readRetryAt(): number | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(\\d+)`));
  const at = m ? Number(m[1]) : 0;
  return at > Date.now() ? at : null;
}

/**
 * Shown above the SDK `LoginForm` while sign-in is rate-limited. The form
 * itself can't say so: it toasts "Invalid email or password" for any error
 * (upstream issue 2), so this also dismisses that misleading toast. The SDK
 * form stays as is; this only composes around it.
 */
export function SignInLimitNotice() {
  // Minutes until sign-in reopens, or null when not limited.
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const check = () => {
      const at = readRetryAt();
      setMinutes(
        at ? Math.max(1, Math.ceil((at - Date.now()) / 60_000)) : null
      );
      if (at) toast.dismiss();
      return at;
    };
    check();
    // A submit is when a 429 can arrive: watch for its cookie for a few
    // seconds, dismissing the generic toast whenever it appears.
    let watch: ReturnType<typeof setInterval> | undefined;
    const onSubmit = () => {
      clearInterval(watch);
      let ticks = 0;
      watch = setInterval(() => {
        check();
        if (++ticks >= 20) clearInterval(watch);
      }, 150);
    };
    document.addEventListener("submit", onSubmit, true);
    // Keep the countdown current, and clear the notice once it expires.
    const refresh = setInterval(check, 15_000);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      clearInterval(watch);
      clearInterval(refresh);
    };
  }, []);

  if (minutes === null) return null;
  return (
    <Alert variant="destructive">
      <ShieldAlert className="size-4" strokeWidth={1.5} />
      <AlertTitle>Too many sign-in attempts</AlertTitle>
      <AlertDescription>
        {`Sign-in is paused to protect your account. Wait about ${minutes} minute${minutes === 1 ? "" : "s"}, then sign in again.`}
      </AlertDescription>
    </Alert>
  );
}
