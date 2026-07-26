import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";

type AdminAuthorization =
  | { authorized: true; adminSupabase: SupabaseClient; email: string }
  | { authorized: false; status: number; message: string };

function adminEmailAllowlist() {
  return new Set(
    (process.env.OBS_ADMIN_EMAILS ?? "")
      .split(",")
      .map(email => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function authorizeAdminRequest(request: Request): Promise<AdminAuthorization> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      authorized: false,
      status: 503,
      message: "The admin console is not configured on this environment.",
    };
  }

  const allowlist = adminEmailAllowlist();
  if (allowlist.size === 0) {
    return {
      authorized: false,
      status: 503,
      message: "No admin email allowlist is configured.",
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return { authorized: false, status: 401, message: "Sign in is required." };
  }

  const adminSupabase = createAdminSupabase();
  const { data, error } = await adminSupabase.auth.getUser(token);
  const email = data.user?.email?.trim().toLowerCase() ?? "";
  if (error || !data.user || !email) {
    return { authorized: false, status: 401, message: "The current session is not valid." };
  }
  if (!allowlist.has(email)) {
    return { authorized: false, status: 403, message: "This account is not authorized for question review." };
  }

  return { authorized: true, adminSupabase, email };
}
