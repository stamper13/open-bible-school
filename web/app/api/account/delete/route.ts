import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Tables holding the user's data that do NOT cascade from auth.users and must be
// cleared explicitly. Verified against the live schema: assessment_attempts carries
// no foreign key at all, and the rest were created without one, so deleting the auth
// user alone would leave these rows orphaned but still keyed to the user's id.
//
// Order matters only for the first two: answers reference their attempt.
const ORPHAN_TABLES = [
  "assessment_answers",
  "assessment_attempts",
  "obs_answer_evidence",
  "obs_router_shadow_log",
  "user_foundation_status",
  "user_skill_ratings",
  // Analysis and backup snapshots taken during past migrations. They carry user_id,
  // so they are purged too — a deletion request should not leave copies behind.
  "obs_20260726_ability_before_answer_eligibility",
  "obs_biblical_taxonomy_ability_backup",
  "obs_biblical_taxonomy_bli_baseline",
  "obs_idk_recompute_before",
  "obs_idk_recompute_old_model",
  "obs_idk_scope_census",
];

// These cascade from auth.users and need no explicit delete, recorded here so the
// full blast radius is documented in one place:
//   obs_assessment_snapshots, obs_ot_attempt_context, obs_study_plan_events,
//   question_reports, user_abilities, public.users, and all auth.* rows.
// credential_exams.candidate_user_id is ON DELETE SET NULL — the exam record
// survives, anonymized, rather than being destroyed.

function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return privateJson(
      { error: "Account deletion is not configured on this environment." },
      { status: 503 },
    );
  }

  // The caller may only ever delete themselves: the id comes from the verified
  // token, never from the request body.
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    return privateJson({ error: "Sign in is required." }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) {
    return privateJson({ error: "The current session is not valid." }, { status: 401 });
  }

  // Require the typed confirmation to match the account being deleted, so a stray
  // POST from a live session cannot destroy an account on its own.
  let confirmEmail = "";
  try {
    const body = await request.json();
    confirmEmail = String(body?.confirmEmail ?? "").trim().toLowerCase();
  } catch {
    return privateJson({ error: "A confirmation is required." }, { status: 400 });
  }

  if (!confirmEmail || confirmEmail !== (user.email ?? "").trim().toLowerCase()) {
    return privateJson(
      { error: "The confirmation did not match the signed-in email address." },
      { status: 400 },
    );
  }

  const cleared: string[] = [];
  for (const table of ORPHAN_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    if (error) {
      // A missing table is survivable — the analysis snapshots may be dropped later.
      // Anything else means we would be deleting the auth user while personal data
      // remains, so stop before that happens and report honestly.
      const missingTable = error.code === "42P01";
      if (!missingTable) {
        return privateJson(
          {
            error: `Deletion stopped while clearing ${table}. No account was removed. Please try again or get in touch.`,
            cleared,
          },
          { status: 500 },
        );
      }
      continue;
    }
    cleared.push(table);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return privateJson(
      { error: "Your data was cleared, but the account itself could not be removed. Please get in touch.", cleared },
      { status: 500 },
    );
  }

  return privateJson({ ok: true, cleared });
}
