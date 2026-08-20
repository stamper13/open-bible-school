import { type Dispatch, type SetStateAction, useCallback, useState } from "react";
import { beginPendingTransfer, clearPendingTransfer, newFlowId } from "@/lib/auth/anonymousTransfer";
import { authCallbackUrl } from "@/lib/auth/redirect";
import type { BliContractScores } from "@/lib/bliContract";
import { supabase } from "@/lib/supabase/client";
import { buildScopeScores, clearAssessmentBrowserStorage, isAnonymousSession } from "./homeHelpers";
import type {
  AssessmentSnapshot,
  BackendRecommendation,
  ScopeScore,
  SectionScoreMap,
} from "./homeTypes";

type HomeAccountActionsOptions = {
  setAccountMenuOpen: (open: boolean) => void;
  setAssessmentData: Dispatch<SetStateAction<AssessmentSnapshot | null>>;
  setBackendRecommendation: Dispatch<SetStateAction<BackendRecommendation | null>>;
  setScopeScores: Dispatch<SetStateAction<{sections: ScopeScore[]; books: ScopeScore[]; domains: ScopeScore[]}>>;
  setSectionScores: Dispatch<SetStateAction<SectionScoreMap>>;
  setTestamentScores: Dispatch<SetStateAction<BliContractScores | null>>;
  setUserEmail: Dispatch<SetStateAction<string | null>>;
};

export function useHomeAccountActions({
  setAccountMenuOpen,
  setAssessmentData,
  setBackendRecommendation,
  setScopeScores,
  setSectionScores,
  setTestamentScores,
  setUserEmail,
}: HomeAccountActionsOptions) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSignIn = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const anonId = isAnonymousSession(session) ? session?.user?.id : null;
    const flowId = newFlowId();
    if (anonId) {
      await beginPendingTransfer(supabase, localStorage, anonId, flowId);
    } else {
      clearPendingTransfer(localStorage);
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authCallbackUrl({ flow: flowId }) },
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    setAccountMenuOpen(false);
    await supabase.auth.signOut();
    clearAssessmentBrowserStorage();
    setUserEmail(null);
    setAssessmentData(null);
    setTestamentScores(null);
    setSectionScores({});
    setScopeScores(buildScopeScores([], []));
    setBackendRecommendation(null);
  }, [
    setAccountMenuOpen,
    setAssessmentData,
    setBackendRecommendation,
    setScopeScores,
    setSectionScores,
    setTestamentScores,
    setUserEmail,
  ]);

  const handleDeleteAccountRequest = useCallback(() => {
    setAccountMenuOpen(false);
    setDeleteConfirm("");
    setDeleteError(null);
    setDeleteOpen(true);
  }, [setAccountMenuOpen]);

  const handleDeleteAccount = useCallback(async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setDeleteError("Your session has expired. Sign in again and retry.");
        return;
      }

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmEmail: deleteConfirm.trim() }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setDeleteError(payload?.error ?? "The account could not be deleted. Please try again.");
        return;
      }

      await supabase.auth.signOut();
      clearAssessmentBrowserStorage();
      window.location.href = "/";
    } catch {
      setDeleteError("The account could not be deleted. Please check your connection and try again.");
    } finally {
      setDeleteBusy(false);
    }
  }, [deleteConfirm]);

  return {
    deleteBusy,
    deleteConfirm,
    deleteError,
    deleteOpen,
    handleDeleteAccount,
    handleDeleteAccountRequest,
    handleSignIn,
    handleSignOut,
    setDeleteConfirm,
    setDeleteOpen,
  };
}
