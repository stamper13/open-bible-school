import { type RefObject, useCallback, useState } from "react";
import type { StarfieldHandle } from "@/components/Starfield";

export function useDashboardTransition(starfieldRef: RefObject<StarfieldHandle | null>) {
  const [isDashboardTransitioning, setIsDashboardTransitioning] = useState(false);

  const transitionToDashboard = useCallback(() => {
    if (isDashboardTransitioning) return;
    setIsDashboardTransitioning(true);
    sessionStorage.setItem("obs_dashboard_arriving", "1");
    sessionStorage.setItem("obs_dashboard_sky_rotation", "90");
    window.setTimeout(() => {
      const handoff = starfieldRef.current?.getHandoffState();
      if (handoff) {
        sessionStorage.setItem("obs_dashboard_sky_frame", String(handoff.frame));
        sessionStorage.setItem("obs_dashboard_sky_offset", JSON.stringify(handoff.offset));
      }
      window.location.href = "/";
    }, 2350);
  }, [isDashboardTransitioning, starfieldRef]);

  return {
    isDashboardTransitioning,
    transitionToDashboard,
  };
}
