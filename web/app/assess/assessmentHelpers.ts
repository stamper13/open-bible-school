import { BIBLE_BOOKS } from "@/lib/bibleTaxonomy";
import {
  ANON_SESSION_ACTIVE_KEY,
  ANON_USER_ID_KEY,
  NT_ATTEMPT_ID_KEY,
  NT_SECTION_LABELS,
  NT_SECTION_RPC_VALUES,
  OT_ATTEMPT_ID_KEY,
  SESSION_ANSWERED_KEY,
  SESSION_CORRECT_KEY,
} from "./constants";
import type {
  Choice,
  NtBookMetadata,
  NtScopeOption,
  NtSectionKey,
  Question,
  SectionSortInteraction,
  SectionSortKey,
  SectionSortLabel,
  SectionSortZone,
} from "./types";

export const OT_SECTION_SORT_ZONES: SectionSortZone[] = [
  { id: "TORAH", label: "Torah" },
  { id: "FORMER", label: "Former Prophets" },
  { id: "LATTER", label: "Latter Prophets" },
  { id: "WRITINGS", label: "Writings" },
];

const SECTION_SORT_BOOK_SECTIONS: Record<string, SectionSortKey> = Object.fromEntries(
  BIBLE_BOOKS.map(book => [book.name, book.sectionKey]),
) as Record<string, SectionSortKey>;

const OT_SECTION_SORT_BOOKS = BIBLE_BOOKS.filter(book => book.testament === "OT");
const SECTION_SORT_PROMPT_OT =
  "Using Hebrew Bible divisions, drag each book to its correct section.";
const SECTION_SORT_PROMPT_NT =
  "Drag each New Testament book to its correct division.";
const TRADITION_SENSITIVE_OT_BOOKS = new Set(["Ruth", "Lamentations", "Daniel", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah"]);
export const HEBREW_BIBLE_DIVISION_NOTE =
  "OBA uses the Hebrew Bible/Tanakh divisions for Old Testament structure. That means Ruth, Lamentations, Daniel, Chronicles, Ezra, and Nehemiah are treated as Writings, even though many English Bible tables place some of them near historical books or major prophets.";

export function shuffleForDisplay<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (
    shuffled.length > 1
    && shuffled.every((item, index) => item === items[index])
  ) {
    shuffled.push(shuffled.shift() as T);
  }

  return shuffled;
}

export function promptAsksForBookAnswer(question: Pick<Question, "prompt" | "question_type">) {
  if (
    question.question_type === "book_orientation_mcq_v1"
    || question.question_type.includes("book_identification")
  ) {
    return true;
  }

  const prompt = question.prompt.trim().toLowerCase();
  return (
    /\b(?:which|what)\s+(?:[a-z]+\s+){0,3}book\b/.test(prompt)
    || /\b(?:in|from)\s+(?:which|what)\s+book\b/.test(prompt)
    || /\b(?:name|identify)\s+(?:the\s+)?(?:biblical\s+)?book\b/.test(prompt)
  );
}

export function promptAsksForSectionAnswer(question: Pick<Question, "prompt" | "question_type">) {
  if (question.question_type.includes("section_identification")) return true;

  const prompt = question.prompt.trim().toLowerCase();
  return (
    /\b(?:which|what)\s+(?:old testament\s+|ot\s+)?section\b/.test(prompt)
    || /\b(?:which|what)\s+section\s+(?:of\s+the\s+old testament\s+|of\s+ot\s+)?(?:contains|includes|has|fits|matches|does)\b/.test(prompt)
    || /\b(?:belongs|belong|fit|fits)\s+(?:in|to|under)\s+(?:which|what)\s+(?:old testament\s+|ot\s+)?section\b/.test(prompt)
  );
}

export function isBroadSectionLevelQuestion(question: Pick<Question, "prompt" | "question_type">) {
  if (question.question_type.includes("section_screen")) return true;

  const prompt = question.prompt.trim().toLowerCase();
  return (
    /\bbooks?\s+in\s+(?:the\s+)?(?:torah|former prophets|latter prophets|writings)\b/.test(prompt)
    || /\b(?:torah|former prophets|latter prophets|writings)\s+books?\b/.test(prompt)
    || /\bbroad historical span\b/.test(prompt)
    || /\bmajor\s+(?:torah|former prophets|latter prophets|writings)?\s*events\b/.test(prompt)
  );
}

export function isOrderResponseQuestion(question: Pick<Question, "prompt" | "question_type" | "choices">) {
  if (question.question_type === "sequence_order_v1") return true;
  return false;
}

const sectionSortKeyFromText = (value: string): SectionSortKey | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("torah") || normalized.includes("pentateuch")) return "TORAH";
  if (normalized.includes("former prophet")) return "FORMER";
  if (normalized.includes("latter prophet")) return "LATTER";
  if (normalized.includes("writings")) return "WRITINGS";
  if (
    normalized.includes("gospels & acts")
    || normalized.includes("gospels and acts")
    || /\bgospels?\b.*\bacts\b/.test(normalized)
  ) return "GOSPELS_ACTS";
  if (normalized.includes("pauline")) return "PAULINE";
  if (normalized.includes("general epistle")) return "GENERAL";
  if (normalized.includes("apocalypse")) return "APOCALYPSE";
  return null;
};

