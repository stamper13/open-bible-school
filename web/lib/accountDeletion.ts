// Public-schema fallback for the account deletion route.
//
// A complete cleanup needs the planned `obs_delete_account_owned_data` RPC,
// because private.bli_answer_scoring_evidence blocks deleting some answers.
// Keep this list limited to existing, writable public tables only.
export const ACCOUNT_DELETION_FALLBACK_TABLES = [
  "obs_router_shadow_log",
  // Carries user_id but has no foreign key to auth.users at all, so nothing
  // cascades it away. Without this entry a deleted account's reading log
  // survives, still keyed to the removed user's id.
  "obs_reading_log_entries",
  // Answers reference their attempt, so they must be cleared first.
  "assessment_answers",
  "assessment_attempts",
] as const;

export const ACCOUNT_DELETION_REQUIRED_RPC = "obs_delete_account_owned_data";

export function isMissingRelationError(error: { code?: string } | null | undefined) {
  return error?.code === "42P01";
}
