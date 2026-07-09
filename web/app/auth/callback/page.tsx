"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Exchange code for session
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          router.push("/");
          return;
        }

        const newUserId = session.user.id;

        // Try all sources for anonymous user ID
        const anonFromUrl = params.get("anon");
        const anonFromLocal = localStorage.getItem("obs_anon_user_id");
        const anonFromSession = sessionStorage.getItem("obs_anon_user_id");
        const anonUserId = anonFromUrl || anonFromLocal || anonFromSession;

        console.log("Sources - URL:", anonFromUrl, "Local:", anonFromLocal, "Session:", anonFromSession);
        console.log("Migration: anon =", anonUserId, "new =", newUserId);

        if (anonUserId && anonUserId !== newUserId && anonUserId.length > 10) {
          const { data, error } = await supabase.rpc("migrate_anonymous_data", {
            p_anonymous_user_id: anonUserId,
            p_new_user_id: newUserId,
          });

          if (error) {
            console.error("Migration error:", error);
          } else {
            console.log("Migration result:", data);
          }
        }

        localStorage.removeItem("obs_anon_user_id");
        sessionStorage.removeItem("obs_anon_user_id");
        router.push("/");
      } catch (err) {
        console.error("Auth callback error:", err);
        router.push("/");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh", background: "#0b0f1e",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Inter, system-ui, sans-serif"
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "3px solid rgba(255,255,255,.1)",
          borderTopColor: "#0aa3a3",
          animation: "spin .8s linear infinite",
          margin: "0 auto 16px"
        }} />
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: 14 }}>
          Signing you in and saving your progress...
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
