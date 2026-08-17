"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { BIBLE_BOOKS, SECTION_BOOKS, type OldTestamentSectionName } from "@/lib/bibleTaxonomy";
import styles from "./SemanticKnowledgeGraph.module.css";

export type GraphScore = {
  key: string;
  label: string;
  bookCode?: string;
  answered: number;
  displayScore: number | null;
  bankCount: number;
};

export type KnowledgeEvidenceRow = {
  generated_question_id: string;
  book_code: string;
  inferred_chapter: number | null;
  unit_key: string | null;
  dimension_key: string | null;
  is_correct: boolean;
  is_idk: boolean;
  scoring_eligible: boolean;
  answered_at: string;
  importance_weight: number;
};

type RecommendationMarker = {
  section: string;
  book_code: string;
  unit_key: string;
  dimension_key: string | null;
};

type GraphStatus = {
  key: "unknown" | "gap" | "inferred" | "direct";
  label: string;
  color: string;
  description: string;
};

type GraphItemType = "root" | "section" | "book" | "unit" | "concept" | "facet";

type GraphItem = {
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

type GraphNodeData = Record<string, unknown> & {
  item: GraphItem;
  status: GraphStatus;
  displayScore: number | null;
  evidenceCount: number;
  hasChildren: boolean;
  selected: boolean;
  recommended: boolean;
};

type SemanticKnowledgeGraphProps = {
  sectionScores: GraphScore[];
  bookScores: GraphScore[];
  evidenceRows: KnowledgeEvidenceRow[];
  recommendation: RecommendationMarker | null;
  focusRecommendationVersion: number;
  onSectionChange: (section: OldTestamentSectionName) => void;
  onBookChange: (bookCode: string) => void;
};

const SECTION_ITEMS: GraphItem[] = [
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

const GENESIS_UNITS: GraphItem[] = [
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

const GENESIS_CONCEPTS: Record<string, GraphItem[]> = {
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

const FACETS: Array<{ key: string; label: string; short: string }> = [
  { key: "characters_lineage", label: "Characters & Lineage", short: "Who" },
  { key: "events_timeline", label: "Events & Timeline", short: "What and when" },
  { key: "geography_nations", label: "Geography & Nations", short: "Where" },
  { key: "law_commands", label: "Law & Commands", short: "Rules and stakes" },
  { key: "promise_prophecy", label: "Promise & Prophecy", short: "Divine declarations" },
  { key: "theological_reasoning", label: "Theological Reasoning", short: "Meaning" },
  { key: "structure_cross_ref", label: "Structure & Cross Ref", short: "Connections" },
];

const UNKNOWN_STATUS: GraphStatus = {
  key: "unknown",
  label: "Unknown",
  color: "#7b8493",
  description: "No direct evidence and not enough support for a responsible inference.",
};
const GAP_STATUS: GraphStatus = {
  key: "gap",
  label: "Observed gap",
  color: "#c2410c",
  description: "Direct responses currently indicate that this knowledge needs review.",
};
const INFERRED_STATUS: GraphStatus = {
  key: "inferred",
  label: "Likely known",
  color: "#d4a017",
  description: "Related performance supports this area, but direct evidence is still limited.",
};
const DIRECT_STATUS: GraphStatus = {
  key: "direct",
  label: "Direct evidence",
  color: "#f8fbff",
  description: "Multiple eligible responses directly support this knowledge.",
};

function scoreRows(rows: KnowledgeEvidenceRow[]) {
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

function statusForEvidence(
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

function itemHasChildren(item: GraphItem) {
  if (item.type === "section") return true;
  if (item.type === "book") return item.bookCode === "GEN";
  if (item.type === "unit") return Boolean(item.unitKey && GENESIS_CONCEPTS[item.unitKey]);
  if (item.type === "concept") return true;
  return false;
}

function KnowledgeNode({ data, sourcePosition, targetPosition }: NodeProps<Node<GraphNodeData>>) {
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

const nodeTypes = { knowledge: KnowledgeNode };

function sectionBooks(section: OldTestamentSectionName) {
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

function facetsForConcept(concept: GraphItem) {
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

function childrenFor(item: GraphItem) {
  if (item.type === "root") return SECTION_ITEMS;
  if (item.type === "section" && item.section) return sectionBooks(item.section);
  if (item.type === "book" && item.bookCode === "GEN") return GENESIS_UNITS;
  if (item.type === "unit" && item.unitKey) return GENESIS_CONCEPTS[item.unitKey] ?? [];
  if (item.type === "concept") return facetsForConcept(item);
  return [];
}

function graphLayout(items: GraphItem[], parent: GraphItem) {
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

function SemanticGraphInner({
  sectionScores,
  bookScores,
  evidenceRows,
  recommendation,
  focusRecommendationVersion,
  onSectionChange,
  onBookChange,
}: SemanticKnowledgeGraphProps) {
  const rootItem = useMemo<GraphItem>(() => ({
    id: "root:ot",
    type: "root",
    label: "Old Testament",
    kicker: "Bird's-eye view",
    subtitle: "The major dependency structure of Old Testament knowledge",
  }), []);
  const [trail, setTrail] = useState<GraphItem[]>([rootItem]);
  const [selectedId, setSelectedId] = useState<string | null>("section:Torah");
  const { fitView } = useReactFlow();
  const parent = trail[trail.length - 1];
  const items = useMemo(() => childrenFor(parent), [parent]);
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  const evidenceForItem = useCallback((item: GraphItem) => {
    if (item.type === "section" && item.section) {
      if (evidenceRows.length > 0) {
        const sectionBooks = new Set(SECTION_BOOKS[item.section]);
        return {
          ...scoreRows(evidenceRows.filter((row) => sectionBooks.has(row.book_code))),
          parentSupportsInference: false,
        };
      }
      const score = sectionScores.find((candidate) => candidate.key === item.section);
      return {
        count: score?.answered ?? 0,
        displayScore: score?.displayScore ?? null,
        parentSupportsInference: false,
      };
    }
    if (item.type === "book" && item.bookCode) {
      if (evidenceRows.length > 0) {
        const direct = scoreRows(evidenceRows.filter((row) => row.book_code === item.bookCode));
        const sectionBooks = new Set(SECTION_BOOKS[item.section!]);
        const sectionEvidence = scoreRows(
          evidenceRows.filter((row) => sectionBooks.has(row.book_code)),
        );
        return {
          ...direct,
          parentSupportsInference:
            sectionEvidence.count >= 3 && (sectionEvidence.displayScore ?? 0) >= 513,
        };
      }
      const score = bookScores.find((candidate) => candidate.bookCode === item.bookCode);
      const sectionScore = sectionScores.find((candidate) => candidate.key === item.section);
      return {
        count: score?.answered ?? 0,
        displayScore: score?.displayScore ?? null,
        parentSupportsInference: (sectionScore?.answered ?? 0) >= 3 && (sectionScore?.displayScore ?? 0) >= 513,
      };
    }

    const rows = evidenceRows.filter((row) => {
      if (item.bookCode && row.book_code !== item.bookCode) return false;
      if (item.startChapter != null && (row.inferred_chapter == null || row.inferred_chapter < item.startChapter)) return false;
      if (item.endChapter != null && (row.inferred_chapter == null || row.inferred_chapter > item.endChapter)) return false;
      if (item.dimensionKey && row.dimension_key !== item.dimensionKey) return false;
      return true;
    });
    const scored = scoreRows(rows);
    const bookScore = item.bookCode
      ? bookScores.find((candidate) => candidate.bookCode === item.bookCode)
      : null;
    return {
      ...scored,
      parentSupportsInference: (bookScore?.answered ?? 0) >= 3 && (bookScore?.displayScore ?? 0) >= 513,
    };
  }, [bookScores, evidenceRows, sectionScores]);

  const isRecommended = useCallback((item: GraphItem) => {
    if (!recommendation) return false;
    if (item.type === "section") return item.section === recommendation.section;
    if (item.type === "book") return item.bookCode === recommendation.book_code;
    if (item.type === "unit") return item.unitKey === recommendation.unit_key;
    if (item.type === "facet") return item.dimensionKey === recommendation.dimension_key;
    return item.bookCode === recommendation.book_code
      && item.unitKey === recommendation.unit_key;
  }, [recommendation]);

  const nodes = useMemo<Node<GraphNodeData>[]>(() => (
    graphLayout(items, parent).map(({ item, position }) => {
      const itemEvidence = evidenceForItem(item);
      const status = statusForEvidence(
        itemEvidence.count,
        itemEvidence.displayScore,
        itemEvidence.parentSupportsInference,
      );
      return {
        id: item.id,
        type: "knowledge",
        position,
        draggable: false,
        selectable: true,
        sourcePosition: parent.type === "root" ? Position.Top : Position.Right,
        targetPosition: parent.type === "root" ? Position.Bottom : Position.Left,
        style: {
          width: parent.type === "section" ? 188 : 220,
          height: parent.type === "section" ? 112 : 126,
        },
        data: {
          item,
          status,
          displayScore: itemEvidence.displayScore,
          evidenceCount: itemEvidence.count,
          hasChildren: itemHasChildren(item),
          selected: item.id === selectedId,
          recommended: isRecommended(item),
          arriveIndex: 0,
        },
      };
    })
  ).map((node, index) => ({ ...node, data: { ...node.data, arriveIndex: index } })), [evidenceForItem, isRecommended, items, parent, selectedId]);

  const edges = useMemo<Edge[]>(() => {
    const edge = (source: string, target: string, primary = false): Edge => ({
      id: `${source}->${target}`,
      source,
      target,
      type: "default",
      className: primary ? "edge-primary" : "edge-faint",
    });

    if (parent.type === "root") {
      return [
        edge("section:Torah", "section:Former Prophets", true),
        edge("section:Former Prophets", "section:Latter Prophets"),
        edge("section:Former Prophets", "section:Writings"),
      ];
    }
    if (parent.type === "section" && parent.section === "Torah") {
      return items.slice(1).map((item, index) => edge(items[index].id, item.id));
    }
    if (parent.type === "section" && parent.section === "Former Prophets") {
      const ids = items.map((item) => item.id);
      const result: Edge[] = [];
      const connect = (from: string, to: string) => {
        if (ids.includes(from) && ids.includes(to)) result.push(edge(from, to));
      };
      connect("book:JOS", "book:JDG");
      connect("book:JDG", "book:1SA");
      connect("book:JDG", "book:RUT");
      connect("book:1SA", "book:2SA");
      connect("book:2SA", "book:1KI");
      connect("book:1KI", "book:2KI");
      return result;
    }
    if (parent.type === "book" || parent.type === "unit") {
      return items.slice(1).map((item, index) => edge(items[index].id, item.id));
    }
    return [];
  }, [items, parent]);

  const enterItem = useCallback((item: GraphItem | null) => {
    if (!item || !itemHasChildren(item)) return;
    setTrail((current) => [...current, item]);
    setSelectedId(childrenFor(item)[0]?.id ?? null);
    if (item.section) onSectionChange(item.section);
    if (item.bookCode) onBookChange(item.bookCode);
    window.setTimeout(() => void fitView({ padding: .22, duration: 380 }), 60);
  }, [fitView, onBookChange, onSectionChange]);

  const returnToTrailIndex = useCallback((index: number) => {
    const nextTrail = trail.slice(0, index + 1);
    const nextParent = nextTrail[nextTrail.length - 1];
    setTrail(nextTrail);
    setSelectedId(childrenFor(nextParent)[0]?.id ?? null);
    window.setTimeout(() => void fitView({ padding: .22, duration: 380 }), 60);
  }, [fitView, trail]);

  useEffect(() => {
    window.setTimeout(() => void fitView({ padding: .22, duration: 300 }), 80);
  }, [fitView, nodes.length, parent.id]);

  useEffect(() => {
    if (!focusRecommendationVersion || !recommendation) return;
    const section = SECTION_ITEMS.find((item) => item.section === recommendation.section);
    const book = section
      ? sectionBooks(section.section!).find((item) => item.bookCode === recommendation.book_code)
      : null;
    if (!section || !book) return;
    const unit = recommendation.book_code === "GEN"
      ? GENESIS_UNITS.find((item) => item.unitKey === recommendation.unit_key)
      : null;
    const timeout = window.setTimeout(() => {
      setTrail([rootItem, section, book]);
      setSelectedId(unit?.id ?? null);
      onSectionChange(section.section!);
      onBookChange(book.bookCode!);
      void fitView({ padding: .24, duration: 420 });
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [fitView, focusRecommendationVersion, onBookChange, onSectionChange, recommendation, rootItem]);

  const selectedNodeData = nodes.find((node) => node.id === selectedId)?.data ?? null;
  const levelDescription = parent.type === "root"
    ? "Bird's-eye view: prerequisite flow across the four major Old Testament sections."
    : parent.type === "section"
    ? `Book view: ${parent.label} and its internal narrative or canonical structure.`
    : parent.type === "book"
    ? "Learning-unit view: broad chapter ranges used by the recommendation and retest engine."
    : parent.type === "unit"
    ? "Knowledge-node view: major events and concepts represented by this learning unit."
    : "Evidence-facet view: direct and inferred knowledge within the selected concept.";

  return (
    <div className={styles.shell} id="semantic-knowledge-map">
      <div className={styles.toolbar}>
        <div className={styles.breadcrumbs} aria-label="Knowledge map path">
          {trail.map((item, index) => (
            <button
              type="button"
              className={styles.crumb}
              aria-current={index === trail.length - 1 ? "page" : undefined}
              key={`${item.id}:${index}`}
              onClick={() => returnToTrailIndex(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          {trail.length > 1 && (
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Move up one level"
              title="Move up one level"
              onClick={() => returnToTrailIndex(trail.length - 2)}
            >
              −
            </button>
          )}
          {selectedItem && itemHasChildren(selectedItem) && (
            <button
              type="button"
              className={styles.openButton}
              onClick={() => enterItem(selectedItem)}
            >
              Open {selectedItem.label}
            </button>
          )}
        </div>
      </div>

      <ReactFlow
        className={styles.flow}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: .22 }}
        minZoom={.35}
        maxZoom={1.8}
        nodesDraggable={false}
        nodesConnectable={false}
        zoomOnScroll={false}
        preventScrolling={false}
        elementsSelectable
        onNodeClick={(_event, node) => {
          const item = node.data.item;
          setSelectedId(item.id);
          if (item.section) onSectionChange(item.section);
          if (item.bookCode) onBookChange(item.bookCode);
        }}
        onNodeDoubleClick={(_event, node) => enterItem(node.data.item)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(201,222,236,.10)" gap={28} size={1} variant={BackgroundVariant.Dots} />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>

      <div className={styles.levelLabel}>
        <strong>Level {trail.length - 1}</strong> · {levelDescription}
      </div>

      {selectedNodeData && (
        <aside className={styles.detail} aria-label="Selected knowledge node">
          <p className={styles.detailKicker}>{selectedNodeData.status.label}</p>
          <h3 className={styles.detailTitle}>{selectedNodeData.item.label}</h3>
          <p className={styles.detailCopy}>{selectedNodeData.status.description}</p>
          <div className={styles.detailMeta}>
            <span>{selectedNodeData.evidenceCount} direct responses</span>
            <span>{selectedNodeData.displayScore == null ? "No BLI yet" : `BLI ${selectedNodeData.displayScore}`}</span>
          </div>
        </aside>
      )}
    </div>
  );
}

export default function SemanticKnowledgeGraph(props: SemanticKnowledgeGraphProps) {
  return (
    <ReactFlowProvider>
      <SemanticGraphInner {...props} />
    </ReactFlowProvider>
  );
}
