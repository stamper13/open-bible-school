"use client";

// Animated canvas starfield backgrounds.
//
// The three variants intentionally keep their drawing logic separate because
// each page has its own visual behavior: the home dashboard maps stars onto
// the score constellation, the assessment screen grows an evidence nebula,
// and the knowledge map uses a quieter fixed-seed field. This dispatcher keeps
// callers on one import while the implementation stays readable.

import { forwardRef } from "react";
import AssessStarfield from "./starfield/AssessStarfield";
import HomeStarfield from "./starfield/HomeStarfield";
import KnowledgeMapStarfield from "./starfield/KnowledgeMapStarfield";
import type { StarfieldHandle, StarfieldProps } from "./starfield/types";

export type { StarfieldHandle, StarfieldProps } from "./starfield/types";

const Starfield = forwardRef<StarfieldHandle, StarfieldProps>(function Starfield(props, ref) {
  if (props.variant === "home") {
    return <HomeStarfield {...props} />;
  }

  if (props.variant === "assess") {
    return <AssessStarfield {...props} ref={ref} />;
  }

  return <KnowledgeMapStarfield {...props} />;
});

export default Starfield;

