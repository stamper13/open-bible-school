import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Future Ideas | Open Bible Assessment",
  description: "Future ideas for supervised assessments, credentials, and study pathways.",
};

export default function CredentialLayout({ children }: { children: ReactNode }) {
  return children;
}
