import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "About | Open Bible Assessment",
  description: "Why Open Bible Assessment exists, what it measures, and what it does not claim.",
};

export default function AboutLayout({ children }: { children: ReactNode }) {
  return children;
}
