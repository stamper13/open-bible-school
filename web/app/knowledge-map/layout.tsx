import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Knowledge Map | Open Bible Assessment",
  description: "Explore your Bible knowledge profile, recommended passage, and Old Testament map.",
};

export default function KnowledgeMapLayout({ children }: { children: ReactNode }) {
  return children;
}
