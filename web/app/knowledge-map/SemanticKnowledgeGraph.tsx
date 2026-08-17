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
import {
  SECTION_ITEMS,
  GENESIS_UNITS,
  GENESIS_CONCEPTS,
  FACETS,
  UNKNOWN_STATUS,
  GAP_STATUS,
  INFERRED_STATUS,
  DIRECT_STATUS,
  scoreRows,
  statusForEvidence,
  itemHasChildren,
  KnowledgeNode,
  nodeTypes,
  sectionBooks,
  facetsForConcept,
  childrenFor,
  graphLayout,
  type RecommendationMarker,
  type GraphStatus,
  type GraphItemType,
  type GraphItem,
  type GraphNodeData,
  type SemanticKnowledgeGraphProps,
} from "./semanticKnowledgeGraphParts";

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
