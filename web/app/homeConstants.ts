// Small standalone constants for the home dashboard: the sessionStorage keys
// it shares with the assess flow, and static config (retest wait window,
// dashboard subject tabs). Split out of homeHelpers.ts — mirrors
// app/assess/constants.ts doing the same job for the assess flow.

import {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
  OT_ATTEMPT_ID_KEY,
  NT_ATTEMPT_ID_KEY,
  LOCAL_ANSWERED_KEY,
  LOCAL_CORRECT_KEY,
  LOCAL_ATTEMPT_ID_KEY,
} from "@/lib/assessmentSessionKeys";
import type { DashboardTab } from "./homeTypes";

export {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
  OT_ATTEMPT_ID_KEY,
  NT_ATTEMPT_ID_KEY,
  LOCAL_ANSWERED_KEY,
  LOCAL_CORRECT_KEY,
  LOCAL_ATTEMPT_ID_KEY,
};

// UI STATE ONLY. Marks that the signed-out learner closed the save-progress
// popup, so the dashboard leaves the ask to the save-progress slot in the
// score strip instead of re-opening the popup. It lives in sessionStorage on purpose: the snapshot
// the prompt is about (SESSION_ANSWERED_KEY / SESSION_CORRECT_KEY) is
// session-scoped too, so the dismissal dies with the result it dismissed.
export const SAVE_PROMPT_DISMISSED_KEY = "obs_save_prompt_dismissed";

export const RECOMMENDATION_RETEST_WAIT_MS = 20 * 60 * 1000;

export const DASHBOARD_SUBJECTS: Array<{
  id: DashboardTab;
  label: string;
  subtitle: string;
  color: string;
  soon: boolean;
  /** Trigger label for narrow headers, where the full name will not fit. */
  short: string;
}> = [
  { id: "bli", label: "Bible Assessment", subtitle: "OT, NT, and combined literacy", color: "#0aa3a3", soon: false, short: "Bible" },
  { id: "church-history", label: "Church History", subtitle: "Coming soon", color: "#d4a017", soon: true, short: "History" },
  { id: "biblical-languages", label: "Biblical Languages", subtitle: "Coming soon", color: "#7c3aed", soon: true, short: "Languages" },
];
