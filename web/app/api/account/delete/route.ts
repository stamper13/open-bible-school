import { NextResponse } from "next/server";
import {
  ACCOUNT_DELETION_FALLBACK_TABLES,
  isMissingRelationError,
} from "@/lib/accountDeletion";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// These cascade from auth.users and need no explicit public fallback delete,
// recorded here so the full blast radius is documented in one place:
//   obs_assessment_snapshots, obs_ot_attempt_context, obs_study_plan_events,
//   question_reports, user_abilities, obs_starfield_rewards, public.users,
//   and all auth.* rows. Each was verified against the live schema to carry
//   ON DELETE CASCADE.
// obs_reading_log_entries reads like it belongs on that list but has no foreign
// key at all, so nothing cascades it away; it is cleared explicitly in
// ACCOUNT_DELETION_FALLBACK_TABLES instead.
// credential_exams.candidate_user_id is ON DELETE SET NULL — the exam record
// survives, anonymized, rather than being destroyed.
//
// Private cleanup still needs the planned obs_delete_account_owned_data RPC:
//   private.bli_answer_scoring_evidence references assessment_answers with
//   ON DELETE RESTRICT, and private.obs_anonymous_transfer_tokens has a
//   claimed_by_user_id FK without cascade.

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
  for (const table of ACCOUNT_DELETION_FALLBACK_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    if (error) {
      // A missing table is survivable during schema drift.
      // Anything else means we would be deleting the auth user while personal data
      // remains, so stop before that happens and report honestly.
      if (!isMissingRelationError(error)) {
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
