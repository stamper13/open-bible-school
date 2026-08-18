import type { BliEvidence, Choice, NtSectionKey, ReportCategory } from "./types";
import {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
  OT_ATTEMPT_ID_KEY,
  NT_ATTEMPT_ID_KEY,
} from "@/lib/assessmentSessionKeys";

export {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
  OT_ATTEMPT_ID_KEY,
  NT_ATTEMPT_ID_KEY,
};

export const SECTION_COLORS: Record<string, string> = {
  "Torah": "#d4a017",
  "Former Prophets": "#0e8c6a",
  "Latter Prophets": "#2563c4",
  "Writings": "#7c3aed",
  "Old Testament": "#0aa3a3",
};

export const IDK_CHOICE_ID = "__IDK__";
export const IDK_CHOICE: Choice = { id: IDK_CHOICE_ID, text: "I don't know" };

export const TOTAL_INITIAL = 20;
export const NT_PILOT_TARGET = 20;
export const NT_PILOT_ENABLED = process.env.NEXT_PUBLIC_NT_PILOT_ENABLED !== "false";

export const NT_SECTION_LABELS: Record<NtSectionKey, string> = {
  GOSPELS_ACTS: "Gospels and Acts",
  PAULINE: "Pauline Epistles",
  GENERAL: "General Epistles",
  APOCALYPSE: "Revelation",
};

export const NT_SECTION_RPC_VALUES: Record<NtSectionKey, string> = {
  GOSPELS_ACTS: "Gospels_Acts",
  PAULINE: "Pauline",
  GENERAL: "General",
  APOCALYPSE: "Apocalypse",
};

export const NEBULA_STAGE_NAMES = ["Wisp", "Nebula", "Ignition", "Stellar nursery", "Deep field"];

export const EVIDENCE_VISUAL_STRENGTH: Record<BliEvidence["evidence_level"], number> = {
  "Very limited": 18,
  "Limited": 36,
  "Developing": 58,
  "Strong": 80,
  "Very strong": 96,
};

export const REPORT_OPTIONS: { value: ReportCategory; label: string }[] = [
  { value: "wrong_answer", label: "Wrong answer" },
  { value: "inaccurate", label: "Inaccurate" },
  { value: "poorly_worded", label: "Poorly worded" },
  { value: "other", label: "Other" },
];
