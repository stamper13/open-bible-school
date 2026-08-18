"use client";

// The home dashboard's three top-of-page popover menus (account, "Learn
// More", subject switcher): open state, the ref each one's outside-click
// check needs, and the one shared "close on outside click or Escape"
// effect. Split out of HomePage's ~1300-line body — this cluster only
// ever talked to itself and the JSX that renders the menus, so it moves
// cleanly. Returns the same values/setters HomePage previously declared
// inline; callers that need to force a menu closed (e.g. on sign-out)
// still just call the returned setter.

import { useEffect, useRef, useState } from "react";

export function useNavMenus() {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [learnMoreOpen, setLearnMoreOpen] = useState(false);
  const learnMoreRef = useRef<HTMLDivElement>(null);
  const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
  const subjectMenuRef = useRef<HTMLDivElement>(null);

  // Close open nav menus on an outside click or Escape.
  useEffect(() => {
    if (!accountMenuOpen && !learnMoreOpen && !subjectMenuOpen) return;
    const onPointer = (event: globalThis.MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
      if (learnMoreRef.current && !learnMoreRef.current.contains(event.target as Node)) {
        setLearnMoreOpen(false);
      }
      if (subjectMenuRef.current && !subjectMenuRef.current.contains(event.target as Node)) {
        setSubjectMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        setLearnMoreOpen(false);
        setSubjectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountMenuOpen, learnMoreOpen, subjectMenuOpen]);

  return {
    accountMenuOpen,
    setAccountMenuOpen,
    accountMenuRef,
    learnMoreOpen,
    setLearnMoreOpen,
    learnMoreRef,
    subjectMenuOpen,
    setSubjectMenuOpen,
    subjectMenuRef,
  };
}
