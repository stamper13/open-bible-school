import { type Dispatch, type SetStateAction, useCallback, useMemo } from "react";
import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { getSectionSortInteraction } from "./assessmentHelpers";
import type {
  Choice,
  Phase,
  Question,
  SectionSortKey,
  SectionSortLabel,
} from "./types";

type SequenceInteractionOptions = {
  isQuestionInteractionLocked: () => boolean;
  phase: Phase;
  sequenceOrder: Choice[];
  setSequenceOrder: Dispatch<SetStateAction<Choice[]>>;
  submitAnswer: (choiceId: string) => Promise<void>;
};

export function useSequenceQuestionInteraction({
  isQuestionInteractionLocked,
  phase,
  sequenceOrder,
  setSequenceOrder,
  submitAnswer,
}: SequenceInteractionOptions) {
  const moveSequenceItem = useCallback((itemId: string, direction: -1 | 1) => {
    if (phase !== "question" || isQuestionInteractionLocked()) return;
    setSequenceOrder(current => {
      const currentIndex = current.findIndex(item => item.id === itemId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      return arrayMove(current, currentIndex, nextIndex);
    });
  }, [isQuestionInteractionLocked, phase, setSequenceOrder]);

  const handleSequenceDragEnd = useCallback((event: DragEndEvent) => {
    if (phase !== "question" || isQuestionInteractionLocked()) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSequenceOrder(current => {
      const oldIndex = current.findIndex(item => item.id === active.id);
      const newIndex = current.findIndex(item => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }, [isQuestionInteractionLocked, phase, setSequenceOrder]);

  const submitSequenceOrder = useCallback(() => {
    if (sequenceOrder.length === 0 || phase !== "question" || isQuestionInteractionLocked()) return;
    void submitAnswer(`__ORDER__:${JSON.stringify(sequenceOrder.map(item => item.id))}`);
  }, [isQuestionInteractionLocked, phase, sequenceOrder, submitAnswer]);

  return {
    handleSequenceDragEnd,
    moveSequenceItem,
    submitSequenceOrder,
  };
}

type SectionSortInteractionOptions = {
  isQuestionInteractionLocked: () => boolean;
  phase: Phase;
  question: Question | null;
  sectionSortAssignments: Record<string, SectionSortKey | null>;
  setSectionSortAssignments: Dispatch<SetStateAction<Record<string, SectionSortKey | null>>>;
};

export function useSectionSortQuestionInteraction({
  isQuestionInteractionLocked,
  phase,
  question,
  sectionSortAssignments,
  setSectionSortAssignments,
}: SectionSortInteractionOptions) {
  const sectionSortInteraction = useMemo(
    () => getSectionSortInteraction(question),
    [question],
  );

  const sectionSortLabelsByZone = useMemo(() => {
    const byZone = new Map<SectionSortKey | "UNASSIGNED", SectionSortLabel[]>();
    byZone.set("UNASSIGNED", []);
    if (!sectionSortInteraction) return byZone;
    for (const zone of sectionSortInteraction.dropZones) byZone.set(zone.id, []);

    for (const label of sectionSortInteraction.dragLabels) {
      const assignedZone = sectionSortAssignments[label.id] ?? "UNASSIGNED";
      byZone.get(assignedZone)?.push(label);
    }
    return byZone;
  }, [sectionSortAssignments, sectionSortInteraction]);

  const sectionSortReadyToSubmit = Boolean(
    sectionSortInteraction
    && sectionSortInteraction.dragLabels.length > 0
    && sectionSortInteraction.dragLabels.every(label => sectionSortAssignments[label.id]),
  );

  const handleSectionSortDragEnd = useCallback((event: DragEndEvent) => {
    if (phase !== "question" || isQuestionInteractionLocked()) return;
    const { active, over } = event;
    if (!over || !sectionSortInteraction) return;
    const zoneId = String(over.id) as SectionSortKey;
    if (!sectionSortInteraction.dropZones.some(zone => zone.id === zoneId)) return;
    if (!sectionSortInteraction.dragLabels.some(label => label.id === String(active.id))) return;

    setSectionSortAssignments(current => ({
      ...current,
      [String(active.id)]: zoneId,
    }));
  }, [isQuestionInteractionLocked, phase, sectionSortInteraction, setSectionSortAssignments]);

  return {
    handleSectionSortDragEnd,
    sectionSortInteraction,
    sectionSortLabelsByZone,
    sectionSortReadyToSubmit,
  };
}
