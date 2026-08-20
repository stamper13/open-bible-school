import { type Dispatch, type SetStateAction, useCallback } from "react";
import { beginPendingTransfer, clearPendingTransfer, newFlowId } from "@/lib/auth/anonymousTransfer";
import { authCallbackUrl } from "@/lib/auth/redirect";
import { supabase } from "@/lib/supabase/client";

type AssessmentAuthActionsOptions = {
  email: string;
  setErrorMsg: Dispatch<SetStateAction<string>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  userId: string | null;
};

export function useAssessmentAuthActions({
  email,
  setErrorMsg,
  setSaved,
  setSaving,
  userId,
}: AssessmentAuthActionsOptions) {
  const handleSignOut = useCallback(async () => {
    clearPendingTransfer(localStorage);
    await supabase.auth.signOut();
    window.location.href = "/";
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setSaving(true);
    // Mint while still signed in as the guest. The URL carries only the
    // non-secret flow id; the transfer capability stays in localStorage.
    const flowId = newFlowId();
    if (userId) await beginPendingTransfer(supabase, localStorage, userId, flowId);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authCallbackUrl({ flow: flowId }),
      },
    });
    if (error) {
      console.error("OAuth sign-in failed:", error);
      setSaving(false);
      setErrorMsg(error.message);
    }
  }, [setErrorMsg, setSaving, userId]);

  const handleMagicLink = useCallback(async () => {
    if (!email) return;
    setSaving(true);
    // Magic links may open in another tab, so this uses the same localStorage
    // capability handoff as Google sign-in.
    const flowId = newFlowId();
    if (userId) await beginPendingTransfer(supabase, localStorage, userId, flowId);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authCallbackUrl({ flow: flowId }) },
    });
    setSaving(false);
    if (error) {
      console.error("Magic link request failed:", error);
      setErrorMsg(error.message);
      return;
    }
    setSaved(true);
  }, [email, setErrorMsg, setSaved, setSaving, userId]);

  return {
    handleGoogleSignIn,
    handleMagicLink,
    handleSignOut,
  };
}
