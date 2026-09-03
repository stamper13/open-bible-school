// sessionStorage/localStorage keys shared between the home dashboard
// (app/page.tsx) and the assess flow (app/assess/page.tsx) — this is how the
// two pages agree on "has this browser started/finished an assessment"
// without a signed-in user. Previously each page declared its own copy of
// these same string literals; a rename on one side with no compiler error
// on the other would have silently broken that handoff. Single source of
// truth now — both sides re-export from here.
export const ANON_SESSION_ACTIVE_KEY = "obs_anon_session_active";
export const ANON_USER_ID_KEY = "obs_anon_user_id";
export const SESSION_ANSWERED_KEY = "obs_session_answered";
export const SESSION_CORRECT_KEY = "obs_session_correct";
export const OT_ATTEMPT_ID_KEY = "obs_ot_attempt_id";
export const NT_ATTEMPT_ID_KEY = "obs_nt_attempt_id";
export const LOCAL_ANSWERED_KEY = "obs_answered";
export const LOCAL_CORRECT_KEY = "obs_correct";
export const LOCAL_ATTEMPT_ID_KEY = "obs_attempt_id";
