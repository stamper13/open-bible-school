"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { levelForScore, toDisplayScore } from "@/lib/bli";
import {
  BIBLE_BOOKS,
  BOOK_NAMES,
  SECTION_BOOKS,
  type OldTestamentSectionName,
} from "@/lib/bibleTaxonomy";
import { supabase } from "@/lib/supabase/client";
import {
  loadPublicQuestionMetadata,
  type PublicQuestionMetadataRow,
} from "@/lib/supabase/questionMetadata";
import StarMap, {
  type MoonNode,
  type SectionNode,
  type StarNode,
} from "./StarMap";

type SectionKey = OldTestamentSectionName;
type DimensionKey =
  | "characters_lineage"
  | "events_timeline"
  | "geography_nations"
  | "law_commands"
  | "promise_prophecy"
  | "theological_reasoning"
  | "structure_cross_ref";

type AnswerRow = {
  generated_question_id: string | null;
  is_correct: boolean | null;
  is_idk: boolean | null;
  scoring_eligible: boolean | null;
};

type BackendRecommendation = {
  unit_key: string;
  label: string;
  section: string;
  book_code: string;
  start_chapter: number;
  end_chapter: number;
  answered: number;
  display_score: number | null;
  retest_question_target: number;
  focus_text: string;
  reason: string;
  recommendation_kind: "UNIT" | "DIMENSION";
  dimension_key: string | null;
  dimension_label: string | null;
  dimension_short_label: string | null;
  dimension_answered: number | null;
  dimension_correct: number | null;
  dimension_display_score: number | null;
  dimension_available_questions: number | null;
  dimension_focus_text: string | null;
};

type EvidenceRow = {
  bookCode: string;
  section: SectionKey;
  dimension: DimensionKey;
  isCorrect: boolean;
  weight: number;
};

type KnowledgeScore = {
  key: string;
  label: string;
  bookCode?: string;
  answered: number;
  correct: number;
  bankCount: number;
  rawScore: number | null;
  displayScore: number | null;
};

type KnowledgeState = {
  key: "untested" | "early" | "review" | "developing" | "established" | "strong";
  label: string;
  color: string;
  copy: string;
};

const SECTIONS: Array<{
  key: SectionKey;
  className: string;
  color: string;
  books: string[];
  range: string;
  role: string;
  description: string;
}> = [
  {
    key: "Torah",
    className: "torah",
    color: "#d4a017",
    books: SECTION_BOOKS.Torah,
    range: "Genesis - Deuteronomy",
    role: "Foundation",
    description: "Creation, covenant, exodus, Sinai, law, and wilderness form the base for everything that follows.",
  },
  {
    key: "Former Prophets",
    className: "former",
    color: "#0e8c6a",
    books: SECTION_BOOKS["Former Prophets"],
    range: "Joshua - Kings",
    role: "Narrative spine",
    description: "Land, judges, monarchy, division, decline, and exile extend the Torah story into Israel's history.",
  },
  {
    key: "Latter Prophets",
    className: "latter",
    color: "#2563c4",
    books: SECTION_BOOKS["Latter Prophets"],
    range: "Isaiah - Malachi",
    role: "Prophetic interpretation",
    description: "The prophets interpret covenant failure and announce judgment, restoration, and future hope.",
  },
  {
    key: "Writings",
    className: "writings",
    color: "#7c3aed",
    books: SECTION_BOOKS.Writings,
    range: "Psalms, Wisdom, Scrolls",
    role: "Wisdom and reflection",
    description: "Poetry, worship, wisdom, suffering, and post-exilic reflection deepen the established narrative.",
  },
];

const DIMENSIONS: Array<{
  key: DimensionKey;
  label: string;
  short: string;
  description: string;
}> = [
  {
    key: "characters_lineage",
    label: "Characters & Lineage",
    short: "Who",
    description: "People, relationships, ancestry, and personal roles.",
  },
  {
    key: "events_timeline",
    label: "Events & Timeline",
    short: "What & when",
    description: "Narrative movement, sequence, chronology, and duration.",
  },
  {
    key: "geography_nations",
    label: "Geography & Nations",
    short: "Where",
    description: "Places, regions, peoples, kingdoms, and geopolitical setting.",
  },
  {
    key: "law_commands",
    label: "Law & Commands",
    short: "Rules & stakes",
    description: "Commands, covenant obligations, and their stated consequences.",
  },
  {
    key: "promise_prophecy",
    label: "Promise & Prophecy",
    short: "Divine declarations",
    description: "Promises, warnings, prophetic verdicts, and future hope.",
  },
  {
    key: "theological_reasoning",
    label: "Theological Reasoning",
    short: "Meaning",
    description: "The text's theological reflection, logic, and interpretation.",
  },
  {
    key: "structure_cross_ref",
    label: "Structure & Cross Ref",
    short: "Connections",
    description: "Book structure, literary placement, and backward textual connections.",
  },
];

const SECTION_SCOPE_KEYS: Record<SectionKey, string> = {
  Torah: "TORAH",
  "Former Prophets": "FORMER",
  "Latter Prophets": "LATTER",
  Writings: "WRITINGS",
};

const OT_BOOKS = BIBLE_BOOKS.filter((book) => book.testament === "OT");

function dimensionForRow(row: PublicQuestionMetadataRow): DimensionKey {
  const key = row.dimension_key as DimensionKey | null;
  if (key && DIMENSIONS.some((dimension) => dimension.key === key)) return key;

  const questionType = (row.question_type ?? "").toLowerCase();
  if (questionType.includes("relationship") || questionType.includes("lineage") || questionType.includes("genealogy") || questionType.includes("character")) return "characters_lineage";
  if (questionType.includes("geography") || questionType.includes("location") || questionType.includes("nation") || questionType.includes("empire")) return "geography_nations";
  if (questionType.includes("command") || questionType.includes("law") || questionType.includes("covenant_curse")) return "law_commands";
  if (questionType.includes("promise") || questionType.includes("prophecy") || questionType.includes("prophetic") || questionType.includes("speech")) return "promise_prophecy";
  if (questionType.includes("structure") || questionType.includes("cross_ref") || questionType.includes("intertextual")) return "structure_cross_ref";
  if (questionType.includes("significance") || questionType.includes("concept") || questionType.includes("wisdom") || questionType.includes("theological")) return "theological_reasoning";
  return "events_timeline";
}

