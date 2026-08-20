const TRANSITION_ARRIVING_KEY = "obs_dashboard_arriving";
const TRANSITION_ROTATION_KEY = "obs_dashboard_sky_rotation";
const TRANSITION_FRAME_KEY = "obs_dashboard_sky_frame";
const TRANSITION_OFFSET_KEY = "obs_dashboard_sky_offset";

export function readDashboardSkyHandoff() {
  const isArrivingFromAssessment = sessionStorage.getItem(TRANSITION_ARRIVING_KEY) === "1";
  const rotation = isArrivingFromAssessment
    ? Number(sessionStorage.getItem(TRANSITION_ROTATION_KEY) || 0)
    : 0;
  const frame = isArrivingFromAssessment
    ? Number(sessionStorage.getItem(TRANSITION_FRAME_KEY) || 0)
    : 0;

  let offset = { x: 0, y: 0 };
  if (isArrivingFromAssessment) {
    try {
      offset = JSON.parse(sessionStorage.getItem(TRANSITION_OFFSET_KEY) || "{}") || offset;
    } catch {}
  }

  return { isArrivingFromAssessment, rotation, frame, offset };
}

export function clearDashboardSkyHandoff() {
  sessionStorage.removeItem(TRANSITION_ARRIVING_KEY);
  sessionStorage.removeItem(TRANSITION_ROTATION_KEY);
  sessionStorage.removeItem(TRANSITION_FRAME_KEY);
  sessionStorage.removeItem(TRANSITION_OFFSET_KEY);
}

