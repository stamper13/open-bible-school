export type StarfieldHandle = {
  /** assess variant only: record the screen point an answer was submitted
   * from, so the next spawnTraveler() call launches a star from there. */
  setPendingSpawn: (x: number, y: number) => void;
  /** assess variant only: cancel a pending spawn point without launching a
   * traveler -- used when a new question starts loading before the previous
   * answer's traveler fired. */
  clearPendingSpawn: () => void;
  /** assess variant only: launch a "traveler" star toward the corner
   * evidence icon from the last setPendingSpawn() point. */
  spawnTraveler: () => void;
  /** assess variant only: nudge the sky sideways -- used after answering so
   * consecutive questions don't sit on an identical background. */
  shiftSky: () => void;
  /** assess variant only: read the current animation frame and sky offset,
   * for handing off to the home dashboard's sky on transition. */
  getHandoffState: () => { frame: number; offset: { x: number; y: number } };
};

export type HomeVariantProps = {
  variant: "home";
  /** Whether the domain-constellation overlay should be active right now. */
  constellationActive: boolean;
  constellationPoints: { angle: number; pct: number }[];
};

export type AssessVariantProps = {
  variant: "assess";
  /** Drives the nebula's growth stage. */
  nebulaAnswered: number;
  /** 0-96ish; the visual strength the nebula's growth/glow scales with. */
  evidenceStrength: number;
  isDashboardTransitioning: boolean;
};

export type KnowledgeMapVariantProps = {
  variant: "knowledgeMap";
  motionPaused?: boolean;
};

export type StarfieldProps = HomeVariantProps | AssessVariantProps | KnowledgeMapVariantProps;