function scoreEvidence(rows: EvidenceRow[]) {
  const possible = rows.reduce((sum, row) => sum + row.weight, 0);
  if (possible <= 0) return null;
  const earned = rows.reduce(
    (sum, row) => sum + row.weight * (row.isCorrect ? 1 : 0),
    0,
  );
  const observed = earned / possible;
  return Math.max(0, Math.min(100, ((observed - 0.25) / 0.75) * 100));
}

function knowledgeState(score: KnowledgeScore): KnowledgeState {
  if (score.answered === 0 || score.displayScore === null) {
    return {
      key: "untested",
      label: "Untested",
      color: "#7b8493",
      copy: "There is not enough evidence to place this area yet.",
    };
  }
  if (score.answered < 3) {
    return {
      key: "early",
      label: "Early evidence",
      color: "#6b7f8a",
      copy: "A few answers are present, but the result is still uncertain.",
    };
  }
  if (score.displayScore < 313) {
    return {
      key: "review",
      label: "Needs review",
      color: "#c2410c",
      copy: "Current evidence suggests that the basic shape of this area needs rebuilding.",
    };
  }
  if (score.displayScore < 513) {
    return {
      key: "developing",
      label: "Developing",
      color: "#d4a017",
      copy: "Important knowledge is present, but the connections are not stable yet.",
    };
  }
  if (score.displayScore < 633) {
    return {
      key: "established",
      label: "Established",
      color: "#0e8c6a",
      copy: "The core material is established well enough to support later learning.",
    };
  }
  return {
    key: "strong",
    label: "Strong",
    color: "#2563c4",
    copy: "Current evidence shows strong command of this area.",
  };
}

function makeScore(
  key: string,
  label: string,
  rows: EvidenceRow[],
  bankCount: number,
  bookCode?: string,
): KnowledgeScore {
  const rawScore = scoreEvidence(rows);
  return {
    key,
    label,
    bookCode,
    answered: rows.length,
    correct: rows.filter((row) => row.isCorrect).length,
    bankCount,
    rawScore,
    displayScore: rawScore === null ? null : toDisplayScore(rawScore),
  };
}

function sectionAssessmentHref(section: SectionKey) {
  const params = new URLSearchParams({
    mode: "scope",
    label: section,
    target: "20",
    scope: SECTION_SCOPE_KEYS[section],
  });
  return `/assess?${params.toString()}`;
}

function bookAssessmentHref(bookCode: string) {
  const params = new URLSearchParams({
    mode: "scope",
    label: BOOK_NAMES[bookCode] ?? bookCode,
    target: "15",
    scope: bookCode,
  });
  return `/assess?${params.toString()}`;
}

function recommendationAssessmentHref(recommendation: BackendRecommendation) {
  const params = new URLSearchParams({
    mode: "focus",
    unit: recommendation.unit_key,
    book: recommendation.book_code,
    start: String(recommendation.start_chapter),
    end: String(recommendation.end_chapter),
    label: recommendation.label,
    target: String(recommendation.retest_question_target),
  });
  if (recommendation.dimension_key) params.set("dimension", recommendation.dimension_key);
  return `/assess?${params.toString()}`;
}

