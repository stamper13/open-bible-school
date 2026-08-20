import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
} from "./constants";
import { clearAssessmentBrowserStorage } from "./assessmentHelpers";
import type { BliEvidence, Testament } from "./types";

export function useAssessmentSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [scoreEvidence, setScoreEvidence] = useState<BliEvidence | null>(null);

  const ensureAssessmentSession = useCallback(async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (session?.user && !session.user.email) {
      const belongsToThisBrowserSession =
        sessionStorage.getItem(ANON_SESSION_ACTIVE_KEY) === "1";
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (
        !belongsToThisBrowserSession ||
        userError ||
        userData.user?.id !== session.user.id
      ) {
        await supabase.auth.signOut();
        clearAssessmentBrowserStorage();
        session = null;
      }
    }
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
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
