import { supabase } from "@/lib/supabase/client";

export type PublicQuestionMetadataRow = {
  generated_question_id: string;
  question_type: string | null;
  dimension_key: string | null;
  question_layer: number | null;
  book_code: string | null;
  routing_score: number | null;
  importance_conceptual: number | null;
  importance_context: number | null;
};

const PAGE_SIZE = 1000;
export async function loadPublicQuestionMetadata(): Promise<PublicQuestionMetadataRow[]> {
  const rows: PublicQuestionMetadataRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.rpc("obs_get_public_question_metadata", {
      p_offset: offset,
      p_limit: PAGE_SIZE,
    });

    if (error) throw error;

    const page = (data ?? []) as unknown as PublicQuestionMetadataRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) return rows;
  }
}
