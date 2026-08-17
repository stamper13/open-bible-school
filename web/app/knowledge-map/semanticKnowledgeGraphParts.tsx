// Extracted from app/knowledge-map/SemanticKnowledgeGraph.tsx during a file-size cleanup.
// Pure constants, types, and helper functions (plus the presentational
// KnowledgeNode subcomponent) used by the knowledge graph view. No behavior change.

import { type CSSProperties } from "react";
import {
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { BIBLE_BOOKS, SECTION_BOOKS, type OldTestamentSectionName } from "@/lib/bibleTaxonomy";
import styles from "./SemanticKnowledgeGraph.module.css";
import type { GraphScore, KnowledgeEvidenceRow } from "./SemanticKnowledgeGraph";

export type RecommendationMarker = {
  section: string;
  book_code: string;
  unit_key: string;
  dimension_key: string | null;
};

export type GraphStatus = {
  key: "unknown" | "gap" | "inferred" | "direct";
  label: string;
  color: string;
  description: string;
};

export type GraphItemType = "root" | "section" | "book" | "unit" | "concept" | "facet";

export type GraphItem = {
  id: string;
  type: GraphItemType;
  label: string;
  kicker: string;
  subtitle: string;
  section?: OldTestamentSectionName;
  bookCode?: string;
  unitKey?: string;
  startChapter?: number;
  endChapter?: number;
  dimensionKey?: string;
  importance?: 1 | 2 | 3;
};

export type GraphNodeData = Record<string, unknown> & {
  item: GraphItem;
  status: GraphStatus;
  displayScore: number | null;
  evidenceCount: number;
  hasChildren: boolean;
  selected: boolean;
  recommended: boolean;
};

export type SemanticKnowledgeGraphProps = {
  sectionScores: GraphScore[];
  bookScores: GraphScore[];
  evidenceRows: KnowledgeEvidenceRow[];
  recommendation: RecommendationMarker | null;
  focusRecommendationVersion: number;
  onSectionChange: (section: OldTestamentSectionName) => void;
  onBookChange: (bookCode: string) => void;
};

export const SECTION_ITEMS: GraphItem[] = [
  {
    id: "section:Torah",
    type: "section",
    label: "Torah",
    kicker: "Foundation",
    subtitle: "Creation, covenant, exodus, law, and wilderness",
    section: "Torah",
    importance: 1,
  },
  {
    id: "section:Former Prophets",
    type: "section",
    label: "Former Prophets",
    kicker: "Narrative spine",
    subtitle: "Land, monarchy, division, decline, and exile",
    section: "Former Prophets",
    importance: 1,
  },
  {
    id: "section:Latter Prophets",
    type: "section",
    label: "Latter Prophets",
    kicker: "Prophetic interpretation",
    subtitle: "Judgment, restoration, covenant, and future hope",
    section: "Latter Prophets",
    importance: 2,
  },
  {
    id: "section:Writings",
    type: "section",
    label: "Writings",
    kicker: "Wisdom and reflection",
    subtitle: "Worship, wisdom, suffering, poetry, and restoration",
    section: "Writings",
    importance: 2,
  },
];

export const GENESIS_UNITS: GraphItem[] = [
  {
    id: "unit:gen-1-11",
    type: "unit",
    label: "Genesis 1-11",
    kicker: "Primeval history",
    subtitle: "Creation, fall, flood, covenant, nations, and Babel",
    section: "Torah",
    bookCode: "GEN",
    unitKey: "gen-1-11",
    startChapter: 1,
    endChapter: 11,
    importance: 1,
  },
  {
    id: "unit:gen-12-50",
    type: "unit",
    label: "Genesis 12-50",
    kicker: "Patriarchal history",
    subtitle: "Abraham, Isaac, Jacob, Joseph, covenant, and Israel's family",
    section: "Torah",
    bookCode: "GEN",
    unitKey: "gen-12-50",
    startChapter: 12,
    endChapter: 50,
    importance: 1,
  },
];

export const GENESIS_CONCEPTS: Record<string, GraphItem[]> = {
  "gen-1-11": [
    { id: "concept:creation", type: "concept", label: "Creation", kicker: "Genesis 1-2", subtitle: "God, the ordered world, humanity, image, vocation, and rest", section: "Torah", bookCode: "GEN", unitKey: "gen-1-11", startChapter: 1, endChapter: 2, importance: 1 },
    { id: "concept:fall", type: "concept", label: "The Fall", kicker: "Genesis 3", subtitle: "Temptation, disobedience, judgment, exile, and promised conflict", section: "Torah", bookCode: "GEN", unitKey: "gen-1-11", startChapter: 3, endChapter: 3, importance: 1 },
    { id: "concept:cain-abel", type: "concept", label: "Cain and Abel", kicker: "Genesis 4", subtitle: "Worship, murder, judgment, mercy, and spreading violence", section: "Torah", bookCode: "GEN", unitKey: "gen-1-11", startChapter: 4, endChapter: 4, importance: 2 },
    { id: "concept:adam-line", type: "concept", label: "Adam's Line", kicker: "Genesis 5", subtitle: "Genealogy, death, continuity, and the line leading to Noah", section: "Torah", bookCode: "GEN", unitKey: "gen-1-11", startChapter: 5, endChapter: 5, importance: 2 },
    { id: "concept:flood", type: "concept", label: "Flood and Covenant", kicker: "Genesis 6-9", subtitle: "Corruption, judgment, preservation, sacrifice, covenant, and sign", section: "Torah", bookCode: "GEN", unitKey: "gen-1-11", startChapter: 6, endChapter: 9, importance: 1 },
    { id: "concept:nations-babel", type: "concept", label: "Nations and Babel", kicker: "Genesis 10-11", subtitle: "Nations, human pride, scattered speech, and the road to Abraham", section: "Torah", bookCode: "GEN", unitKey: "gen-1-11", startChapter: 10, endChapter: 11, importance: 1 },
  ],
  "gen-12-50": [
    { id: "concept:abraham-call", type: "concept", label: "Abraham's Call", kicker: "Genesis 12-17", subtitle: "Land, offspring, blessing, covenant, faith, and circumcision", section: "Torah", bookCode: "GEN", unitKey: "gen-12-50", startChapter: 12, endChapter: 17, importance: 1 },
    { id: "concept:abraham-testing", type: "concept", label: "Promise and Testing", kicker: "Genesis 18-25", subtitle: "Sodom, Isaac's birth, sacrifice, burial, and covenant continuity", section: "Torah", bookCode: "GEN", unitKey: "gen-12-50", startChapter: 18, endChapter: 25, importance: 1 },
    { id: "concept:jacob-family", type: "concept", label: "Jacob and His Family", kicker: "Genesis 26-36", subtitle: "Birthright, Bethel, marriage, children, return, and Israel's name", section: "Torah", bookCode: "GEN", unitKey: "gen-12-50", startChapter: 26, endChapter: 36, importance: 1 },
    { id: "concept:joseph-egypt", type: "concept", label: "Joseph and Egypt", kicker: "Genesis 37-50", subtitle: "Betrayal, providence, famine, reconciliation, blessing, and death", section: "Torah", bookCode: "GEN", unitKey: "gen-12-50", startChapter: 37, endChapter: 50, importance: 1 },
  ],
};

export const FACETS: Array<{ key: string; label: string; short: string }> = [
  { key: "characters_lineage", label: "Characters & Lineage", short: "Who" },
  { key: "events_timeline", label: "Events & Timeline", short: "What and when" },
  { key: "geography_nations", label: "Geography & Nations", short: "Where" },
  { key: "law_commands", label: "Law & Commands", short: "Rules and stakes" },
  { key: "promise_prophecy", label: "Promise & Prophecy", short: "Divine declarations" },
  { key: "theological_reasoning", label: "Theological Reasoning", short: "Meaning" },
  { key: "structure_cross_ref", label: "Structure & Cross Ref", short: "Connections" },
];

export const UNKNOWN_STATUS: GraphStatus = {
  key: "unknown",
  label: "Unknown",
  color: "#7b8493",
  description: "No direct evidence and not enough support for a responsible inference.",
};
export const GAP_STATUS: GraphStatus = {
  key: "gap",
  label: "Observed gap",
  color: "#c2410c",
  description: "Direct responses currently indicate that this knowledge needs review.",
};
export const INFERRED_STATUS: GraphStatus = {
  key: "inferred",
  label: "Likely known",
  color: "#d4a017",
  description: "Related performance supports this area, but direct evidence is still limited.",
};
export const DIRECT_STATUS: GraphStatus = {
  key: "direct",
  label: "Direct evidence",
  color: "#f8fbff",
  description: "Multiple eligible responses directly support this knowledge.",
};

export function scoreRows(rows: KnowledgeEvidenceRow[]) {
  const latestByQuestion = new Map<string, KnowledgeEvidenceRow>();
  for (const row of rows) {
    if (!row.scoring_eligible || row.is_idk) continue;
    const previous = latestByQuestion.get(row.generated_question_id);
    if (!previous || Date.parse(row.answered_at) > Date.parse(previous.answered_at)) {
      latestByQuestion.set(row.generated_question_id, row);
    }
  }
  const eligible = [...latestByQuestion.values()];
  if (eligible.length === 0) return { count: 0, displayScore: null as number | null };
  const possible = eligible.reduce((sum, row) => sum + Math.max(1, Number(row.importance_weight || 1)), 0);
  const earned = eligible.reduce((sum, row) => (
    sum + Math.max(1, Number(row.importance_weight || 1)) * (row.is_correct ? 1 : 0)
  ), 0);
  const observed = earned / Math.max(1, possible);
  const raw = Math.max(0, Math.min(100, ((observed - .25) / .75) * 100));
  return { count: eligible.length, displayScore: Math.round(raw * 8) };
}

export function statusForEvidence(
  count: number,
  displayScore: number | null,
  parentSupportsInference: boolean,
) {
  if (count >= 2) {
    return (displayScore ?? 0) >= 513 ? DIRECT_STATUS : GAP_STATUS;
  }
  if (count === 1) {
    if ((displayScore ?? 0) < 313) return GAP_STATUS;
    return INFERRED_STATUS;
  }
  return parentSupportsInference ? INFERRED_STATUS : UNKNOWN_STATUS;
}

export function itemHasChildren(item: GraphItem) {
  if (item.type === "section") return true;
  if (item.type === "book") return item.bookCode === "GEN";
  if (item.type === "unit") return Boolean(item.unitKey && GENESIS_CONCEPTS[item.unitKey]);
  if (item.type === "concept") return true;
  return false;
}

export function KnowledgeNode({ data, sourcePosition, targetPosition }: NodeProps<Node<GraphNodeData>>) {
  return (
    <div
      className={`${styles.node} ${data.selected ? styles.selected : ""} ${data.recommended ? styles.recommended : ""}`}
      data-nodetype={data.item.type}
      data-status={data.status.key}
      style={{
        "--node-color": data.status.color,
        "--arrive-delay": `${(data.arriveIndex as number ?? 0) * 55}ms`,
      } as CSSProperties}
    >
      <Handle className={styles.handle} type="target" position={targetPosition ?? Position.Left} />
      <span className={styles.evidenceStar} aria-hidden="true" />
      <span className={styles.nodeKicker}>{data.item.kicker}</span>
      <span className={styles.nodeLabel}>{data.item.label}</span>
      <span className={styles.nodeSubtitle}>{data.item.subtitle}</span>
      <span className={styles.nodeFooter}>
        <span className={styles.status}>{data.status.label}</span>
        <span className={styles.score}>{data.displayScore ?? "--"}</span>
      </span>
      {data.hasChildren && <span className={styles.childrenHint} aria-hidden="true">⌖</span>}
      <Handle className={styles.handle} type="source" position={sourcePosition ?? Position.Right} />
    </div>
  );
}

export const nodeTypes = { knowledge: KnowledgeNode };

export function sectionBooks(section: OldTestamentSectionName) {
  return SECTION_BOOKS[section]
    .map((code) => BIBLE_BOOKS.find((book) => book.code === code))
    .filter((book): book is NonNullable<typeof book> => Boolean(book))
    .map((book) => ({
      id: `book:${book.code}`,
      type: "book" as const,
      label: book.name,
      kicker: book.section,
      subtitle: book.code === "GEN"
        ? "Primeval and patriarchal history"
        : "Book-level knowledge profile",
      section,
      bookCode: book.code,
      importance: 1 as const,
    }));
}

export function facetsForConcept(concept: GraphItem) {
  return FACETS.map((facet) => ({
    id: `facet:${concept.id}:${facet.key}`,
    type: "facet" as const,
    label: facet.label,
    kicker: facet.short,
    subtitle: `Evidence within ${concept.label}`,
    section: concept.section,
    bookCode: concept.bookCode,
    unitKey: concept.unitKey,
    startChapter: concept.startChapter,
    endChapter: concept.endChapter,
    dimensionKey: facet.key,
    importance: 2 as const,
  }));
}

export function childrenFor(item: GraphItem) {
  if (item.type === "root") return SECTION_ITEMS;
  if (item.type === "section" && item.section) return sectionBooks(item.section);
  if (item.type === "book" && item.bookCode === "GEN") return GENESIS_UNITS;
  if (item.type === "unit" && item.unitKey) return GENESIS_CONCEPTS[item.unitKey] ?? [];
  if (item.type === "concept") return facetsForConcept(item);
  return [];
}

export function graphLayout(items: GraphItem[], parent: GraphItem) {
  const count = items.length;
  const nodes: Array<{ item: GraphItem; position: { x: number; y: number } }> = [];

  if (parent.type === "root") {
    // Torah is the foundation: it anchors the base and knowledge rises from it.
    const positions = [
      { x: 300, y: 430 },
      { x: 300, y: 225 },
      { x: 60, y: 30 },
      { x: 540, y: 30 },
    ];
    items.forEach((item, index) => nodes.push({ item, position: positions[index] }));
    return nodes;
  }

  if (parent.type === "section") {
    const columns = count > 10 ? 5 : count > 6 ? 4 : Math.min(5, count);
    items.forEach((item, index) => {
      nodes.push({
        item,
        position: {
          x: 36 + (index % columns) * 220,
          y: 85 + Math.floor(index / columns) * 150,
        },
      });
    });
    return nodes;
  }

  if (parent.type === "book") {
    items.forEach((item, index) => {
      nodes.push({ item, position: { x: 120 + index * 340, y: 210 } });
    });
    return nodes;
  }

  if (parent.type === "unit") {
    const columns = count > 4 ? 3 : 2;
    items.forEach((item, index) => {
      nodes.push({
        item,
        position: {
          x: 110 + (index % columns) * 300,
          y: 105 + Math.floor(index / columns) * 190,
        },
      });
    });
    return nodes;
  }

  items.forEach((item, index) => {
    const angle = (-Math.PI / 2) + (index / count) * Math.PI * 2;
    nodes.push({
      item,
      position: {
        x: 430 + Math.cos(angle) * 300,
        y: 245 + Math.sin(angle) * 190,
      },
    });
  });
  return nodes;
}