const sectionSortLabelId = (label: string) =>
  label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seedValue: string): T[] {
  const shuffled = [...items];
  let seed = hashString(seedValue) || 1;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(next() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function balancedOtSectionSortLabels(questionId: string): SectionSortLabel[] {
  const extraSections: SectionSortKey[] = ["WRITINGS", "TORAH", "FORMER", "LATTER"];
  const extraSection = extraSections[hashString(questionId) % extraSections.length];
  const targetCounts: Partial<Record<SectionSortKey, number>> = {
    TORAH: extraSection === "TORAH" ? 2 : 1,
    FORMER: extraSection === "FORMER" ? 2 : 1,
    LATTER: extraSection === "LATTER" ? 2 : 1,
    WRITINGS: extraSection === "WRITINGS" ? 4 : 3,
  };

  const selected = Object.entries(targetCounts).flatMap(([sectionKey, count]) => {
    const books = seededShuffle(
      OT_SECTION_SORT_BOOKS.filter(book => book.sectionKey === sectionKey),
      `${questionId}:${sectionKey}`,
    );
    return books.slice(0, count);
  });

  return seededShuffle(selected, `${questionId}:display`).map(book => ({
    id: sectionSortLabelId(book.name),
    text: book.name,
    sectionKey: book.sectionKey,
  }));
}

export function isHebrewBibleTraditionSensitiveMiss(label: SectionSortLabel, selected: SectionSortKey | null | undefined) {
  return TRADITION_SENSITIVE_OT_BOOKS.has(label.text)
    && selected !== null
    && selected !== undefined
    && selected !== label.sectionKey;
}

export function skyDiscoveryMilestone(answered: number) {
  if (answered < 7) return null;
  let next = 8;
  while (next <= answered) {
    if (answered === next) return next;
    next += 7 + (hashString(`sky:${next}`) % 4);
  }
  return null;
}

export function prepareChoicesForDisplay(_question: Pick<Question, "prompt">, choices: Choice[]) {
  return shuffleForDisplay(choices);
}

export function getSectionSortInteraction(question: Question | null): SectionSortInteraction | null {
  if (!question) return null;
  const isNtQuestion = question.question_type.startsWith("nt_");

  const map = question.map as {
    interaction_type?: unknown;
    drag_labels?: unknown;
    drop_zones?: unknown;
  } | null;

  if (
    map?.interaction_type === "section_sort_drag_drop"
    && Array.isArray(map.drag_labels)
    && Array.isArray(map.drop_zones)
  ) {
    const dragLabels = map.drag_labels
      .map((raw): SectionSortLabel | null => {
        if (!raw || typeof raw !== "object") return null;
        const item = raw as { id?: unknown; text?: unknown };
        if (typeof item.id !== "string" || typeof item.text !== "string") return null;
        const sectionKey = SECTION_SORT_BOOK_SECTIONS[item.text];
        return sectionKey ? { id: item.id, text: item.text, sectionKey } : null;
      })
      .filter((item): item is SectionSortLabel => item !== null);
    const dropZones = map.drop_zones
      .map((raw): SectionSortZone | null => {
        if (!raw || typeof raw !== "object") return null;
        const item = raw as { id?: unknown; label?: unknown };
        if (typeof item.id !== "string" || typeof item.label !== "string") return null;
        const id = sectionSortKeyFromText(item.id) ?? sectionSortKeyFromText(item.label);
        return id ? { id, label: item.label } : null;
      })
      .filter((item): item is SectionSortZone => item !== null);

    if (dragLabels.length > 0 && dropZones.length > 0) {
      if (!isNtQuestion) {
        const otLabels = balancedOtSectionSortLabels(question.out_generated_question_id);
        return {
          prompt: SECTION_SORT_PROMPT_OT,
          targetSection: null,
          dragLabels: otLabels,
          dropZones: OT_SECTION_SORT_ZONES,
        };
      }
      return {
        prompt: SECTION_SORT_PROMPT_NT,
        targetSection: sectionSortKeyFromText(question.prompt),
        dragLabels,
        dropZones,
      };
    }
  }

  return null;
}

export function normalizeNtSection(value: string | null | undefined): NtSectionKey | null {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (normalized === "GOSPELS_ACTS" || normalized === "GOSPELS_AND_ACTS") return "GOSPELS_ACTS";
  if (normalized === "PAULINE" || normalized === "PAULINE_EPISTLES") return "PAULINE";
  if (normalized === "GENERAL" || normalized === "GENERAL_EPISTLES") return "GENERAL";
  if (normalized === "APOCALYPSE" || normalized === "REVELATION") return "APOCALYPSE";
  return null;
}

export function ntScopeFromKey(scopeKey: string, books: NtBookMetadata[]): NtScopeOption {
  const normalized = scopeKey.trim().toUpperCase();
  if (normalized === "NT" || normalized === "ALL") {
    return {
      kind: "all",
      value: "ALL",
      label: "All New Testament",
      description: "Adaptive questions across all 27 New Testament books.",
    };
  }
  if (normalized === "GOSPELS") {
    return {
      kind: "section",
      value: "GOSPELS",
      rpcValue: "Gospels",
      label: "Gospels",
      description: "Matthew, Mark, Luke, and John",
    };
  }
  if (normalized === "ACTS") {
    return {
      kind: "section",
      value: "ACTS",
      rpcValue: "Acts",
      label: "Acts",
      description: "Acts of the Apostles",
    };
  }
  const section = normalizeNtSection(normalized);
  if (section) {
    return {
      kind: "section",
      value: section,
      rpcValue: NT_SECTION_RPC_VALUES[section],
      label: NT_SECTION_LABELS[section],
      description: `${books.filter(book => book.nt_division === section).length} New Testament books`,
    };
  }
  const book = books.find(item => item.book_code === normalized);
  return book
    ? {
        kind: "book",
        value: book.book_code,
        label: book.name,
        description: NT_SECTION_LABELS[book.nt_division],
      }
    : {
        kind: "all",
        value: "ALL",
        label: "All New Testament",
        description: "Adaptive questions across all 27 New Testament books.",
      };
}

export function clearAssessmentBrowserStorage() {
  localStorage.removeItem("obs_answered");
  localStorage.removeItem("obs_correct");
  localStorage.removeItem("obs_attempt_id");
  localStorage.removeItem("obs_user_id");
  localStorage.removeItem(ANON_USER_ID_KEY);
  sessionStorage.removeItem(ANON_SESSION_ACTIVE_KEY);
  sessionStorage.removeItem(ANON_USER_ID_KEY);
  sessionStorage.removeItem(SESSION_ANSWERED_KEY);
  sessionStorage.removeItem(SESSION_CORRECT_KEY);
  sessionStorage.removeItem(OT_ATTEMPT_ID_KEY);
  sessionStorage.removeItem(NT_ATTEMPT_ID_KEY);
}
