"use client";

import { type Dispatch, type RefObject, type SetStateAction } from "react";
import Starfield, { type StarfieldHandle } from "@/components/Starfield";
import { nebulaStageIndex } from "@/lib/skyStreak";
import BlackHoleEvent from "./BlackHoleEvent";
import { NEBULA_STAGE_NAMES } from "./constants";
import { hashString, skyDiscoveryMilestone } from "./assessmentHelpers";
import { BIBLE_SKY_FACTS } from "./skyFacts";
import type { AssessmentMode, BibleSkyFact, BliEvidence, Phase } from "./types";

type AssessmentAtmosphereProps = {
  assessmentMode: AssessmentMode;
  answeredCount: number;
  attemptId: string | null;
  dismissedSkyDiscoveries: Set<number>;
  evidenceStrength: number;
  isCorrect: boolean | null;
  isDashboardTransitioning: boolean;
  nebulaAnswered: number;
  nebulaCount: number;
  phase: Phase;
  questionId: string | null;
  scoreEvidence: BliEvidence | null;
  setActiveBibleFact: Dispatch<SetStateAction<BibleSkyFact | null>>;
  setDismissedSkyDiscoveries: Dispatch<SetStateAction<Set<number>>>;
  starfieldRef: RefObject<StarfieldHandle | null>;
  userId: string | null;
};

export function AssessmentAtmosphere({
  assessmentMode,
  answeredCount,
  attemptId,
  dismissedSkyDiscoveries,
  evidenceStrength,
  isCorrect,
  isDashboardTransitioning,
  nebulaAnswered,
  nebulaCount,
  phase,
  questionId,
  scoreEvidence,
  setActiveBibleFact,
  setDismissedSkyDiscoveries,
  starfieldRef,
  userId,
}: AssessmentAtmosphereProps) {
  const skyDiscovery = skyDiscoveryMilestone(answeredCount);
  const showSkyDiscovery = Boolean(
    skyDiscovery
    && !dismissedSkyDiscoveries.has(skyDiscovery)
    && (phase === "question" || phase === "feedback")
    && assessmentMode !== "select",
  );

  return (
    <>
      <Starfield
        ref={starfieldRef}
        variant="assess"
        nebulaAnswered={nebulaAnswered}
        evidenceStrength={evidenceStrength}
        isDashboardTransitioning={isDashboardTransitioning}
      />
      <BlackHoleEvent answeredCount={answeredCount} userId={userId} />
      {answeredCount > 0 && !isDashboardTransitioning && (
        <div className="confidence-nebula-label" aria-hidden="true">
          <span>Evidence</span>
          <strong>{scoreEvidence?.evidence_level ?? "Gathering"}</strong>
          <small>
            {scoreEvidence ? `${scoreEvidence.n_responses} responses` : "Updating estimate"}
            {nebulaCount > 0 ? ` · ${NEBULA_STAGE_NAMES[nebulaStageIndex(nebulaCount)]}` : ""}
          </small>
        </div>
      )}
      {isDashboardTransitioning && <div className="dashboard-warp" aria-hidden="true" />}
      {assessmentMode === "NT" && phase === "feedback" && isCorrect && (
        <CosmicBurst burstKey={`${answeredCount}-${questionId || "correct"}`} />
      )}
      {showSkyDiscovery && skyDiscovery && (
        <button
          className="sky-discovery"
          type="button"
          aria-label="Open a Bible fact"
          title="Open a Bible fact"
          onClick={() => {
            const factIndex = hashString(`${attemptId ?? "assessment"}:${skyDiscovery}`) % BIBLE_SKY_FACTS.length;
            setActiveBibleFact(BIBLE_SKY_FACTS[factIndex]);
            setDismissedSkyDiscoveries(current => new Set(current).add(skyDiscovery));
          }}
        />
      )}
    </>
  );
}

function CosmicBurst({ burstKey }: { burstKey: string }) {
  return (
    <div key={burstKey} className="cosmic-burst" aria-hidden="true">
      <Firework className="firework-one" />
      <Firework className="firework-two" />
      <Firework className="firework-three" />
    </div>
  );
}

function Firework({ className }: { className: string }) {
  return (
    <span className={`firework ${className}`}>
      <i className="spark spark-a" />
      <i className="spark spark-b" />
      <i className="spark spark-c" />
      <i className="spark spark-d" />
      <i className="spark spark-e" />
      <i className="spark spark-f" />
    </span>
  );
}