export default function KnowledgeMapPage() {
  const [bankRows, setBankRows] = useState<PublicQuestionMetadataRow[]>([]);
  const [answerRows, setAnswerRows] = useState<AnswerRow[]>([]);
  const [recommendation, setRecommendation] = useState<BackendRecommendation | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionKey>("Torah");
  const [selectedBookCode, setSelectedBookCode] = useState("GEN");
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const recommendationCenteredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      setLoading(true);
      setLoadError(null);

      try {
        const bank = await loadPublicQuestionMetadata();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id ?? null;
        let answers: AnswerRow[] = [];
        let nextRecommendation: BackendRecommendation | null = null;

        if (userId) {
          const [
            { data: answerData, error: answerError },
            { data: recommendationData, error: recommendationError },
          ] = await Promise.all([
            supabase
              .from("assessment_answers")
              .select("generated_question_id,is_correct,is_idk,scoring_eligible")
              .eq("user_id", userId),
            supabase.rpc("obs_get_user_recommendation_v2", {
              p_user_id: userId,
            }),
          ]);

          if (answerError) throw answerError;
          if (recommendationError) throw recommendationError;
          answers = (answerData ?? []) as AnswerRow[];
          nextRecommendation =
            ((recommendationData ?? [])[0] as BackendRecommendation | undefined)
            ?? null;
        }

        if (!cancelled) {
          setBankRows(bank);
          setAnswerRows(answers);
          setRecommendation(nextRecommendation);
          setSignedIn(Boolean(userId));
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "The knowledge map could not be loaded.");
          setLoading(false);
        }
      }
    }

    void loadMap();
    return () => {
      cancelled = true;
    };
  }, []);

  const evidence = useMemo(() => {
    const bankById = new Map(
      bankRows.map((row) => [row.generated_question_id, row]),
    );

    return answerRows
      .filter((answer) => (
        answer.generated_question_id
        && !answer.is_idk
        && answer.scoring_eligible !== false
      ))
      .map((answer) => {
        const bank = bankById.get(answer.generated_question_id!);
        const bookCode = bank?.book_code?.toUpperCase();
        const book = OT_BOOKS.find((item) => item.code === bookCode);
        if (!bank || !book) return null;

        return {
          bookCode: book.code,
          section: book.section as SectionKey,
          dimension: dimensionForRow(bank),
          isCorrect: Boolean(answer.is_correct),
          weight: Math.max(
            1,
            Number(
              bank.routing_score
              ?? bank.importance_conceptual
              ?? bank.importance_context
              ?? 50,
            ),
          ),
        } satisfies EvidenceRow;
      })
      .filter((row): row is EvidenceRow => Boolean(row));
  }, [answerRows, bankRows]);

  const sectionScores = useMemo(
    () => SECTIONS.map((section) => makeScore(
      section.key,
      section.key,
      evidence.filter((row) => row.section === section.key),
      bankRows.filter((row) => section.books.includes((row.book_code ?? "").toUpperCase())).length,
    )),
    [bankRows, evidence],
  );

  const bookScores = useMemo(
    () => OT_BOOKS.map((book) => makeScore(
      `book:${book.code}`,
      book.name,
      evidence.filter((row) => row.bookCode === book.code),
      bankRows.filter((row) => row.book_code?.toUpperCase() === book.code).length,
      book.code,
    )),
    [bankRows, evidence],
  );

  const selectedSectionDefinition =
    SECTIONS.find((section) => section.key === selectedSection) ?? SECTIONS[0];
  const visibleBookScores = selectedSectionDefinition.books
    .map((bookCode) => bookScores.find((score) => score.bookCode === bookCode))
    .filter((score): score is KnowledgeScore => Boolean(score));
  const selectedBook =
    bookScores.find((score) => score.bookCode === selectedBookCode)
    ?? visibleBookScores[0]
    ?? null;

  const dimensionScores = useMemo(() => {
    if (!selectedBook?.bookCode) return [];
    return DIMENSIONS.map((dimension) => makeScore(
      `dimension:${selectedBook.bookCode}:${dimension.key}`,
      dimension.label,
      evidence.filter((row) => (
        row.bookCode === selectedBook.bookCode
        && row.dimension === dimension.key
      )),
      bankRows.filter((row) => (
        row.book_code?.toUpperCase() === selectedBook.bookCode
        && dimensionForRow(row) === dimension.key
      )).length,
    ));
  }, [bankRows, evidence, selectedBook?.bookCode]);

  const getDimensionScores = useCallback((bookCode: string) => DIMENSIONS.map((dimension) => makeScore(
    `dimension:${bookCode}:${dimension.key}`,
    dimension.label,
    evidence.filter((row) => row.bookCode === bookCode && row.dimension === dimension.key),
    bankRows.filter((row) => (
      row.book_code?.toUpperCase() === bookCode
      && dimensionForRow(row) === dimension.key
    )).length,
  )), [bankRows, evidence]);

  const toStarNode = useCallback((score: KnowledgeScore): StarNode => {
    const state = knowledgeState(score);
    return {
      stateKey: state.key,
      stateLabel: state.label,
      stateCopy: state.copy,
      displayScore: score.displayScore,
      answered: score.answered,
      bankCount: score.bankCount,
    };
  }, []);

  const starSections = useMemo<SectionNode[]>(() => SECTIONS.map((section) => {
    const sectionScore = sectionScores.find((score) => score.key === section.key);
    return {
      key: section.key,
      color: section.color,
      range: section.range,
      role: section.role,
      description: section.description,
      node: toStarNode(sectionScore ?? makeScore(section.key, section.key, [], 0)),
      books: section.books.map((code) => {
        const bookScore = bookScores.find((score) => score.bookCode === code);
        return {
          code,
          name: BOOK_NAMES[code] ?? code,
          node: toStarNode(bookScore ?? makeScore(`book:${code}`, code, [], 0, code)),
          focusLabel: recommendation && recommendation.book_code === code
            ? `Focus: ${BOOK_NAMES[code] ?? code} ${recommendation.start_chapter}-${recommendation.end_chapter}`
            : null,
        };
      }),
    };
  }), [bookScores, recommendation, sectionScores, toStarNode]);

  const getStarDimensions = useCallback(
    (bookCode: string): MoonNode[] => getDimensionScores(bookCode).map((score, i) => ({
      key: DIMENSIONS[i].key,
      label: DIMENSIONS[i].label,
      short: DIMENSIONS[i].short,
      node: toStarNode(score),
    })),
    [getDimensionScores, toStarNode],
  );

  const exploreBook = useCallback((bookCode: string) => {
    const owning = SECTIONS.find((item) => item.books.includes(bookCode));
    if (owning) setSelectedSection(owning.key);
    setSelectedBookCode(bookCode);
    document.getElementById("semantic-knowledge-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (!recommendation || recommendationCenteredRef.current) return;
    const section = SECTIONS.find((item) => item.key === recommendation.section);
    if (!section || !section.books.includes(recommendation.book_code)) return;
    recommendationCenteredRef.current = true;
    setSelectedSection(section.key);
    setSelectedBookCode(recommendation.book_code);
  }, [recommendation]);

  useEffect(() => {
    if (selectedSectionDefinition.books.includes(selectedBookCode)) return;
    setSelectedBookCode(selectedSectionDefinition.books[0]);
  }, [selectedBookCode, selectedSectionDefinition]);

  const recommendationHref = recommendation
    ? recommendationAssessmentHref(recommendation)
    : "/assess";
  const recommendedTitle = recommendation
    ? recommendation.dimension_short_label
      ? `${recommendation.dimension_short_label} in ${recommendation.label}`
      : recommendation.label
    : "Take your first assessment";
  const recommendedCopy = recommendation
    ? recommendation.dimension_focus_text ?? recommendation.focus_text
    : "Your first BLI snapshot will identify the earliest important gap and place it on this learning path.";

  const bookStateCounts = bookScores.reduce(
    (counts, score) => {
      const state = knowledgeState(score);
      if (state.key === "strong" || state.key === "established") counts.established += 1;
      else if (state.key === "review" || state.key === "developing") counts.review += 1;
      else counts.unknown += 1;
      return counts;
    },
    { established: 0, review: 0, unknown: 0 },
  );

  const focusRecommendation = () => {
    if (!recommendation) return;
    const section = SECTIONS.find((item) => item.key === recommendation.section);
    if (section) setSelectedSection(section.key);
    setSelectedBookCode(recommendation.book_code);
    window.setTimeout(() => {
      document.getElementById("semantic-knowledge-map")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  };

  return (
    <>
      <style>{`
        :root {
          --navy: #1b2442;
          --muted: #596477;
          --accent: #0aa3a3;
          --paper: rgba(248,250,252,.95);
          --line: rgba(209,224,235,.30);
          --shadow: 0 18px 46px rgba(0,0,0,.28);
        }
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
          margin: 0; min-height: 100vh; color: #edf4fb;
          font-family: var(--font-inter), system-ui, -apple-system, sans-serif;
          background:
            radial-gradient(circle at 18% 16%, rgba(255,255,255,.68) 0 1px, transparent 1.6px),
            radial-gradient(circle at 72% 28%, rgba(114,231,255,.54) 0 1px, transparent 1.7px),
            radial-gradient(circle at 88% 68%, rgba(255,208,115,.46) 0 1px, transparent 1.8px),
            linear-gradient(145deg,#080d1d 0%,#101a31 52%,#071323 100%);
          background-size: 121px 107px, 173px 149px, 223px 197px, auto;
          background-attachment: fixed;
        }
        button, a { font: inherit; }
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 32px;
          background: rgba(8,13,29,.86);
          border-bottom: 1px solid rgba(255,255,255,.10);
          backdrop-filter: blur(16px);
        }
        .nav-brand {
          color: #fff; text-decoration: none;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 18px; font-weight: 700;
        }
        .nav-links { display: flex; align-items: center; gap: 7px; }
        .nav-link {
          color: rgba(255,255,255,.67); text-decoration: none;
          padding: 8px 12px; border-radius: 6px;
          font-size: 12px; font-weight: 800;
        }
        .nav-link:hover, .nav-link.active {
          color: #fff; background: rgba(255,255,255,.09);
        }
        .page { width: min(1240px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 70px; }
        .page-head {
          display: grid; grid-template-columns: minmax(0,1fr) auto;
          gap: 28px; align-items: end; margin-bottom: 24px;
        }
        .eyebrow {
          margin: 0 0 8px; color: #7de5e5;
          font-size: 10px; font-weight: 900;
          letter-spacing: .13em; text-transform: uppercase;
        }
        .title {
          margin: 0; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: clamp(32px,4vw,48px); line-height: 1;
          letter-spacing: 0;
        }
        .subtitle {
          max-width: 720px; margin: 10px 0 0;
          color: rgba(237,244,251,.68); font-size: 14px; line-height: 1.55;
        }
        .summary {
          display: grid; grid-template-columns: repeat(3,minmax(92px,1fr));
          gap: 8px; min-width: 330px;
        }
        .summary-item {
          min-height: 66px; padding: 11px 13px;
          border: 1px solid rgba(255,255,255,.12); border-radius: 6px;
          background: rgba(255,255,255,.055);
        }
        .summary-value {
          display: block; color: #fff;
          font-family: var(--font-crimson), Georgia, serif;
          font-size: 25px; font-weight: 750; line-height: 1;
        }
        .summary-label {
          display: block; margin-top: 6px;
          color: rgba(237,244,251,.56); font-size: 9px;
          font-weight: 850; letter-spacing: .08em; text-transform: uppercase;
        }
        .next-band {
          position: relative; display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 24px; align-items: center;
          margin-bottom: 22px; padding: 20px 22px 20px 27px;
          border: 1px solid rgba(114,231,255,.34); border-radius: 8px;
          background:
            linear-gradient(105deg,rgba(10,163,163,.17),rgba(255,255,255,.06) 56%,rgba(212,160,23,.09));
          box-shadow: 0 18px 42px rgba(0,0,0,.24);
          overflow: hidden;
        }
        .next-band::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 5px;
          background: linear-gradient(180deg,#72e7ff,#d4a017);
        }
        .next-kicker {
          margin: 0 0 5px; color: #8debf5;
          font-size: 10px; font-weight: 900;
          letter-spacing: .12em; text-transform: uppercase;
        }
        .next-title {
          margin: 0; color: #fff; font-family: var(--font-crimson),Georgia,serif;
          font-size: 26px; line-height: 1.05;
        }
        .next-copy {
          max-width: 720px; margin: 7px 0 0;
          color: rgba(237,244,251,.70); font-size: 13px; line-height: 1.5;
        }
        .next-actions { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; justify-content: flex-end; }
        .btn-primary, .btn-secondary {
          display: inline-flex; min-height: 40px; align-items: center; justify-content: center;
          gap: 7px; padding: 9px 14px; border-radius: 6px;
          font-size: 12px; font-weight: 850; text-decoration: none; cursor: pointer;
        }
        .btn-primary {
          border: 1px solid #cff9ff; background: #b9f3ff; color: #07111d;
        }
        .btn-secondary {
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.07); color: #fff;
        }
        button.btn-secondary { appearance: none; }
        .path-panel {
          position: relative; padding: 0;
        }
        .panel-head {
          display: flex; justify-content: space-between; align-items: flex-end;
          gap: 20px; margin-bottom: 21px;
        }
        .panel-title {
          margin: 0; color: #fff;
          font-family: var(--font-crimson),Georgia,serif;
          font-size: 25px; line-height: 1;
        }
        .panel-copy {
          max-width: 620px; margin: 7px 0 0;
          color: rgba(237,244,251,.60); font-size: 12.5px; line-height: 1.5;
        }
        .legend { display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
        .legend-item {
          display: inline-flex; align-items: center; gap: 6px;
          color: rgba(237,244,251,.62); font-size: 10px; font-weight: 750;
        }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--state); }
        .path-grid {
          display: grid;
          grid-template-columns: minmax(190px,1fr) 62px minmax(190px,1fr) 76px minmax(190px,1fr);
          grid-template-rows: minmax(142px,auto) minmax(142px,auto);
          gap: 14px 0; align-items: stretch;
        }
        .section-node {
          --section-color: #0aa3a3;
          appearance: none; position: relative; width: 100%;
          min-width: 0; padding: 17px 18px;
          border: 1px solid rgba(255,255,255,.14); border-top: 3px solid var(--section-color);
          border-radius: 8px; background: rgba(248,250,252,.92);
          color: var(--navy); text-align: left; cursor: pointer;
          box-shadow: 0 12px 26px rgba(0,0,0,.20);
          transition: transform .16s ease,border-color .16s ease,box-shadow .16s ease;
          overflow: hidden;
        }
        .section-node:hover, .section-node:focus-visible {
          transform: translateY(-2px); outline: none;
          border-color: color-mix(in srgb,var(--section-color) 52%,white);
          box-shadow: 0 17px 34px rgba(0,0,0,.27);
        }
        .section-node.active {
          box-shadow: 0 0 0 3px color-mix(in srgb,var(--section-color) 28%,transparent),0 18px 38px rgba(0,0,0,.30);
        }
        .section-node.recommended::after {
          content: "Next"; position: absolute; top: 11px; right: 11px;
          border-radius: 999px; padding: 4px 8px;
          color: #086567; background: rgba(10,163,163,.12);
          border: 1px solid rgba(10,163,163,.26);
          font-size: 8px; font-weight: 950; letter-spacing: .1em; text-transform: uppercase;
        }
        .section-node.torah { grid-column: 1; grid-row: 1 / 3; }
        .section-node.former { grid-column: 3; grid-row: 1 / 3; }
        .section-node.latter { grid-column: 5; grid-row: 1; }
        .section-node.writings { grid-column: 5; grid-row: 2; }
        .section-node.torah, .section-node.former {
          align-self: center; min-height: 220px;
        }
        .node-role {
          margin: 0 0 7px; color: color-mix(in srgb,var(--section-color) 82%,#17213d);
          font-size: 9px; font-weight: 900; letter-spacing: .10em; text-transform: uppercase;
        }
        .node-name {
          display: block; padding-right: 42px;
          font-family: var(--font-crimson),Georgia,serif;
          font-size: 22px; font-weight: 750; line-height: 1.05;
        }
        .node-range { display: block; margin-top: 4px; color: var(--muted); font-size: 11px; }
        .node-description {
          display: block; margin-top: 12px; color: #566070;
          font-size: 11.5px; line-height: 1.45;
        }
        .node-score-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-top: 14px; padding-top: 12px;
          border-top: 1px solid rgba(27,36,66,.09);
        }
        .state-pill {
          display: inline-flex; align-items: center; gap: 6px;
          color: var(--state); font-size: 9px; font-weight: 900;
          letter-spacing: .06em; text-transform: uppercase;
        }
        .state-pill::before {
          content: ""; width: 8px; height: 8px; flex: 0 0 auto;
          border-radius: 50%; background: var(--state);
        }
        .node-score {
          color: var(--navy); font-family: var(--font-crimson),Georgia,serif;
          font-size: 20px; font-weight: 750;
        }
        .book-spark-row {
          display: flex; align-items: center; gap: 4px;
          min-height: 8px; margin-top: 10px; overflow: hidden;
        }
        .book-spark {
          height: 6px; min-width: 5px; flex: 1 1 0;
          border-radius: 999px; background: var(--book-state);
          opacity: .88;
        }
        .book-spark.is-recommended {
          height: 8px; outline: 2px solid #0aa3a3; outline-offset: 1px;
        }
        .connector { position: relative; pointer-events: none; }
        .connector.straight { grid-column: 2; grid-row: 1 / 3; }
        .connector.branch { grid-column: 4; grid-row: 1 / 3; }
        .connector.straight::before,
        .connector.straight::after,
        .connector.branch::before,
        .connector.branch::after {
          content: ""; position: absolute; background: var(--line);
        }
        .connector.straight::before {
          left: 0; right: 0; top: 50%; height: 2px;
        }
        .connector.straight::after {
          right: 1px; top: calc(50% - 5px); width: 10px; height: 10px;
          border-top: 2px solid rgba(209,224,235,.64);
          border-right: 2px solid rgba(209,224,235,.64);
          background: transparent; transform: rotate(45deg);
        }
        .connector.branch::before {
          left: 0; width: 50%; top: 50%; height: 2px;
        }
        .connector.branch::after {
          left: 50%; top: 25%; bottom: 25%; width: 50%;
          background: transparent;
          border-left: 2px solid var(--line);
          border-top: 2px solid var(--line);
          border-bottom: 2px solid var(--line);
          border-radius: 8px 0 0 8px;
        }
        .branch-arrow {
          position: absolute; right: 0; width: 50%; height: 2px;
          background: var(--line);
        }
        .branch-arrow.top { top: 25%; }
        .branch-arrow.bottom { bottom: 25%; }
        .branch-arrow::after {
          content: ""; position: absolute; right: 1px; top: -4px;
          width: 9px; height: 9px;
          border-top: 2px solid rgba(209,224,235,.64);
          border-right: 2px solid rgba(209,224,235,.64);
          transform: rotate(45deg);
        }
        .explore {
          margin-top: 24px; padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,.12);
        }
        .explore-head {
          display: flex; justify-content: space-between; align-items: flex-end;
          gap: 20px; margin-bottom: 14px;
        }
        .section-context {
          display: inline-flex; align-items: center; gap: 7px; margin-bottom: 7px;
          color: var(--section-color); font-size: 10px; font-weight: 900;
          letter-spacing: .11em; text-transform: uppercase;
        }
        .section-context::before {
          content: ""; width: 18px; height: 3px; border-radius: 999px; background: var(--section-color);
        }
        .explore-title {
          margin: 0; color: #fff; font-family: var(--font-crimson),Georgia,serif;
          font-size: 28px; line-height: 1;
        }
        .explore-copy {
          max-width: 690px; margin: 7px 0 0;
          color: rgba(237,244,251,.62); font-size: 12.5px; line-height: 1.5;
        }
        .book-grid {
          display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 9px;
        }
        .book-card {
          position: relative; min-width: 0;
          border: 1px solid rgba(255,255,255,.13); border-radius: 7px;
          background: rgba(248,250,252,.93); overflow: hidden;
          box-shadow: 0 9px 22px rgba(0,0,0,.17);
        }
        .book-card.active {
          border-color: var(--section-color);
          box-shadow: 0 0 0 2px color-mix(in srgb,var(--section-color) 28%,transparent),0 12px 26px rgba(0,0,0,.22);
        }
        .book-card.recommended {
          border-color: #0aa3a3;
          box-shadow: 0 0 0 2px rgba(10,163,163,.22),0 12px 27px rgba(0,0,0,.24);
        }
        .book-main {
          appearance: none; width: 100%; border: 0; padding: 13px 13px 11px;
          background: transparent; color: var(--navy); text-align: left; cursor: pointer;
        }
        .book-main:focus-visible { outline: 2px solid var(--section-color); outline-offset: -3px; }
        .book-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .book-name { font-size: 13px; font-weight: 800; line-height: 1.2; }
        .book-score {
          color: var(--navy); font-family: var(--font-crimson),Georgia,serif;
          font-size: 18px; font-weight: 750; line-height: 1;
        }
        .book-meta { margin-top: 6px; color: var(--muted); font-size: 9.5px; font-weight: 700; }
        .book-bar {
          height: 5px; margin-top: 10px; border-radius: 999px;
          background: rgba(27,36,66,.08); overflow: hidden;
        }
        .book-bar-fill { height: 100%; border-radius: inherit; background: var(--state); }
        .book-footer {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 8px 11px;
          border-top: 1px solid rgba(27,36,66,.08);
        }
        .book-footer .state-pill { font-size: 8px; }
        .book-test {
          color: var(--navy); font-size: 9px; font-weight: 900;
          text-decoration: none; text-transform: uppercase; letter-spacing: .06em;
        }
        .book-test:hover { color: #087979; }
        .recommended-tag {
          display: inline-flex; margin: 0 11px 9px; padding: 4px 7px;
          border-radius: 999px; color: #087979; background: rgba(10,163,163,.10);
          font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase;
        }
        .book-detail {
          --section-color: #0aa3a3;
          display: grid; grid-template-columns: minmax(230px,.72fr) minmax(0,1.5fr);
          gap: 25px; margin-top: 15px; padding: 22px;
          border: 1px solid rgba(255,255,255,.14); border-radius: 8px;
          background: rgba(248,250,252,.94); color: var(--navy);
          box-shadow: 0 14px 32px rgba(0,0,0,.22);
        }
        .detail-kicker {
          margin: 0 0 7px; color: var(--section-color);
          font-size: 9px; font-weight: 900; letter-spacing: .11em; text-transform: uppercase;
        }
        .detail-title {
          margin: 0; font-family: var(--font-crimson),Georgia,serif;
          font-size: 30px; line-height: 1;
        }
        .detail-level { margin-top: 5px; color: var(--muted); font-size: 12px; }
        .detail-score-row {
          display: grid; grid-template-columns: repeat(3,1fr);
          gap: 8px; margin-top: 17px;
        }
        .detail-stat {
          padding: 9px; border-left: 2px solid rgba(27,36,66,.12);
        }
        .detail-stat strong {
          display: block; font-family: var(--font-crimson),Georgia,serif;
          font-size: 22px; line-height: 1;
        }
        .detail-stat span {
          display: block; margin-top: 4px; color: var(--muted);
          font-size: 8px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase;
        }
        .detail-state-copy {
          margin: 14px 0 0; color: #566070; font-size: 12px; line-height: 1.5;
        }
        .detail-actions { display: flex; align-items: center; gap: 9px; margin-top: 16px; flex-wrap: wrap; }
        .detail-actions .btn-primary { color: #fff; background: var(--navy); border-color: var(--navy); }
        .detail-actions .btn-secondary { color: var(--navy); background: #fff; border-color: rgba(27,36,66,.14); }
        .dimension-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 12px; margin-bottom: 10px;
        }
        .dimension-title { margin: 0; font-size: 12px; font-weight: 900; }
        .dimension-note { color: var(--muted); font-size: 9px; }
        .dimension-list { display: grid; gap: 7px; }
        .dimension-row {
          display: grid; grid-template-columns: minmax(135px,.9fr) minmax(110px,1fr) 54px;
          gap: 10px; align-items: center; min-height: 38px; padding: 7px 9px;
          border-bottom: 1px solid rgba(27,36,66,.08);
        }
        .dimension-row:last-child { border-bottom: 0; }
        .dimension-name { min-width: 0; }
        .dimension-name strong { display: block; font-size: 11px; }
        .dimension-name span { display: block; margin-top: 2px; color: var(--muted); font-size: 8.5px; }
        .dimension-track { height: 6px; border-radius: 999px; background: rgba(27,36,66,.08); overflow: hidden; }
        .dimension-fill { height: 100%; border-radius: inherit; background: var(--state); }
        .dimension-value { text-align: right; font-family: var(--font-crimson),Georgia,serif; font-size: 16px; font-weight: 750; }
        .unit-branch {
          position: relative; grid-column: 1 / -1; margin-top: 1px; padding: 17px 18px 17px 24px;
          border: 1px solid rgba(10,163,163,.30); border-radius: 7px;
          background: linear-gradient(100deg,rgba(10,163,163,.09),rgba(212,160,23,.07));
        }
        .unit-branch::before {
          content: ""; position: absolute; left: 34px; bottom: 100%;
          width: 2px; height: 17px; background: rgba(10,163,163,.42);
        }
        .unit-branch-grid {
          display: grid; grid-template-columns: minmax(0,1fr) auto;
          gap: 18px; align-items: center;
        }
        .unit-title {
          margin: 0; font-family: var(--font-crimson),Georgia,serif;
          font-size: 22px; line-height: 1.05;
        }
        .unit-copy { margin: 6px 0 0; color: #566070; font-size: 11.5px; line-height: 1.5; }
        .unit-reason { margin-top: 7px; color: #087979; font-size: 10px; font-weight: 800; }
        .loading, .error {
          display: grid; place-items: center; min-height: 260px;
          border: 1px solid rgba(255,255,255,.13); border-radius: 8px;
          color: rgba(237,244,251,.70); background: rgba(4,8,20,.44);
        }
        @media (max-width: 1000px) {
          .page-head { grid-template-columns: 1fr; align-items: start; }
          .summary { width: 100%; min-width: 0; }
          .path-grid {
            grid-template-columns: minmax(170px,1fr) 44px minmax(170px,1fr);
            grid-template-rows: repeat(2,minmax(142px,auto));
          }
          .section-node.torah { grid-column: 1; grid-row: 1 / 3; }
          .section-node.former { grid-column: 3; grid-row: 1 / 3; }
          .section-node.latter { grid-column: 1; grid-row: 4; margin-top: 36px; }
          .section-node.writings { grid-column: 3; grid-row: 4; margin-top: 36px; }
          .connector.straight { grid-column: 2; }
          .connector.branch {
            grid-column: 1 / 4; grid-row: 3; height: 36px;
          }
          .connector.branch::before {
            left: 50%; top: 0; width: 2px; height: 18px;
          }
          .connector.branch::after {
            left: 25%; right: 25%; top: 18px; bottom: auto; width: 50%; height: 18px;
            border: 2px solid var(--line); border-bottom: 0; border-radius: 8px 8px 0 0;
          }
          .branch-arrow { display: none; }
          .book-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
        }
        @media (max-width: 760px) {
          .nav { padding: 12px 16px; }
          .nav-link:not(.active) { display: none; }
          .page { width: min(100% - 22px,620px); padding-top: 24px; }
          .page-head { margin-bottom: 18px; }
          .summary { grid-template-columns: repeat(3,1fr); }
          .next-band { grid-template-columns: 1fr; padding: 19px 18px 19px 23px; }
          .next-actions { justify-content: flex-start; }
          .panel-head, .explore-head { align-items: flex-start; flex-direction: column; }
          .legend { justify-content: flex-start; }
          .path-panel { padding: 0; }
          .path-grid { display: flex; flex-direction: column; gap: 0; }
          .section-node { min-height: 0; }
          .section-node.torah,
          .section-node.former,
          .section-node.latter,
          .section-node.writings { margin: 0; }
          .connector { width: 2px; height: 25px; margin-left: 28px; background: var(--line); }
          .connector.straight::before, .connector.straight::after,
          .connector.branch::before, .connector.branch::after,
          .branch-arrow { display: none; }
          .connector.branch::after {
            display: block; content: ""; position: absolute;
            left: 0; top: 0; width: 2px; height: 25px;
            border: 0; background: var(--line);
          }
          .section-node.writings { margin-top: 9px; }
          .book-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .book-detail { grid-template-columns: 1fr; padding: 18px; }
          .unit-branch { grid-column: 1; }
          .unit-branch-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 430px) {
          .summary-label { font-size: 8px; }
          .book-grid { grid-template-columns: 1fr; }
          .dimension-row { grid-template-columns: minmax(125px,1fr) 76px 42px; gap: 7px; }
        }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          *, *::before, *::after { transition: none !important; }
        }
      `}</style>

      <nav className="nav">
        <Link className="nav-brand" href="/">Open Bible Assessment</Link>
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link active" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-link" href="/assess">Assess</Link>
        </div>
      </nav>

      <main className="page">
        <header className="page-head">
          <div>
            <p className="eyebrow">Old Testament learning path</p>
            <h1 className="title">Your Knowledge Map</h1>
            <p className="subtitle">
              The map separates firm foundations from developing, uncertain, and untested areas. Its hierarchy also explains why one reading recommendation comes before another.
            </p>
          </div>
          <div className="summary" aria-label="Knowledge map summary">
            <div className="summary-item">
              <span className="summary-value">{bookStateCounts.established}</span>
              <span className="summary-label">Established books</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">{bookStateCounts.review}</span>
              <span className="summary-label">Review areas</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">{bookStateCounts.unknown}</span>
              <span className="summary-label">Still uncertain</span>
            </div>
          </div>
        </header>

        {loadError ? (
          <div className="error">The map could not load: {loadError}</div>
        ) : loading ? (
          <div className="loading">Building your knowledge path...</div>
        ) : (
          <>
            <section className="next-band" id="recommended-next" aria-label="Recommended next step">
              <div>
                <p className="next-kicker">{recommendation ? "Recommended next" : "Recommendation pending"}</p>
                <h2 className="next-title">{recommendedTitle}</h2>
                <p className="next-copy">{recommendedCopy}</p>
              </div>
              <div className="next-actions">
                {recommendation ? (
                  <>
                    <button className="btn-secondary" type="button" onClick={focusRecommendation}>
                      Show on map
                    </button>
                    <Link className="btn-primary" href={recommendationHref}>
                      Retest after reading <span aria-hidden="true">→</span>
                    </Link>
                  </>
                ) : (
                  <Link className="btn-primary" href="/assess">
                    {signedIn ? "Start assessment" : "Take an assessment"} <span aria-hidden="true">→</span>
                  </Link>
                )}
              </div>
            </section>

            <section className="path-panel" id="star-map" aria-label="Old Testament hierarchy and chronology">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">The learning hierarchy</h2>
                  <p className="panel-copy">
                    Time runs down the page against the rail on the left, and each arrow points from a section to the ones that depend on it: Torah supplies the foundation, Former Prophets extends its narrative, and Latter Prophets and Writings interpret that established history. Each star&apos;s colour is its temperature — your BLI: ember red at the low end through yellow to blue-white at the top of the scale. Untested areas stay grey and dim; more answers make a star burn brighter. Zoom in for book-level dates.
                  </p>
                </div>
              </div>

              <StarMap
                sections={starSections}
                getDimensions={getStarDimensions}
                onExplore={exploreBook}
              />

              <section
                className="explore"
                style={{ "--section-color": selectedSectionDefinition.color } as CSSProperties}
                aria-label={`${selectedSection} books`}
              >
                <div className="explore-head">
                  <div>
                    <span className="section-context">{selectedSectionDefinition.role}</span>
                    <h2 className="explore-title">{selectedSection}</h2>
                    <p className="explore-copy">{selectedSectionDefinition.description}</p>
                  </div>
                  <Link className="btn-secondary" href={sectionAssessmentHref(selectedSection)}>
                    Test this section <span aria-hidden="true">→</span>
                  </Link>
                </div>

                <div className="book-grid">
                  {visibleBookScores.map((bookScore) => {
                    const state = knowledgeState(bookScore);
                    const isRecommended = recommendation?.book_code === bookScore.bookCode;
                    return (
                      <article
                        className={`book-card ${selectedBook?.bookCode === bookScore.bookCode ? "active" : ""} ${isRecommended ? "recommended" : ""}`}
                        id={isRecommended ? "recommended-book" : undefined}
                        key={bookScore.key}
                      >
                        <button
                          type="button"
                          className="book-main"
                          onClick={() => setSelectedBookCode(bookScore.bookCode!)}
                          aria-pressed={selectedBook?.bookCode === bookScore.bookCode}
                        >
                          <span className="book-card-top">
                            <span className="book-name">{bookScore.label}</span>
                            <span className="book-score">{bookScore.displayScore ?? "--"}</span>
                          </span>
                          <span className="book-meta">
                            {bookScore.answered > 0
                              ? `${bookScore.answered} answered · ${bookScore.bankCount} available`
                              : `${bookScore.bankCount} questions available`}
                          </span>
                          <span className="book-bar">
                            <span
                              className="book-bar-fill"
                              style={{
                                "--state": state.color,
                                width: `${Math.max(bookScore.displayScore ? 3 : 0, (bookScore.displayScore ?? 0) / 8)}%`,
                              } as CSSProperties}
                            />
                          </span>
                        </button>
                        {isRecommended && <span className="recommended-tag">Recommended next</span>}
                        <div className="book-footer">
                          <span className="state-pill" style={{ "--state": state.color } as CSSProperties}>{state.label}</span>
                          <Link className="book-test" href={bookAssessmentHref(bookScore.bookCode!)}>
                            {bookScore.answered > 0 ? "Retest" : "Test"} <span aria-hidden="true">→</span>
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {selectedBook && (() => {
                  const state = knowledgeState(selectedBook);
                  const selectedBookIsRecommended = recommendation?.book_code === selectedBook.bookCode;
                  return (
                    <section
                      className="book-detail"
                      style={{ "--section-color": selectedSectionDefinition.color } as CSSProperties}
                      aria-label={`${selectedBook.label} knowledge details`}
                    >
                      <div>
                        <p className="detail-kicker">Book profile</p>
                        <h3 className="detail-title">{selectedBook.label}</h3>
                        <p className="detail-level">
                          {selectedBook.displayScore === null
                            ? "Not yet placed"
                            : `${levelForScore(selectedBook.displayScore)} · BLI ${selectedBook.displayScore}`}
                        </p>
                        <div className="detail-score-row">
                          <div className="detail-stat">
                            <strong>{selectedBook.displayScore ?? "--"}</strong>
                            <span>BLI</span>
                          </div>
                          <div className="detail-stat">
                            <strong>{selectedBook.answered}</strong>
                            <span>Answers</span>
                          </div>
                          <div className="detail-stat">
                            <strong>{selectedBook.bankCount}</strong>
                            <span>Available</span>
                          </div>
                        </div>
                        <p className="detail-state-copy">{state.copy}</p>
                        <div className="detail-actions">
                          <Link className="btn-primary" href={bookAssessmentHref(selectedBook.bookCode!)}>
                            {selectedBook.answered > 0 ? "Retest book" : "Test book"} <span aria-hidden="true">→</span>
                          </Link>
                        </div>
                      </div>

                      <div>
                        <div className="dimension-head">
                          <h3 className="dimension-title">Knowledge inside {selectedBook.label}</h3>
                          <span className="dimension-note">0-800 BLI · evidence varies by dimension</span>
                        </div>
                        <div className="dimension-list">
                          {dimensionScores.map((dimensionScore) => {
                            const dimension = DIMENSIONS.find((item) => dimensionScore.key.endsWith(item.key))!;
                            const dimensionState = knowledgeState(dimensionScore);
                            const isRecommendedDimension =
                              selectedBookIsRecommended
                              && recommendation?.dimension_key === dimension.key;
                            return (
                              <div
                                className="dimension-row"
                                key={dimensionScore.key}
                                style={{
                                  "--state": isRecommendedDimension ? "#0aa3a3" : dimensionState.color,
                                } as CSSProperties}
                              >
                                <div className="dimension-name">
                                  <strong>{dimension.label}{isRecommendedDimension ? " · Next" : ""}</strong>
                                  <span>{dimension.short} · {dimensionScore.answered} answers</span>
                                </div>
                                <div className="dimension-track">
                                  <div
                                    className="dimension-fill"
                                    style={{ width: `${Math.max(dimensionScore.displayScore ? 3 : 0, (dimensionScore.displayScore ?? 0) / 8)}%` }}
                                  />
                                </div>
                                <div className="dimension-value">{dimensionScore.displayScore ?? "--"}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {selectedBookIsRecommended && recommendation && (
                        <section className="unit-branch" aria-label="Recommended reading unit">
                          <div className="unit-branch-grid">
                            <div>
                              <p className="detail-kicker">Your next reading unit</p>
                              <h3 className="unit-title">{recommendedTitle}</h3>
                              <p className="unit-copy">{recommendedCopy}</p>
                              <p className="unit-reason">{recommendation.reason}</p>
                            </div>
                            <Link className="btn-primary" href={recommendationHref}>
                              Retest after reading <span aria-hidden="true">→</span>
                            </Link>
                          </div>
                        </section>
                      )}
                    </section>
                  );
                })()}
              </section>
            </section>
          </>
        )}
      </main>
    </>
  );
}
