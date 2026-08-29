import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Start Here | Open Bible Assessment",
  description:
    "An interactive tour of Open Bible Assessment: why it exists, how the adaptive assessment works, what the score does and does not mean, and how it picks your next place to read.",
};

export default function IntroLayout({ children }: { children: ReactNode }) {
  return children;
}
