import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { NT_PILOT_ENABLED } from "./constants";
import { normalizeNtSection } from "./assessmentHelpers";
import type { AssessmentMode, NtBookMetadata } from "./types";

export function useNtBookMetadata({
  assessmentMode,
  modeReady,
}: {
  assessmentMode: AssessmentMode;
  modeReady: boolean;
}) {
  const [ntBooks, setNtBooks] = useState<NtBookMetadata[]>([]);
  const [ntMetadataLoaded, setNtMetadataLoaded] = useState(false);
  const [ntError, setNtError] = useState("");

  useEffect(() => {
    if (!modeReady || assessmentMode !== "NT" || !NT_PILOT_ENABLED) return;
    let cancelled = false;

    supabase
      .from("scripture_books")
      .select("book_code,canon_order,name,nt_division")
      .eq("testament", "NT")
      .order("canon_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setNtError(error.message);
          setNtMetadataLoaded(true);
          return;
        }

        const rows = (data ?? [])
          .map(row => {
            const ntDivision = typeof row.nt_division === "string" ? normalizeNtSection(row.nt_division) : null;
            if (
              typeof row.book_code === "string" &&
              typeof row.canon_order === "number" &&
              typeof row.name === "string" &&
              ntDivision
            ) {
              return {
                book_code: row.book_code,
                canon_order: row.canon_order,
                name: row.name,
                nt_division: ntDivision,
              };
            }
            return null;
          })
          .filter((row): row is NtBookMetadata => row !== null)
          .sort((a, b) => a.canon_order - b.canon_order);
        setNtBooks(rows);
        setNtMetadataLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [assessmentMode, modeReady]);

  return {
    ntBooks,
    ntError,
    ntMetadataLoaded,
    setNtError,
  };
}
