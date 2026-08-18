import type { ReactNode } from "react";

/**
 * The full-width "still in beta" strip shown at the top of the about,
 * credential, and bli pages. Previously each page had a byte-for-byte
 * identical copy of both the JSX and the .beta-banner/.beta-badge CSS
 * (including the same media-query override) — kept here once, styled in
 * globals.css under the oba- prefix so it can't collide with the
 * differently-styled .beta-badge nav pill the home/assess pages already use.
 */
export default function BetaBanner({
  label = "Beta",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="oba-beta-banner">
      <span className="oba-beta-badge">{label}</span>
      {children}
    </div>
  );
}
