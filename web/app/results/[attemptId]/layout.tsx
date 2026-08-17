import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Results | Open Bible Assessment",
  description: "Review an assessment attempt, score, and answer history.",
};

export default function ResultsLayout({ children }: { children: ReactNode }) {
  return children;
}
