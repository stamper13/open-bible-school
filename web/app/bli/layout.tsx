import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "How BLI Works | Open Bible Assessment",
  description: "A visual explanation of the Bible Literacy Index scoring model, evidence confidence, and recommendations.",
};

export default function BliLayout({ children }: { children: ReactNode }) {
  return children;
}
