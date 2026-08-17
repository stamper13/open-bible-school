import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Assessment | Open Bible Assessment",
  description: "Answer adaptive Bible-content questions and build your BLI profile.",
};

export default function AssessLayout({ children }: { children: ReactNode }) {
  return children;
}
