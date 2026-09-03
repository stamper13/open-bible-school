import {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  LOCAL_ANSWERED_KEY,
  LOCAL_ATTEMPT_ID_KEY,
  LOCAL_CORRECT_KEY,
  NT_ATTEMPT_ID_KEY,
  OT_ATTEMPT_ID_KEY,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
} from "@/lib/assessmentSessionKeys";

type Testament = "OT" | "NT";

type AssessmentProgressSnapshot = {
  answered: number;
  attemptId: string | null;
  correct: number;
  durable?: boolean;
  anonymousUserId?: string | null;
  testament: Testament;
};

function persist(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch (error) {
    console.warn(`Could not persist ${key}:`, error);
  }
}

export function persistAssessmentProgressSnapshot({
  answered,
  attemptId,
  correct,
  durable = true,
  anonymousUserId = null,
  testament,
}: AssessmentProgressSnapshot) {
  if (typeof window === "undefined") return;

  const safeAnswered = Math.max(0, Math.round(Number.isFinite(answered) ? answered : 0));
  const safeCorrect = Math.max(0, Math.min(Math.round(Number.isFinite(correct) ? correct : 0), safeAnswered));

  persist(sessionStorage, SESSION_ANSWERED_KEY, String(safeAnswered));
  persist(sessionStorage, SESSION_CORRECT_KEY, String(safeCorrect));
  if (attemptId) {
    persist(sessionStorage, testament === "NT" ? NT_ATTEMPT_ID_KEY : OT_ATTEMPT_ID_KEY, attemptId);
  }

  if (anonymousUserId) {
    persist(sessionStorage, ANON_SESSION_ACTIVE_KEY, "1");
    persist(sessionStorage, ANON_USER_ID_KEY, anonymousUserId);
    persist(localStorage, ANON_USER_ID_KEY, anonymousUserId);
  }

  if (!durable || testament !== "OT") return;
  persist(localStorage, LOCAL_ANSWERED_KEY, String(safeAnswered));
  persist(localStorage, LOCAL_CORRECT_KEY, String(safeCorrect));
  if (attemptId) persist(localStorage, LOCAL_ATTEMPT_ID_KEY, attemptId);
}
