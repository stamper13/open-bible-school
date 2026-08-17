import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Choice, SectionSortLabel, SectionSortZone } from "./types";

export function SortableSequenceItem({
  item,
  index,
  disabled,
  isFirst,
  isLast,
  onMove,
}: {
  item: Choice;
  index: number;
  disabled: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (itemId: string, direction: -1 | 1) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled });

  return (
    <div
      ref={setNodeRef}
      className={`sequence-item ${isDragging ? "is-dragging" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <span className="sequence-number" aria-hidden="true">{index + 1}</span>
      <button
        type="button"
        className="sequence-handle"
        aria-label={`Drag ${item.text}`}
        title="Drag to reorder"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <span className="sequence-text">{item.text}</span>
      <span className="sequence-step-controls">
        <button
          type="button"
          aria-label={`Move ${item.text} earlier`}
          title="Move earlier"
          disabled={disabled || isFirst}
          onClick={() => onMove(item.id, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Move ${item.text} later`}
          title="Move later"
          disabled={disabled || isLast}
          onClick={() => onMove(item.id, 1)}
        >
          ↓
        </button>
      </span>
    </div>
  );
}

export function SectionSortLabelChip({
  label,
  disabled,
}: {
  label: SectionSortLabel;
  disabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: label.id, disabled });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`section-sort-chip ${isDragging ? "is-dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      disabled={disabled}
      {...attributes}
      {...listeners}
    >
      {label.text}
    </button>
  );
}

export function SectionSortDropZone({
  zone,
  labels,
  disabled,
}: {
  zone: SectionSortZone;
  labels: SectionSortLabel[];
  disabled: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: zone.id, disabled });

  return (
    <div
      ref={setNodeRef}
      className={`section-sort-zone ${isOver ? "is-over" : ""}`}
      aria-label={zone.label}
    >
      <span className="section-sort-zone-title">{zone.label}</span>
      <div className="section-sort-zone-labels">
        {labels.length === 0 ? (
          <span className="section-sort-empty">Drop books here</span>
        ) : labels.map(label => (
          <SectionSortLabelChip key={label.id} label={label} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}
