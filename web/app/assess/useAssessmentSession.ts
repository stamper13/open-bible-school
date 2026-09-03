import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
} from "./constants";
import { clearAssessmentBrowserStorage } from "./assessmentHelpers";
import type { BliEvidence, Testament } from "./types";

const AUTH_REQUEST_TIMEOUT_MS = 12_000;
const ANONYMOUS_SIGN_IN_RETRY_DELAYS_MS = [750] as const;

async function wait(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function withAuthTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${label} timed out after ${AUTH_REQUEST_TIMEOUT_MS / 1000} seconds`));
        }, AUTH_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function useAssessmentSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [scoreEvidence, setScoreEvidence] = useState<BliEvidence | null>(null);

  const ensureAssessmentSession = useCallback(async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (session?.user && !session.user.email) {
      let localAnonUserId: string | null = null;
      try {
        localAnonUserId = localStorage.getItem(ANON_USER_ID_KEY);
      } catch {
        localAnonUserId = null;
      }
      let sessionAnonActive = false;
      try {
        sessionAnonActive = sessionStorage.getItem(ANON_SESSION_ACTIVE_KEY) === "1";
      } catch {
        sessionAnonActive = false;
      }
      const belongsToThisBrowserSession =
        sessionAnonActive
        || localAnonUserId === session.user.id;
      let userResponse: Awaited<ReturnType<typeof supabase.auth.getUser>> | null = null;
      let userCheckTimedOut = false;
      try {
        userResponse = await withAuthTimeout(supabase.auth.getUser(), "Session check");
      } catch {
        userCheckTimedOut = true;
        userResponse = null;
      }
      if (
        !belongsToThisBrowserSession ||
        (!userCheckTimedOut && (
          userResponse?.error ||
          userResponse?.data.user?.id !== session.user.id
        ))
      ) {
        try {
          await withAuthTimeout(supabase.auth.signOut(), "Anonymous session reset");
        } catch {
          // Continue with local cleanup so a stale anonymous session cannot trap startup.
        }
        clearAssessmentBrowserStorage();
        session = null;
      }
    }
    if (!session) {
      let lastError: unknown = null;
      for (let attempt = 0; attempt <= ANONYMOUS_SIGN_IN_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const { data, error } = await withAuthTimeout(
            supabase.auth.signInAnonymously(),
            "Anonymous assessment sign-in",
          );
          if (error) throw error;
          session = data.session;
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          const retryDelay = ANONYMOUS_SIGN_IN_RETRY_DELAYS_MS[attempt];
          if (retryDelay === undefined) break;
          await wait(retryDelay);
        }
      }
      if (!session && lastError) throw lastError;
    }
    const uid = session?.user?.id;
    if (!uid) throw new Error("No user ID");
    setUserId(uid);
    setIsSignedIn(Boolean(session?.user?.email));
    if (!session?.user.email) {
      sessionStorage.setItem(ANON_SESSION_ACTIVE_KEY, "1");
      sessionStorage.setItem(ANON_USER_ID_KEY, uid);
      localStorage.setItem(ANON_USER_ID_KEY, uid);
    }
    return uid;
  }, []);

  const loadScoreEvidence = useCallback(async (uid: string, scope: Testament) => {
    try {
      const { data, error } = await supabase.rpc("obs_get_bli_uncertainty", {
        p_user_id: uid,
        p_scope: scope,
      });
      if (error) return;
      let evidence = ((data ?? [])[0] as BliEvidence | undefined) ?? null;
      if (!evidence && scope === "OT") {
        const { data: bibleData, error: bibleError } = await supabase.rpc("obs_get_bli_uncertainty", {
          p_user_id: uid,
          p_scope: "BIBLE",
        });
        if (!bibleError) evidence = ((bibleData ?? [])[0] as BliEvidence | undefined) ?? null;
      }
      setScoreEvidence(evidence);
    } catch (error) {
      console.warn("Score evidence refresh failed:", error);
    }
  }, []);

  return {
    ensureAssessmentSession,
    isSignedIn,
    loadScoreEvidence,
    scoreEvidence,
    setUserId,
    userId,
  };
}
