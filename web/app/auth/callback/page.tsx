"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Status =
  | { kind: "working" }
  // Sign-in itself failed; the user is not authenticated.
  | { kind: "auth-failed"; message: string }
  // Signed in, but guest progress could not be carried over.
  | { kind: "transfer-failed"; next: string };

// A hung network request should not leave the user on a spinner forever.
const TIMEOUT_MS = 20000;

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "working" });
  const doneRef = useRef(false);

  const clearGuestStorage = useCallback(() => {
    localStorage.removeItem("obs_anon_user_id");
    localStorage.removeItem("obs_answered");
    localStorage.removeItem("obs_correct");
    localStorage.removeItem("obs_attempt_id");
    localStorage.removeItem("obs_user_id");
    sessionStorage.removeItem("obs_anon_session_active");
    sessionStorage.removeItem("obs_anon_user_id");
    sessionStorage.removeItem("obs_session_answered");
    sessionStorage.removeItem("obs_session_correct");
  }, []);

  useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (cancelled || doneRef.current) return;
      setStatus({
        kind: "auth-failed",
        message: "Signing in is taking longer than expected. The service may be temporarily unavailable.",
      });
    }, TIMEOUT_MS);

    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);

        // Supabase reports a rejected or expired link back on the URL itself,
        // in the query string or the hash fragment depending on the flow.
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const linkError = params.get("error_description") ?? params.get("error")
          ?? hash.get("error_description") ?? hash.get("error");
        if (linkError) {
          doneRef.current = true;
          if (!cancelled) {
            setStatus({
              kind: "auth-failed",
              message: "That sign-in link is no longer valid. Links expire after a short time and can only be used once.",
            });
          }
          return;
        }

        const code = params.get("code");
        const requestedPath = params.get("next");
        const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : "/";

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          doneRef.current = true;
          if (!cancelled) {
            setStatus({
              kind: "auth-failed",
              message: "We could not complete sign-in. The link may have expired or already been used.",
            });
          }
          return;
        }

        const newUserId = session.user.id;

        const anonFromUrl = params.get("anon");
        const anonFromLocal = localStorage.getItem("obs_anon_user_id");
        const anonFromSession = sessionStorage.getItem("obs_anon_user_id");
        const anonUserId = anonFromUrl || anonFromLocal || anonFromSession;

        if (anonUserId && anonUserId !== newUserId && anonUserId.length > 10) {
          const { error } = await supabase.rpc("migrate_anonymous_data", {
            p_anonymous_user_id: anonUserId,
            p_new_user_id: newUserId,
          });

          if (error) {
            // The account is valid, so do not fail the sign-in. Say plainly
            // that the guest progress did not carry over, and leave the guest
            // keys in place so nothing is destroyed on a failed transfer.
            console.error("Progress transfer failed:", error);
            doneRef.current = true;
            if (!cancelled) setStatus({ kind: "transfer-failed", next: nextPath });
            return;
          }
        }

        clearGuestStorage();
        doneRef.current = true;
        router.push(nextPath);
      } catch (err) {
        console.error("Auth callback error:", err);
        doneRef.current = true;
        if (!cancelled) {
          setStatus({
            kind: "auth-failed",
            message: "Something went wrong while signing you in. Please request a new sign-in link.",
          });
        }
      }
    };

    handleCallback();

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [clearGuestStorage, router]);

  return (
    <div className="cb-wrap">
      <style>{`
        .cb-wrap {
          min-height: 100vh; background: #0b0f1e;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          font-family: var(--font-inter), Inter, system-ui, sans-serif;
        }
        .cb-card { text-align: center; max-width: 420px; }
        .cb-spinner {
          width: 40px; height: 40px; border-radius: 50%;
          border: 3px solid rgba(255,255,255,.1); border-top-color: #0aa3a3;
          animation: cbSpin .8s linear infinite; margin: 0 auto 16px;
        }
        @keyframes cbSpin { to { transform: rotate(360deg); } }
        .cb-title {
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 21px; font-weight: 600; color: #fff; margin-bottom: 10px;
        }
        .cb-copy { color: rgba(255,255,255,.62); font-size: 14px; line-height: 1.6; }
        .cb-actions {
          display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 22px;
        }
        .cb-btn {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 44px; padding: 11px 22px; border-radius: 999px;
          font-size: 14px; font-weight: 650; text-decoration: none; cursor: pointer;
          font-family: inherit; border: 1px solid transparent;
          transition: background .15s, transform .13s;
        }
        .cb-btn.primary { background: #0aa3a3; color: #fff; }
        .cb-btn.primary:hover { background: #089090; }
        .cb-btn.ghost {
          background: rgba(255,255,255,.06); color: #fff; border-color: rgba(255,255,255,.18);
        }
        .cb-btn.ghost:hover { background: rgba(255,255,255,.13); }
        .cb-btn:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        .cb-icon { width: 40px; height: 40px; margin: 0 auto 14px; color: #f0c674; }
        @media (prefers-reduced-motion: reduce) {
          .cb-spinner { animation: none; border-top-color: rgba(255,255,255,.5); }
          .cb-btn { transition: none; }
        }
      `}</style>

      <div className="cb-card" role="status" aria-live="polite">
        {status.kind === "working" && (
          <>
            <div className="cb-spinner" aria-hidden="true" />
            <p className="cb-copy">Signing you in and saving your progress...</p>
          </>
        )}

        {status.kind === "auth-failed" && (
          <>
            <svg className="cb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h1 className="cb-title">Sign-in did not complete</h1>
            <p className="cb-copy">{status.message}</p>
            <div className="cb-actions">
              <Link className="cb-btn primary" href="/">Back to sign in</Link>
              <Link className="cb-btn ghost" href="/assess">Continue as a guest</Link>
            </div>
          </>
        )}

        {status.kind === "transfer-failed" && (
          <>
            <svg className="cb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h1 className="cb-title">You are signed in</h1>
            <p className="cb-copy">
              Your guest progress could not be transferred to this account, so it has been left untouched
              rather than discarded. Any new assessments will be saved to your account normally.
            </p>
            <div className="cb-actions">
              <button
                type="button"
                className="cb-btn primary"
                onClick={() => router.push(status.next)}
              >
                Continue
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
