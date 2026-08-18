"use client";

// The score strip's two hover/click popovers: the "ⓘ" BLI-info tooltip
// (pure hover, closes on a short delay so moving from the button to the
// link inside it doesn't flicker it shut) and the level badge's popover
// (opens on click, stays open while focus/pointer is inside it, and closes
// when the active testament changes so it never lingers open showing the
// previous testament's copy). Split out of HomePage's ~1300-line body —
// this cluster only ever talked to itself.

import { useRef, useState } from "react";
import type { Testament as BibleTestament } from "@/lib/bibleTaxonomy";

export function useScoreTooltips(suiteTestament: BibleTestament) {
  const [showBliTooltip, setShowBliTooltip] = useState(false);
  const [showEvidenceTooltip, setShowEvidenceTooltip] = useState(false);
  const [showLevelTooltip, setShowLevelTooltip] = useState(false);
  const tooltipCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelTooltipCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The level popover describes whichever testament is active; close it on
  // switch so it doesn't linger open showing the previous testament's copy.
  // Adjusted during render (React's recommended pattern for "reset state
  // when a prop changes") rather than in an effect, which would cause an
  // extra render on every testament switch.
  const [prevTestament, setPrevTestament] = useState(suiteTestament);
  if (suiteTestament !== prevTestament) {
    setPrevTestament(suiteTestament);
    setShowLevelTooltip(false);
  }

  const openBliTooltip = () => {
    if (tooltipCloseRef.current) clearTimeout(tooltipCloseRef.current);
    setShowBliTooltip(true);
  };
  const closeBliTooltipSoon = () => {
    if (tooltipCloseRef.current) clearTimeout(tooltipCloseRef.current);
    tooltipCloseRef.current = setTimeout(() => setShowBliTooltip(false), 220);
  };

  // The level badge (e.g. "Literate") opens its explanation on click, not
  // hover — hover only lights the badge up via CSS. These handlers just keep
  // the popover open while focus/pointer is still inside it (button or the
  // "Learn more" link) and close it shortly after both are left.
  const cancelLevelTooltipClose = () => {
    if (levelTooltipCloseRef.current) clearTimeout(levelTooltipCloseRef.current);
  };
  const closeLevelTooltipSoon = () => {
    if (levelTooltipCloseRef.current) clearTimeout(levelTooltipCloseRef.current);
    levelTooltipCloseRef.current = setTimeout(() => setShowLevelTooltip(false), 220);
  };

  return {
    showBliTooltip,
    setShowBliTooltip,
    showEvidenceTooltip,
    setShowEvidenceTooltip,
    showLevelTooltip,
    setShowLevelTooltip,
    openBliTooltip,
    closeBliTooltipSoon,
    cancelLevelTooltipClose,
    closeLevelTooltipSoon,
  };
}
