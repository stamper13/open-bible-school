import BrandLogo from "./BrandLogo";

// The brand logo + "Beta" badge, identical in the home dashboard's and the
// assess flow's nav bars. Previously copy-pasted between app/homeDashboard.tsx
// and app/assess/assessCore.tsx; kept here as the one place that copy lives.
export default function BrandMark() {
  return (
    <span className="brand-wrap">
      <BrandLogo className="nav-brand" />
      <span className="beta-badge" tabIndex={0}>
        Beta
        <span className="beta-tooltip" role="tooltip">
          Open Bible Assessment is still in active development. Scores and questions are being refined, so your results may shift as the platform matures.
        </span>
      </span>
    </span>
  );
}
