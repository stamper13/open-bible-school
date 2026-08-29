import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reading Log | Open Bible Assessment",
  description: "Track what you have read so Open Bible Assessment can time better retests.",
};

export default function ReadingLogLayout({ children }: { children: ReactNode }) {
  return children;
}
