export const SECTION_INTERPRETATION_FLOOR = 15;
export const SECTION_ESTABLISHED_EVIDENCE = 30;

export type EvidenceConfidence = "none" | "low" | "moderate" | "high";
export type SectionEvidenceStatus = "untested" | "provisional" | "developing" | "established";

export type SectionEvidence = {
  answered: number;
  confidence: EvidenceConfidence;
  status: SectionEvidenceStatus;
  isProvisional: boolean;
  canInterpret: boolean;
  answersToInterpretation: number;
  answersToEstablished: number;
  label: string;
};

export function sectionEvidence(answeredValue: number): SectionEvidence {
  const answered = Math.max(0, Math.floor(Number.isFinite(answeredValue) ? answeredValue : 0));
  const answersToInterpretation = Math.max(0, SECTION_INTERPRETATION_FLOOR - answered);
  const answersToEstablished = Math.max(0, SECTION_ESTABLISHED_EVIDENCE - answered);

  if (answered === 0) {
    return {
      answered,
      confidence: "none",
      status: "untested",
      isProvisional: true,
      canInterpret: false,
      answersToInterpretation,
      answersToEstablished,
      label: "Needs more evidence",
    };
  }

  if (answered < SECTION_INTERPRETATION_FLOOR) {
    return {
      answered,
      confidence: answered >= 8 ? "moderate" : "low",
      status: "provisional",
      isProvisional: true,
      canInterpret: false,
      answersToInterpretation,
      answersToEstablished,
      label: `Provisional · ${answersToInterpretation} to go`,
    };
  }

  if (answered < SECTION_ESTABLISHED_EVIDENCE) {
    return {
      answered,
      confidence: "moderate",
      status: "developing",
      isProvisional: false,
      canInterpret: true,
      answersToInterpretation,
      answersToEstablished,
      label: "Developing evidence",
    };
  }

  return {
    answered,
    confidence: "high",
    status: "established",
    isProvisional: false,
    canInterpret: true,
    answersToInterpretation,
    answersToEstablished,
    label: "Established evidence",
  };
}

export type FollowupCandidate = {
  key: string;
  label: string;
  backendScopeKey: string;
  answered: number;
};

const OT_SECTION_ORDER = new Map([
  ["Torah", 0],
  ["Former Prophets", 1],
  ["Latter Prophets", 2],
  ["Writings", 3],
]);

export function leastEvidenceSection<T extends FollowupCandidate>(sections: T[]): T | null {
  const candidates = sections
    .filter(section => OT_SECTION_ORDER.has(section.label))
    .filter(section => sectionEvidence(section.answered).isProvisional)
    .sort((left, right) => (
      left.answered - right.answered
      || (OT_SECTION_ORDER.get(left.label) ?? 99) - (OT_SECTION_ORDER.get(right.label) ?? 99)
    ));

  return candidates[0] ?? null;
}
