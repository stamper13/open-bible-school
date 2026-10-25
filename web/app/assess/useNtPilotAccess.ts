import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isNtPilotEmail, NT_PILOT_ENABLED } from "./constants";

export function useNtPilotAccess() {
  const [allowed, setAllowed] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const applySession = (email: string | null | undefined) => {
      if (cancelled) return;
      setAllowed(NT_PILOT_ENABLED && isNtPilotEmail(email));
      setResolved(true);
    };

    void supabase.auth.getSession()
      .then(({ data }) => {
        applySession(data.session?.user?.email);
      })
      .catch(() => {
        applySession(null);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user?.email);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { allowed, resolved };
}
