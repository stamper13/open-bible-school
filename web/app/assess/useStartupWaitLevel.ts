import { useEffect, useState } from "react";
import type { AssessmentMode, Phase } from "./types";

export function useStartupWaitLevel(phase: Phase, assessmentMode: AssessmentMode) {
  const [startupWaitLevel, setStartupWaitLevel] = useState<0 | 1 | 2>(0);
  const isWaitingForStartup = phase === "starting" && assessmentMode !== "select";

  useEffect(() => {
    if (!isWaitingForStartup) {
      return;
    }

    const resetTimer = window.setTimeout(() => setStartupWaitLevel(0), 0);
    const slowTimer = window.setTimeout(() => setStartupWaitLevel(1), 3200);
    const verySlowTimer = window.setTimeout(() => setStartupWaitLevel(2), 8000);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(slowTimer);
      window.clearTimeout(verySlowTimer);
    };
  }, [isWaitingForStartup]);

  if (!isWaitingForStartup) {
    return 0;
  }

  return startupWaitLevel;
}
