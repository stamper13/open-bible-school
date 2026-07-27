"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { BOOK_NAMES } from "@/lib/bibleTaxonomy";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SKY_SEED_KEY = "obs_sky_seed";
function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function getOrCreateSkySeed() {
  if (typeof window === "undefined") return 1;
  const existing = sessionStorage.getItem(SKY_SEED_KEY);
  if (existing) return Number(existing) || 1;
  const seed = Math.floor(Math.random() * 4294967295) || 1;
  sessionStorage.setItem(SKY_SEED_KEY, String(seed));
  return seed;
}

type Choice = { id: string; text: string };
type Testament = "OT" | "NT";
type AssessmentMode = Testament | "select";
type NtSectionKey = "GOSPELS_ACTS" | "PAULINE" | "GENERAL" | "APOCALYPSE";
type Question = {
  out_generated_question_id: string;
  prompt: string;
  question_type: string;
  choices: Choice[];
  event_title: string;
  book_code: string;
  importance_tier: number;
  section: string;
};
type Phase = "starting" | "question" | "feedback" | "complete" | "error";
type ReportCategory = "wrong_answer" | "inaccurate" | "poorly_worded" | "other";
type NtBookMetadata = {
  book_code: string;
  canon_order: number;
  name: string;
  nt_division: NtSectionKey;
};
type NtScopeOption = {
  kind: "all" | "section" | "book";
  value: string;
  rpcValue?: string;
  label: string;
  description: string;
};
type NtPilotQuestion = Question & {
  book_name: string;
  nt_division: NtSectionKey;
};
type NtAssessmentQuestionRow = {
  out_generated_question_id: string | null;
  prompt: string | null;
  question_type: string | null;
  choices: unknown;
  book_code: string | null;
  book_name: string | null;
  nt_division: string | null;
  answered_count: number | null;
  target_question_count: number | null;
};
type NtAssessmentStartRow = {
  attempt_id: string;
  user_id: string;
  testament: "NT";
  scope_key: string;
  target_question_count: number;
  available_question_count: number;
};
type NtAssessmentStatusRow = {
  attempt_id: string;
  scope_key: string;
  answered_count: number;
  correct_count: number;
  idk_count: number;
  target_question_count: number;
  target_reached: boolean;
  completed_at: string | null;
};
type OtAssessmentRequest = {
  unitKey: string | null;
  scopeKey: string | null;
  bookCode: string | null;
  startChapter: number | null;
  endChapter: number | null;
  label: string | null;
  dimensionKey: string | null;
  targetQuestionCount: number;
};
type OtAssessmentStartRow = {
  attempt_id: string;
  user_id: string;
  assessment_kind: "ot_adaptive" | "ot_focused";
  scope_key: string;
  unit_key: string | null;
  label: string;
  book_code: string | null;
  start_chapter: number | null;
  end_chapter: number | null;
  target_question_count: number;
  available_question_count: number;
  answered_count: number;
  correct_count: number;
  idk_count: number;
  target_reached: boolean;
  resumed: boolean;
};
type BliEvidence = {
  scope: string;
  theta: number;
  theta_se: number;
  theta_lower_95: number;
  theta_upper_95: number;
  n_responses: number;
  evidence_level: "Very limited" | "Limited" | "Developing" | "Strong" | "Very strong";
  evidence_description: string;
};
const IDK_CHOICE_ID = "__IDK__";
const IDK_CHOICE: Choice = { id: IDK_CHOICE_ID, text: "I don't know - skip" };
const REPORT_OPTIONS: { value: ReportCategory; label: string }[] = [
  { value: "wrong_answer", label: "Wrong answer" },
  { value: "inaccurate", label: "Inaccurate" },
  { value: "poorly_worded", label: "Poorly worded" },
  { value: "other", label: "Other" },
];
const SECTION_COLORS: Record<string, string> = {
  "Torah": "#d4a017",
  "Former Prophets": "#0e8c6a",
  "Latter Prophets": "#2563c4",
  "Writings": "#7c3aed",
  "Old Testament": "#0aa3a3",
};

const TOTAL_INITIAL = 20;
const ANON_SESSION_ACTIVE_KEY = "obs_anon_session_active";
const ANON_USER_ID_KEY = "obs_anon_user_id";
const SESSION_ANSWERED_KEY = "obs_session_answered";
const SESSION_CORRECT_KEY = "obs_session_correct";
const OT_ATTEMPT_ID_KEY = "obs_ot_attempt_id";
const NT_ATTEMPT_ID_KEY = "obs_nt_attempt_id";
const NT_PILOT_TARGET = 20;
const NT_PILOT_ENABLED = process.env.NEXT_PUBLIC_NT_PILOT_ENABLED !== "false";
const NT_SECTION_LABELS: Record<NtSectionKey, string> = {
  GOSPELS_ACTS: "Gospels and Acts",
  PAULINE: "Pauline Epistles",
  GENERAL: "General Epistles",
  APOCALYPSE: "Revelation",
};
const NT_SECTION_RPC_VALUES: Record<NtSectionKey, string> = {
  GOSPELS_ACTS: "Gospels_Acts",
  PAULINE: "Pauline",
  GENERAL: "General",
  APOCALYPSE: "Apocalypse",
};
const EVIDENCE_VISUAL_STRENGTH: Record<BliEvidence["evidence_level"], number> = {
  "Very limited": 18,
  "Limited": 36,
  "Developing": 58,
  "Strong": 80,
  "Very strong": 96,
};

function normalizeNtSection(value: string | null | undefined): NtSectionKey | null {
  const normalized = (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (normalized === "GOSPELS_ACTS" || normalized === "GOSPELS_AND_ACTS") return "GOSPELS_ACTS";
  if (normalized === "PAULINE" || normalized === "PAULINE_EPISTLES") return "PAULINE";
  if (normalized === "GENERAL" || normalized === "GENERAL_EPISTLES") return "GENERAL";
  if (normalized === "APOCALYPSE" || normalized === "REVELATION") return "APOCALYPSE";
  return null;
}

function ntScopeFromKey(scopeKey: string, books: NtBookMetadata[]): NtScopeOption {
  const normalized = scopeKey.trim().toUpperCase();
  if (normalized === "NT" || normalized === "ALL") {
    return {
      kind: "all",
      value: "ALL",
      label: "All New Testament",
      description: "Preview questions across all 27 New Testament books.",
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
        description: "Preview questions across all 27 New Testament books.",
      };
}

function clearAssessmentBrowserStorage() {
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

function SortableSequenceItem({
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

export default function AssessPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const skyFrameRef = useRef(0);
  const offsetRef = useRef({ x: 0, y: 0 });
  const targetOffsetRef = useRef({ x: 0, y: 0 });
  const travelersRef = useRef<Array<{ sx: number; sy: number; cx: number; cy: number; t: number; dur: number }>>([]);
  const nebulaPulseRef = useRef(-999);
  const evidenceStrengthRef = useRef(0);
  const pendingSpawnRef = useRef<{ x: number; y: number } | null>(null);
  const transitioningRef = useRef(false);

  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>("OT");
  const [modeReady, setModeReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("starting");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [sequenceOrder, setSequenceOrder] = useState<Choice[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctChoiceId, setCorrectChoiceId] = useState<string | null>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const isSubmittingAnswerRef = useRef(false);
  const activeQuestionIdRef = useRef<string | null>(null);
  const ntResumeStartedRef = useRef(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showSavePrompt] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isDashboardTransitioning, setIsDashboardTransitioning] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState<ReportCategory>("wrong_answer");
  const [reportText, setReportText] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sent">("idle");
  const [reportError, setReportError] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [ntBooks, setNtBooks] = useState<NtBookMetadata[]>([]);
  const [ntScope, setNtScope] = useState<NtScopeOption>({ kind: "all", value: "ALL", label: "All New Testament", description: "Preview questions across all 27 New Testament books." });
  const [ntTargetCount, setNtTargetCount] = useState(NT_PILOT_TARGET);
  const [ntLoading, setNtLoading] = useState(false);
  const [ntMetadataLoaded, setNtMetadataLoaded] = useState(false);
  const [ntError, setNtError] = useState("");
  const [scoreEvidence, setScoreEvidence] = useState<BliEvidence | null>(null);
  const [otRequest, setOtRequest] = useState<OtAssessmentRequest>({
    unitKey: null,
    scopeKey: null,
    bookCode: null,
    startChapter: null,
    endChapter: null,
    label: null,
    dimensionKey: null,
    targetQuestionCount: TOTAL_INITIAL,
  });
  const [otAssessment, setOtAssessment] = useState<OtAssessmentStartRow | null>(null);
  const [otTargetCount, setOtTargetCount] = useState(TOTAL_INITIAL);
  const sequenceSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("choose") === "1") {
      setAssessmentMode("select");
      setPhase("starting");
    } else if (params.get("testament") === "NT") {
      setAssessmentMode(NT_PILOT_ENABLED ? "NT" : "select");
      setPhase("starting");
    } else {
      const parseChapter = (value: string | null) => {
        if (!value || !/^\d+$/.test(value)) return null;
        const parsed = Number(value);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
      };
      const requestedTarget = parseChapter(params.get("target"));
      const isFocused = params.get("mode") === "focus";
      const isScopeTest = params.get("mode") === "scope";
      setOtRequest({
        unitKey: isFocused ? params.get("unit") : null,
        scopeKey: isScopeTest ? params.get("scope")?.toUpperCase() ?? null : null,
        bookCode: isFocused ? params.get("book")?.toUpperCase() ?? null : null,
        startChapter: isFocused ? parseChapter(params.get("start")) : null,
        endChapter: isFocused ? parseChapter(params.get("end")) : null,
        label: isFocused || isScopeTest ? params.get("label") : null,
        dimensionKey: isFocused ? params.get("dimension") : null,
        targetQuestionCount: Math.min(50, Math.max(1, requestedTarget ?? TOTAL_INITIAL)),
      });
      setAssessmentMode("OT");
      setPhase("starting");
    }
    setModeReady(true);
  }, []);

  useEffect(() => {
    evidenceStrengthRef.current = scoreEvidence
      ? EVIDENCE_VISUAL_STRENGTH[scoreEvidence.evidence_level]
      : 0;
  }, [scoreEvidence]);
  useEffect(() => { transitioningRef.current = isDashboardTransitioning; }, [isDashboardTransitioning]);

  const spawnTraveler = useCallback(() => {
    const p = pendingSpawnRef.current;
    if (!p) return;
    const tx = window.innerWidth - 110;
    const ty = window.innerHeight - 130;
    travelersRef.current.push({
      sx: p.x,
      sy: p.y,
      cx: (p.x + tx) / 2 + (Math.random() - 0.5) * 160,
      cy: Math.min(p.y, ty) - 80 - Math.random() * 120,
      t: 0,
      dur: 66,
    });
    pendingSpawnRef.current = null;
  }, []);

  // Starry canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const SKY_OVERSCAN = 2.35;
    const random = createSeededRandom(getOrCreateSkySeed());
    function resize() {
      if (!canvas) return;
      const skyWidth = window.innerWidth * SKY_OVERSCAN;
      const skyHeight = window.innerHeight * SKY_OVERSCAN;
      canvas.width = skyWidth * DPR;
      canvas.height = skyHeight * DPR;
      canvas.style.width = skyWidth + "px";
      canvas.style.height = skyHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    const STAR_COUNT = 1400;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: random(), y: random(),
      r: (0.5 + random() * 1.8) * DPR,
      opacity: 0.5 + random() * 0.5,
      twinkleSpeed: 0.002 + random() * 0.004,
      twinkleOffset: random() * Math.PI * 2,
    }));

    const shootingPalettes = [
      { core: "255,255,255", glow: "173,232,255" },
      { core: "240,253,255", glow: "10,163,163" },
      { core: "255,248,214", glow: "212,160,23" },
      { core: "245,240,255", glow: "124,58,237" },
    ];
    const createShootingStar = (startFrame: number) => {
      const fromLeft = random() > 0.28;
      const palette = shootingPalettes[Math.floor(random() * shootingPalettes.length)];
      return {
        x: fromLeft ? -0.22 : 1.08,
        y: 0.02 + random() * 0.48,
        dx: (fromLeft ? 1 : -1) * (0.26 + random() * 0.20),
        dy: 0.08 + random() * 0.24,
        startFrame,
        duration: 104 + Math.floor(random() * 64),
        length: (105 + random() * 95) * DPR,
        width: (1.25 + random() * 0.8) * DPR,
        palette,
      };
    };
    const shootingStars = Array.from({ length: 3 }, () => createShootingStar(120 + Math.floor(random() * 900)));

    let frame = 0;
    function resetShootingStar(star: (typeof shootingStars)[number]) {
      Object.assign(star, createShootingStar(frame + 420 + Math.floor(random() * 1100)));
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      // Smooth pan
      offsetRef.current.x += (targetOffsetRef.current.x - offsetRef.current.x) * 0.03;
      offsetRef.current.y += (targetOffsetRef.current.y - offsetRef.current.y) * 0.03;
      const ox = offsetRef.current.x * DPR;
      const oy = offsetRef.current.y * DPR;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#0b0f1e");
      grad.addColorStop(0.5, "#111827");
      grad.addColorStop(1, "#0d1530");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      stars.forEach(star => {
        const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinkleOffset);
        const opacity = star.opacity * (0.6 + 0.4 * twinkle);
        // Wrap stars with parallax offset
        const sx = ((star.x * w + ox) % (w + 40) + w + 40) % (w + 40) - 20;
        const sy = ((star.y * h + oy) % (h + 40) + h + 40) % (h + 40) - 20;
        ctx.beginPath();
        ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fill();
      });

      shootingStars.forEach(star => {
        const progress = (frame - star.startFrame) / star.duration;
        if (progress > 1) {
          resetShootingStar(star);
          return;
        }
        if (progress < 0) return;

        const opacity = Math.sin(progress * Math.PI) * 0.9;
        const headX = star.x * w + progress * w * star.dx + ox * 0.12;
        const headY = star.y * h + progress * h * star.dy + oy * 0.12;
        const angle = Math.atan2(h * star.dy, w * star.dx);
        const tailX = headX - Math.cos(angle) * star.length;
        const tailY = headY - Math.sin(angle) * star.length;
        const streak = ctx.createLinearGradient(tailX, tailY, headX, headY);
        streak.addColorStop(0, "rgba(255,255,255,0)");
        streak.addColorStop(0.52, `rgba(${star.palette.glow},${opacity * 0.46})`);
        streak.addColorStop(0.86, `rgba(${star.palette.glow},${opacity * 0.72})`);
        streak.addColorStop(1, `rgba(${star.palette.core},${opacity})`);

        ctx.save();
        ctx.lineCap = "round";
        ctx.shadowColor = `rgba(${star.palette.glow},${opacity * 0.45})`;
        ctx.shadowBlur = 10 * DPR;
        ctx.lineWidth = star.width;
        ctx.strokeStyle = streak;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.stroke();
        ctx.restore();
      });

      // Teal nebula glow
      const nebula = ctx.createRadialGradient(w * 0.7 + ox * 0.1, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.4);
      nebula.addColorStop(0, "rgba(10,163,163,0.05)");
      nebula.addColorStop(1, "transparent");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);

      // --- Evidence nebula & traveler stars (viewport-fixed) ---
      if (!transitioningRef.current) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const toCX = (vx: number) => (vx + (w / DPR - vw) / 2) * DPR;
        const toCY = (vy: number) => (vy + (h / DPR - vh) / 2) * DPR;
        const ax = toCX(vw - 110);
        const ay = toCY(vh - 130);
        const evidenceStrength = evidenceStrengthRef.current;
        if (evidenceStrength > 0) {
          const pulseAge = frame - nebulaPulseRef.current;
          const pulse = pulseAge >= 0 && pulseAge < 36 ? Math.sin((pulseAge / 36) * Math.PI) : 0;
          const baseR = (60 + evidenceStrength * 4.6) * DPR * (1 + pulse * 0.14);
          const alpha = (0.13 + evidenceStrength * 0.0075) * (1 + pulse * 0.9);
          const layerCols = ["10,163,163", "124,58,237", "217,70,160", "212,160,23", "173,232,255"];
          for (let i = 0; i < 5; i++) {
            const wob = frame * (0.004 + i * 0.0021) + i * 1.7;
            const nx = ax + Math.cos(wob) * (8 + i * 11) * DPR;
            const ny = ay + Math.sin(wob * 0.8) * (7 + i * 9) * DPR;
            const r = baseR * (1 - i * 0.16);
            const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, r);
            g.addColorStop(0, `rgba(${layerCols[i]},${alpha * (0.85 - i * 0.13)})`);
            g.addColorStop(1, "transparent");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(nx, ny, r, 0, Math.PI * 2);
            ctx.fill();
          }
          const coreR = (12 + evidenceStrength * 0.30) * DPR * (1 + pulse);
          const core = ctx.createRadialGradient(ax, ay, 0, ax, ay, coreR);
          core.addColorStop(0, `rgba(240,253,255,${0.55 + pulse * 0.4})`);
          core.addColorStop(1, "transparent");
          ctx.fillStyle = core;
          ctx.beginPath();
          ctx.arc(ax, ay, coreR, 0, Math.PI * 2);
          ctx.fill();
        }
        const list = travelersRef.current;
        for (let i = list.length - 1; i >= 0; i--) {
          const tr = list[i];
          tr.t += 1;
          const p = Math.min(1, tr.t / tr.dur);
          const ease = p * p * (3 - 2 * p);
          const x0 = toCX(tr.sx);
          const y0 = toCY(tr.sy);
          const x1 = toCX(tr.cx);
          const y1 = toCY(tr.cy);
          const mt = 1 - ease;
          const px = mt * mt * x0 + 2 * mt * ease * x1 + ease * ease * ax;
          const py = mt * mt * y0 + 2 * mt * ease * y1 + ease * ease * ay;
          const tp = Math.max(0, ease - 0.12);
          const tmt = 1 - tp;
          const trailX = tmt * tmt * x0 + 2 * tmt * tp * x1 + tp * tp * ax;
          const trailY = tmt * tmt * y0 + 2 * tmt * tp * y1 + tp * tp * ay;
          const trail = ctx.createLinearGradient(trailX, trailY, px, py);
          trail.addColorStop(0, "rgba(173,232,255,0)");
          trail.addColorStop(1, `rgba(173,232,255,${0.75 * (1 - p * 0.3)})`);
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineWidth = 2.2 * DPR;
          ctx.strokeStyle = trail;
          ctx.beginPath();
          ctx.moveTo(trailX, trailY);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.shadowColor = "rgba(173,232,255,0.8)";
          ctx.shadowBlur = 8 * DPR;
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.arc(px, py, 2.6 * DPR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (p >= 1) {
            list.splice(i, 1);
            nebulaPulseRef.current = frame;
          }
        }
      }

      frame++;
      skyFrameRef.current = frame;
      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Shift sky on next question
  const shiftSky = useCallback(() => {
    targetOffsetRef.current = {
      x: targetOffsetRef.current.x + (Math.random() - 0.5) * 300,
      y: targetOffsetRef.current.y + (Math.random() - 0.5) * 150,
    };
  }, []);

  const loadScoreEvidence = useCallback(async (uid: string, scope: Testament) => {
    const { data, error } = await supabase.rpc("obs_get_bli_uncertainty", {
      p_user_id: uid,
      p_scope: scope,
    });
    if (error) return;
    let evidence = ((data ?? [])[0] as BliEvidence | undefined) ?? null;
    if (!evidence && scope === "OT") {
      const { data: bibleData, error: bibleError } = await supabase.rpc("obs_get_bli_uncertainty", {
        p_user_id: uid,
        p_scope: "BIBLE",
      });
      if (!bibleError) evidence = ((bibleData ?? [])[0] as BliEvidence | undefined) ?? null;
    }
    setScoreEvidence(evidence);
  }, []);

  const loadQuestion = useCallback(async (aid: string) => {
    const { data, error } = await supabase.rpc("obs_get_next_ot_assessment_question", {
      p_attempt_id: aid,
    });
    if (error) {
      if (error.message.includes("assessment_answers_user_id_fkey")) {
        await supabase.auth.signOut();
        clearAssessmentBrowserStorage();
        setErrorMsg("Your anonymous assessment session expired after Supabase restarted. Start a fresh assessment and the questions should work again.");
      } else {
        setErrorMsg(error.message);
      }
      setPhase("error");
      return;
    }
    if (!data || data.length === 0) { setPhase("complete"); return; }

    const q = data[0];
    let choices: Choice[] = [];
    if (Array.isArray(q.choices)) {
      choices = q.choices.map((c: { id: string; text: string }) => ({ id: c.id, text: c.text }));
    }
    activeQuestionIdRef.current = q.out_generated_question_id;
    isSubmittingAnswerRef.current = false;
    setIsSubmittingAnswer(false);
    setQuestion({ ...q, choices });
    setSequenceOrder(choices);
    setSelectedChoice(null);
    setIsCorrect(null);
    setCorrectChoiceId(null);
    setShowReportModal(false);
    setReportCategory("wrong_answer");
    setReportText("");
    setReportStatus("idle");
    setReportError("");
    setPhase("question");
    shiftSky();
  }, [shiftSky]);

  const loadNtMetadata = useCallback(async () => {
    if (!NT_PILOT_ENABLED) return;
    setNtMetadataLoaded(false);
    const { data, error } = await supabase
      .from("scripture_books")
      .select("book_code,canon_order,name,nt_division")
      .eq("testament", "NT")
      .order("canon_order", { ascending: true });

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
      .filter((row): row is NtBookMetadata => {
        return row !== null;
      })
      .sort((a, b) => a.canon_order - b.canon_order);
    setNtBooks(rows);
    setNtMetadataLoaded(true);
  }, []);

  useEffect(() => {
    if (!modeReady || assessmentMode !== "NT") return;
    void loadNtMetadata();
  }, [assessmentMode, loadNtMetadata, modeReady]);

  const ntScopeOptions: NtScopeOption[] = [
    { kind: "all", value: "ALL", label: "All New Testament", description: "Preview questions across all 27 New Testament books." },
    ...(["GOSPELS_ACTS", "PAULINE", "GENERAL", "APOCALYPSE"] as NtSectionKey[]).map(section => ({
      kind: "section" as const,
      value: section,
      rpcValue: NT_SECTION_RPC_VALUES[section],
      label: NT_SECTION_LABELS[section],
      description: ntBooks.length > 0 ? `${ntBooks.filter(book => book.nt_division === section).length} New Testament books` : "New Testament section",
    })),
    ...ntBooks.map(book => ({
      kind: "book" as const,
      value: book.book_code,
      label: book.name,
      description: NT_SECTION_LABELS[book.nt_division],
    })),
  ];

  const ensureAssessmentSession = useCallback(async () => {
    let { data: { session } } = await supabase.auth.getSession();
    if (session?.user && !session.user.email) {
      const belongsToThisBrowserSession =
        sessionStorage.getItem(ANON_SESSION_ACTIVE_KEY) === "1";
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (
        !belongsToThisBrowserSession ||
        userError ||
        userData.user?.id !== session.user.id
      ) {
        await supabase.auth.signOut();
        clearAssessmentBrowserStorage();
        session = null;
      }
    }
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      session = data.session;
    }
    const uid = session?.user?.id;
    if (!uid) throw new Error("No user ID");
    setUserId(uid);
    setIsSignedIn(Boolean(session?.user?.email));
    if (!session?.user.email) {
      sessionStorage.setItem(ANON_SESSION_ACTIVE_KEY, "1");
      sessionStorage.setItem(ANON_USER_ID_KEY, uid);
      localStorage.setItem(ANON_USER_ID_KEY, uid);
    }
    return uid;
  }, []);

  const loadNtQuestion = useCallback(async (aid: string, scope: NtScopeOption) => {
    setNtLoading(true);
    const { data, error } = await supabase.rpc("obs_get_next_nt_assessment_question", {
      p_attempt_id: aid,
    });
    setNtLoading(false);

    if (error) {
      setNtError(error.message);
      setErrorMsg(error.message);
      setPhase("error");
      return;
    }

    const row = ((data ?? [])[0] as NtAssessmentQuestionRow | undefined) ?? null;
    if (!row) {
      setQuestion(null);
      setPhase("complete");
      return;
    }

    const choices = Array.isArray(row.choices)
      ? row.choices
          .filter((choice): choice is Choice => {
            if (!choice || typeof choice !== "object") return false;
            const possibleChoice = choice as Partial<Choice>;
            return typeof possibleChoice.id === "string" && typeof possibleChoice.text === "string";
          })
          .map(choice => ({ id: choice.id, text: choice.text }))
      : [];
    if (!row.out_generated_question_id || !row.prompt || choices.length === 0) {
      setNtError("The next New Testament question could not be loaded.");
      setErrorMsg("The next New Testament question could not be loaded.");
      setPhase("error");
      return;
    }

    const section = normalizeNtSection(row.nt_division) ?? "GOSPELS_ACTS";
    const parsed: NtPilotQuestion = {
      out_generated_question_id: row.out_generated_question_id,
      prompt: row.prompt,
      question_type: row.question_type ?? "nt_adaptive",
      choices,
      event_title: scope.label,
      book_code: row.book_code ?? "",
      book_name: row.book_name ?? row.book_code ?? "New Testament",
      importance_tier: 1,
      section: NT_SECTION_LABELS[section],
      nt_division: section,
    };

    setAttemptId(aid);
    setAnsweredCount(Number(row.answered_count ?? 0));
    setNtTargetCount(Number(row.target_question_count ?? NT_PILOT_TARGET));
    activeQuestionIdRef.current = parsed.out_generated_question_id;
    isSubmittingAnswerRef.current = false;
    setIsSubmittingAnswer(false);
    setQuestion(parsed);
    setSequenceOrder(choices);
    setSelectedChoice(null);
    setIsCorrect(null);
    setCorrectChoiceId(null);
    setPhase("question");
    shiftSky();
  }, [shiftSky]);

  const startNtPilot = useCallback(async (scope: NtScopeOption = ntScope) => {
    if (!NT_PILOT_ENABLED) {
      setNtError("The New Testament pilot is not enabled right now.");
      return;
    }
    setNtLoading(true);
    setNtError("");
    setErrorMsg("");
    setPhase("starting");
    setAnsweredCount(0);
    setCorrectCount(0);
    setSelectedChoice(null);
    setIsCorrect(null);
    setCorrectChoiceId(null);
    localStorage.removeItem("oba_nt_pilot_summary");

    try {
      const uid = await ensureAssessmentSession();
      await loadScoreEvidence(uid, "NT");
      const { data, error } = await supabase.rpc("obs_start_nt_assessment", {
        p_section: scope.kind === "section" ? (scope.rpcValue ?? scope.value) : null,
        p_book_code: scope.kind === "book" ? scope.value : null,
        p_target_question_count: NT_PILOT_TARGET,
      });
      if (error) throw error;
      const attempt = ((data ?? [])[0] as NtAssessmentStartRow | undefined) ?? null;
      if (!attempt?.attempt_id) throw new Error("Failed to create the New Testament assessment");

      setNtScope(scope);
      setAttemptId(attempt.attempt_id);
      setUserId(attempt.user_id);
      setNtTargetCount(attempt.target_question_count);
      sessionStorage.setItem(NT_ATTEMPT_ID_KEY, attempt.attempt_id);
      await loadNtQuestion(attempt.attempt_id, scope);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start the New Testament assessment";
      setNtLoading(false);
      setNtError(message);
      setErrorMsg(message);
      setPhase("error");
    }
  }, [ensureAssessmentSession, loadNtQuestion, loadScoreEvidence, ntScope]);

  useEffect(() => {
    if (!modeReady || assessmentMode !== "NT" || !ntMetadataLoaded || ntResumeStartedRef.current) return;
    ntResumeStartedRef.current = true;
    const storedAttemptId = sessionStorage.getItem(NT_ATTEMPT_ID_KEY);
    if (!storedAttemptId) return;

    async function resumeNtAssessment() {
      setNtLoading(true);
      try {
        const uid = await ensureAssessmentSession();
        await loadScoreEvidence(uid, "NT");
        const { data, error } = await supabase.rpc("obs_get_nt_assessment_status", {
          p_attempt_id: storedAttemptId,
        });
        if (error) throw error;
        const status = ((data ?? [])[0] as NtAssessmentStatusRow | undefined) ?? null;
        if (!status) {
          sessionStorage.removeItem(NT_ATTEMPT_ID_KEY);
          setNtLoading(false);
          return;
        }

        const scope = ntScopeFromKey(status.scope_key, ntBooks);
        setAttemptId(status.attempt_id);
        setUserId(uid);
        setNtScope(scope);
        setAnsweredCount(status.answered_count);
        setCorrectCount(status.correct_count);
        setNtTargetCount(status.target_question_count);
        if (status.target_reached) {
          setNtLoading(false);
          setPhase("complete");
          return;
        }
        await loadNtQuestion(status.attempt_id, scope);
      } catch (err: unknown) {
        sessionStorage.removeItem(NT_ATTEMPT_ID_KEY);
        setNtLoading(false);
        setNtError(err instanceof Error ? err.message : "Your saved New Testament attempt could not be resumed.");
        setPhase("starting");
      }
    }

    void resumeNtAssessment();
  }, [assessmentMode, ensureAssessmentSession, loadNtQuestion, loadScoreEvidence, modeReady, ntBooks, ntMetadataLoaded]);

  useEffect(() => {
    async function init() {
      if (!modeReady || assessmentMode !== "OT") return;
      try {
        const uid = await ensureAssessmentSession();
        await loadScoreEvidence(uid, "OT");

        const { data, error } = otRequest.scopeKey
          ? await supabase.rpc("obs_start_or_resume_ot_scope_assessment", {
              p_scope_key: otRequest.scopeKey,
              p_label: otRequest.label,
              p_target_question_count: otRequest.targetQuestionCount,
              p_force_new: false,
            })
          : await supabase.rpc("obs_start_or_resume_ot_assessment_v2", {
              p_unit_key: otRequest.unitKey,
              p_book_code: otRequest.bookCode,
              p_start_chapter: otRequest.startChapter,
              p_end_chapter: otRequest.endChapter,
              p_target_question_count: otRequest.targetQuestionCount,
              p_force_new: false,
              p_dimension_key: otRequest.dimensionKey,
            });
        if (error) throw error;

        const attempt = ((data ?? [])[0] as OtAssessmentStartRow | undefined) ?? null;
        if (!attempt?.attempt_id) throw new Error("Failed to start the Old Testament assessment");

        setOtAssessment(attempt);
        setOtTargetCount(Number(attempt.target_question_count || TOTAL_INITIAL));
        setAttemptId(attempt.attempt_id);
        setAnsweredCount(Number(attempt.answered_count || 0));
        setCorrectCount(Number(attempt.correct_count || 0));
        sessionStorage.setItem(OT_ATTEMPT_ID_KEY, attempt.attempt_id);

        if (attempt.target_reached) {
          setPhase("complete");
          return;
        }
        await loadQuestion(attempt.attempt_id);
      } catch (err: unknown) {
        const message = err instanceof Error
          ? err.message
          : typeof err === "object" && err && "message" in err
            ? String((err as { message?: unknown }).message)
            : "Failed to start assessment";
        setErrorMsg(message);
        setPhase("error");
      }
    }
    init();
  }, [assessmentMode, ensureAssessmentSession, loadQuestion, loadScoreEvidence, modeReady, otRequest]);

  const submitAnswer = useCallback(async (choiceId: string) => {
    if (!attemptId || !userId || !question || isSubmittingAnswerRef.current) return;
    const submittedQuestionId = question.out_generated_question_id;
    const isSequenceResponse = choiceId.startsWith("__ORDER__:");
    const displayedChoices = isSequenceResponse
      ? sequenceOrder
      : question.choices;
    const selectedChoiceText = choiceId === IDK_CHOICE_ID
      ? null
      : isSequenceResponse
        ? sequenceOrder.map(item => item.text).join(" -> ")
        : question.choices.find(choice => choice.id === choiceId)?.text ?? null;
    isSubmittingAnswerRef.current = true;
    setIsSubmittingAnswer(true);
    setSelectedChoice(choiceId);

    const { data, error } = await supabase.rpc("obs_submit_ot_assessment_response_v2", {
      p_attempt_id: attemptId,
      p_generated_question_id: submittedQuestionId,
      p_response: choiceId,
      p_selected_choice_text: selectedChoiceText,
      p_displayed_choices: displayedChoices,
    });

    if (activeQuestionIdRef.current !== submittedQuestionId) return;

    if (error) {
      isSubmittingAnswerRef.current = false;
      setIsSubmittingAnswer(false);
      if (error.message.includes("assessment_answers_user_id_fkey")) {
        await supabase.auth.signOut();
        clearAssessmentBrowserStorage();
        setErrorMsg("Your anonymous assessment session expired after Supabase restarted. Start a fresh assessment and the questions should work again.");
      } else {
        setErrorMsg(error.message);
      }
      setPhase("error");
      return;
    }

    const result = data?.[0];
    if (result) {
      setIsCorrect(result.is_correct);
      setCorrectChoiceId(result.correct_choice_id);
      const newAnswered = Number(result.answered_count ?? answeredCount + 1);
      const newCorrect = Number(result.correct_count ?? correctCount + (result.is_correct ? 1 : 0));
      setAnsweredCount(newAnswered);
      setCorrectCount(newCorrect);
      setOtTargetCount(Number(result.target_question_count ?? otTargetCount));
      sessionStorage.setItem(SESSION_ANSWERED_KEY, String(newAnswered));
      sessionStorage.setItem(SESSION_CORRECT_KEY, String(newCorrect));
      void loadScoreEvidence(userId, "OT");
      spawnTraveler();
    }
    isSubmittingAnswerRef.current = false;
    setIsSubmittingAnswer(false);
    setPhase("feedback");
  }, [attemptId, userId, question, sequenceOrder, answeredCount, correctCount, loadScoreEvidence, otTargetCount, spawnTraveler]);

  const moveSequenceItem = useCallback((itemId: string, direction: -1 | 1) => {
    setSequenceOrder(current => {
      const currentIndex = current.findIndex(item => item.id === itemId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      return arrayMove(current, currentIndex, nextIndex);
    });
  }, []);

  const handleSequenceDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSequenceOrder(current => {
      const oldIndex = current.findIndex(item => item.id === active.id);
      const newIndex = current.findIndex(item => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  }, []);

  const submitSequenceOrder = useCallback(() => {
    if (sequenceOrder.length === 0) return;
    void submitAnswer(`__ORDER__:${JSON.stringify(sequenceOrder.map(item => item.id))}`);
  }, [sequenceOrder, submitAnswer]);

  const submitNtAnswer = useCallback(async (choiceId: string) => {
    if (!attemptId || !question || isSubmittingAnswerRef.current) return;
    const submittedQuestionId = question.out_generated_question_id;
    isSubmittingAnswerRef.current = true;
    setIsSubmittingAnswer(true);
    setSelectedChoice(choiceId);

    const { data, error } = await supabase.rpc("obs_submit_nt_assessment_answer", {
      p_attempt_id: attemptId,
      p_generated_question_id: submittedQuestionId,
      p_selected_choice_id: choiceId,
    });

    if (activeQuestionIdRef.current !== submittedQuestionId) return;

    if (error) {
      isSubmittingAnswerRef.current = false;
      setIsSubmittingAnswer(false);
      setErrorMsg(error.message);
      setPhase("error");
      return;
    }

    const result = data?.[0];
    const correct = Boolean(result?.is_correct);
    setIsCorrect(correct);
    setCorrectChoiceId(result?.correct_choice_id ?? null);
    setAnsweredCount(Number(result?.answered_count ?? answeredCount + 1));
    setCorrectCount(Number(result?.correct_count ?? correctCount + (correct ? 1 : 0)));
    setNtTargetCount(Number(result?.target_question_count ?? ntTargetCount));
    if (userId) void loadScoreEvidence(userId, "NT");
    isSubmittingAnswerRef.current = false;
    setIsSubmittingAnswer(false);
    spawnTraveler();
    setPhase("feedback");
  }, [answeredCount, attemptId, correctCount, loadScoreEvidence, ntTargetCount, question, spawnTraveler, userId]);

  const submitQuestionReport = useCallback(async () => {
    if (!question || !userId) return;
    const trimmedFeedback = reportText.trim();
    if (reportCategory === "other" && !trimmedFeedback) {
      setReportError("Add a short note so we know what to review.");
      return;
    }

    setIsSubmittingReport(true);
    setReportError("");
    const { error } = await supabase
      .from("question_reports")
      .insert({
        generated_question_id: question.out_generated_question_id,
        attempt_id: attemptId,
        user_id: userId,
        report_category: reportCategory,
        feedback_text: trimmedFeedback || null,
        selected_choice_id: selectedChoice,
        correct_choice_id: correctChoiceId,
        question_prompt: question.prompt,
      });

    setIsSubmittingReport(false);
    if (error) {
      setReportError(error.message);
      return;
    }
    setReportStatus("sent");
  }, [attemptId, correctChoiceId, question, reportCategory, reportText, selectedChoice, userId]);

  const nextQuestion = useCallback(() => {
    if (assessmentMode === "NT") {
      if (answeredCount >= ntTargetCount) {
        setPhase("complete");
        return;
      }
      if (attemptId) void loadNtQuestion(attemptId, ntScope);
      return;
    }
    if (answeredCount >= otTargetCount) {
      setPhase("complete");
      return;
    }
    if (attemptId) loadQuestion(attemptId);
  }, [answeredCount, assessmentMode, attemptId, loadNtQuestion, loadQuestion, ntScope, ntTargetCount, otTargetCount]);

  const choiceLabel = (id: string) => {
    if (!selectedChoice) return "";
    if (assessmentMode === "OT") return id === selectedChoice ? "recorded" : "";
    if (id === correctChoiceId) return "correct";
    if (id === IDK_CHOICE_ID && selectedChoice === IDK_CHOICE_ID) return "skipped";
    if (id === selectedChoice && !isCorrect) return "wrong";
    return "";
  };

  const visibleChoices = question
    ? [...question.choices, IDK_CHOICE]
    : [];
  const isSequenceQuestion = assessmentMode === "OT"
    && question?.question_type === "sequence_order_v1";
  const isSkipped = selectedChoice === IDK_CHOICE_ID;
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const ntProgressEnd = assessmentMode === "NT" ? Math.max(ntTargetCount, 1) : Math.max(otTargetCount, 1);
  const ntProgressPct = assessmentMode === "NT"
    ? Math.min(100, Math.max(0, (answeredCount / ntProgressEnd) * 100))
    : 0;
  const isInitialPhase = answeredCount < otTargetCount;
  const isScopeOtAssessment = Boolean(otRequest.scopeKey);
  const isTargetedOtAssessment = otAssessment?.assessment_kind === "ot_focused" || isScopeOtAssessment;
  const nextMilestone = answeredCount < otTargetCount ? otTargetCount : Math.ceil((answeredCount + 1) / 10) * 10;
  const progressStart = isInitialPhase ? 0 : nextMilestone - 10;
  const progressEnd = isInitialPhase ? otTargetCount : nextMilestone;
  const progressPct = Math.min(100, Math.max(0, ((answeredCount - progressStart) / Math.max(1, progressEnd - progressStart)) * 100));
  const hasBrowserSavedProgress = !isSignedIn && answeredCount > 0;
  const navPhaseLabel = isInitialPhase
    ? (isTargetedOtAssessment
      ? isScopeOtAssessment
        ? otAssessment?.book_code ? "Book Test" : "Section Test"
        : "Focused Retest"
      : isSignedIn ? "BLI Baseline" : hasBrowserSavedProgress ? "Saved Baseline" : "Initial Assessment")
    : (isSignedIn ? "BLI Refinement" : "Browser-Saved Practice");
  const navSubLabel = isInitialPhase
    ? (isTargetedOtAssessment
      ? `${otAssessment?.label ?? otRequest.label ?? "Targeted assessment"} · ${answeredCount} of ${otTargetCount}`
      : hasBrowserSavedProgress
        ? `${answeredCount} of ${otTargetCount} answered in this browser`
        : `${Math.max(0, otTargetCount - answeredCount)} questions until first BLI snapshot`)
    : (isSignedIn ? "Your BLI refines after every answer" : "Sign in to preserve your BLI across devices");
  const displayNavPhaseLabel = assessmentMode === "NT" ? "New Testament Pilot" : navPhaseLabel;
  const displayNavSubLabel = assessmentMode === "NT"
    ? `${ntScope.label} · developmental preview`
    : navSubLabel;
  const displayProgressPct = assessmentMode === "NT" ? ntProgressPct : progressPct;
  const displayProgressEnd = assessmentMode === "NT" ? ntProgressEnd : progressEnd;

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  }, []);

  const handleGoogleSignIn = async () => {
    setSaving(true);
    // Store anon ID in localStorage before redirect
    // Use a key that persists across the OAuth redirect
    if (userId) {
      localStorage.setItem("obs_anon_user_id", userId);
      // Also store in sessionStorage as backup
      sessionStorage.setItem("obs_anon_user_id", userId);
    }
    const anonId = userId || "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback?anon=" + anonId,
      },
    });
    if (error) { setSaving(false); setErrorMsg(error.message); }
  };

  const handleMagicLink = async () => {
    if (!email) return;
    setSaving(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/" },
    });
    setSaving(false);
    if (error) { setErrorMsg(error.message); return; }
    setSaved(true);
  };

  const transitionToDashboard = () => {
    if (isDashboardTransitioning) return;
    setIsDashboardTransitioning(true);
    sessionStorage.setItem("obs_dashboard_arriving", "1");
    sessionStorage.setItem("obs_dashboard_sky_rotation", "90");
    window.setTimeout(() => {
      sessionStorage.setItem("obs_dashboard_sky_frame", String(skyFrameRef.current));
      sessionStorage.setItem("obs_dashboard_sky_offset", JSON.stringify(offsetRef.current));
      window.location.href = "/";
    }, 2350);
  };

  return (
    <>
      <style>{`
        :root {
          --navy: #1b2442; --accent: #0aa3a3; --muted: #566070;
          --accent-dim: rgba(10,163,163,.10); --accent-line: rgba(10,163,163,.22);
          --card: rgba(255,255,255,.93); --border: rgba(27,36,66,.09);
          --shadow: 0 24px 64px rgba(0,0,0,.40), 0 4px 16px rgba(0,0,0,.2);
          --correct: #059669; --correct-bg: #ecfdf5; --correct-line: rgba(5,150,105,.2);
          --wrong: #dc2626; --wrong-bg: #fef2f2; --wrong-line: rgba(220,38,38,.2);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; }
        body {
          font-family: "Inter", system-ui, sans-serif;
          min-height: 100vh; background: #0b0f1e;
          display: flex; flex-direction: column; overflow-x: hidden;
        }
        canvas.stars {
          position: fixed; left: 50%; top: 50%; z-index: 0; pointer-events: none;
          transform-origin: 50% 50%; transform: translate3d(-50%,-50%,0);
        }
        .confidence-nebula-label {
          position: fixed; right: 110px; bottom: 26px; z-index: 1;
          transform: translateX(50%);
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          pointer-events: none; text-align: center;
        }
        .confidence-nebula-label span {
          font-size: 13px; font-weight: 850; letter-spacing: .18em;
          text-transform: uppercase; color: rgba(255,255,255,.62);
          text-shadow: 0 2px 10px rgba(0,0,0,.7);
        }
        .confidence-nebula-label strong {
          max-width: 150px; font-size: 17px; line-height: 1.05; font-weight: 800; color: rgba(255,255,255,.92);
          text-shadow: 0 2px 14px rgba(0,0,0,.75);
        }
        .confidence-nebula-label small {
          font-size: 10px; font-weight: 700; color: rgba(255,255,255,.48);
          text-shadow: 0 2px 10px rgba(0,0,0,.7);
        }
        canvas.stars.dashboard-transition { animation: starSpinDissolve 2.35s linear both; }
        @keyframes starSpinDissolve {
          0% { transform: translate3d(-50%,-50%,0) rotate(0deg); filter: brightness(1); opacity: 1; }
          100% { transform: translate3d(-50%,-50%,0) rotate(90deg); filter: brightness(1.14) saturate(1.06); opacity: .98; }
        }
        .dashboard-warp {
          position: fixed; inset: 0; z-index: 35; pointer-events: none;
          background:
            radial-gradient(circle at 50% 45%, rgba(10,163,163,.24), transparent 32%),
            radial-gradient(circle at 70% 32%, rgba(212,160,23,.15), transparent 28%),
            linear-gradient(100deg, transparent 0%, rgba(255,255,255,.08) 44%, rgba(173,232,255,.16) 50%, rgba(255,255,255,.07) 56%, transparent 100%);
          mix-blend-mode: screen;
          animation: dashboardWarp 1.9s ease-in-out both;
        }
        @keyframes dashboardWarp {
          0% { opacity: 0; transform: translateX(-8vw) scale(1.02); }
          38% { opacity: .82; }
          68% { opacity: .5; }
          100% { opacity: 0; transform: translateX(8vw) scale(1.02); }
        }

        /* Nav */
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 28px; background: rgba(11,15,30,.85);
          backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,.07);
        }
        .scene.dashboard-transition,
        .nav.dashboard-transition,
        .results-fab.dashboard-transition {
          opacity: 0;
          transform: translateY(-4px) scale(.99);
          pointer-events: none;
          transition: opacity .78s ease, transform .78s ease;
        }
        .nav-brand {
          font-family: "Crimson Pro", Georgia, serif; font-weight: 600; font-size: 17px;
          color: #fff; text-decoration: none; opacity: .85;
        }
        .brand-wrap { display: inline-flex; align-items: center; gap: 8px; }
        .beta-badge {
          position: relative;
          display: inline-flex; align-items: center;
          padding: 2px 8px; border-radius: 999px;
          font-family: system-ui, sans-serif;
          font-size: 10px; font-weight: 800; letter-spacing: .10em;
          text-transform: uppercase;
          color: rgba(255,255,255,.82);
          background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.16);
          cursor: help; outline: none;
        }
        .beta-tooltip {
          position: absolute; top: calc(100% + 10px); left: 0;
          width: 260px; padding: 10px 12px;
          border-radius: 10px;
          background: rgba(14,18,38,.98);
          border: 1px solid rgba(255,255,255,.14);
          box-shadow: 0 12px 34px rgba(0,0,0,.5);
          font-family: system-ui, sans-serif;
          font-size: 12px; font-weight: 500; letter-spacing: 0;
          text-transform: none; line-height: 1.45;
          color: rgba(255,255,255,.86);
          opacity: 0; visibility: hidden; transform: translateY(-4px);
          transition: opacity .16s ease, transform .16s ease, visibility .16s;
          z-index: 50; pointer-events: none;
        }
        .beta-badge:hover .beta-tooltip,
        .beta-badge:focus .beta-tooltip { opacity: 1; visibility: visible; transform: translateY(0); }

        .nav-center { display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: min(420px, 48vw); }
        .nav-phase {
          font-size: 12px; font-weight: 850; letter-spacing: .12em;
          text-transform: uppercase; color: var(--accent);
        }
        .nav-subphase { font-size: 11px; font-weight: 600; color: rgba(255,255,255,.52); line-height: 1; }
        .nav-progress-row { display: flex; align-items: center; gap: 10px; }
        .nav-count { font-size: 12.5px; color: rgba(255,255,255,.58); min-width: 44px; text-align: right; font-weight: 650; }
        .progress-bar-track {
          width: 230px; height: 5px; border-radius: 999px;
          background: rgba(255,255,255,.12); overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%; border-radius: 999px; background: var(--accent);
          transition: width .5s cubic-bezier(.4,0,.2,1);
        }
        .nav-count-right { font-size: 12.5px; color: rgba(255,255,255,.58); min-width: 44px; font-weight: 650; }
        .nav-exit {
          font-size: 12.5px; color: rgba(255,255,255,.4); text-decoration: none;
          padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.08);
          transition: color .14s, background .14s;
        }
        .nav-exit:hover { color: #fff; background: rgba(255,255,255,.07); }

        /* Scene */
        .scene {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 32px 24px 80px; position: relative; z-index: 1;
        }
        .card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 24px; padding: 46px 54px;
          box-shadow: var(--shadow); backdrop-filter: blur(20px);
          width: 100%; max-width: 760px;
          animation: cardIn .3s ease;
        }
        @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        /* Location graphic */
        .location-bar {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 18px; flex-wrap: wrap;
        }
        .question-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 14px; margin-bottom: 18px;
        }
        .question-head .location-bar { margin-bottom: 0; flex: 1; }
        .loc-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 999px;
          font-size: 11px; font-weight: 700; letter-spacing: .04em;
          border: 1px solid; white-space: nowrap;
        }
        .loc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .loc-sep { font-size: 11px; color: rgba(27,36,66,.25); }
        .tier-star { font-size: 11px; }
        .report-trigger {
          width: 34px; height: 34px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid rgba(27,36,66,.10); background: rgba(255,255,255,.62);
          color: rgba(86,96,112,.82); cursor: pointer; flex-shrink: 0;
          transition: background .13s, color .13s, transform .11s, border-color .13s;
        }
        .report-trigger:hover {
          background: #fff7ed; border-color: rgba(180,83,9,.22);
          color: #b45309; transform: translateY(-1px);
        }
        .report-trigger svg { width: 17px; height: 17px; }

        /* Question */
        .card-prompt {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 25px; font-weight: 600; line-height: 1.42;
          color: var(--navy); margin-bottom: 30px;
        }
        .choices { display: flex; flex-direction: column; gap: 12px; }
        .choice {
          display: flex; align-items: center; gap: 15px;
          padding: 16px 18px; border-radius: 15px;
          border: 1.5px solid var(--border); background: rgba(255,255,255,.65);
          cursor: pointer; font-size: 15px; color: var(--navy); line-height: 1.45;
          transition: border-color .13s, background .13s, transform .11s;
          text-align: left; width: 100%; font-family: inherit;
        }
        .choice:hover:not(:disabled) {
          border-color: var(--accent-line); background: var(--accent-dim);
          transform: translateX(3px);
        }
        .choice:disabled { cursor: default; }
        .choice.correct { border-color: var(--correct-line); background: var(--correct-bg); }
        .choice.wrong   { border-color: var(--wrong-line);   background: var(--wrong-bg); }
        .choice.skipped { border-color: rgba(86,96,112,.22); background: rgba(27,36,66,.045); }
        .choice.recorded { border-color: var(--accent-line); background: var(--accent-dim); }
        .choice-letter {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
          background: rgba(27,36,66,.07); color: var(--muted);
          transition: background .13s, color .13s;
        }
        .choice.correct .choice-letter { background: var(--correct); color: #fff; }
        .choice.wrong   .choice-letter { background: var(--wrong);   color: #fff; }
        .choice.skipped .choice-letter { background: var(--muted); color: #fff; }
        .choice.recorded .choice-letter { background: var(--accent); color: #fff; }
        .sequence-instruction {
          margin: -18px 0 14px; color: var(--muted);
          font-size: 13px; line-height: 1.45;
        }
        .sequence-list { display: flex; flex-direction: column; gap: 9px; }
        .sequence-item {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 32px 38px minmax(0,1fr) auto;
          align-items: center; gap: 10px; min-height: 66px; padding: 10px 12px;
          border: 1.5px solid var(--border); border-radius: 8px;
          background: rgba(255,255,255,.76); color: var(--navy);
          box-shadow: 0 4px 12px rgba(27,36,66,.045);
        }
        .sequence-item.is-dragging {
          z-index: 4; border-color: var(--accent);
          background: #fff; box-shadow: 0 16px 34px rgba(27,36,66,.18);
        }
        .sequence-number {
          width: 30px; height: 30px; border-radius: 50%;
          display: grid; place-items: center;
          background: var(--navy); color: #fff;
          font-size: 12px; font-weight: 800;
        }
        .sequence-handle {
          width: 36px; height: 36px; border-radius: 7px;
          display: grid; place-items: center; border: 1px solid var(--border);
          background: rgba(27,36,66,.045); color: var(--muted);
          font: 800 20px/1 system-ui, sans-serif; cursor: grab;
          touch-action: none;
        }
        .sequence-handle:active { cursor: grabbing; }
        .sequence-handle:disabled { cursor: default; opacity: .5; }
        .sequence-text { font-size: 14.5px; line-height: 1.4; font-weight: 600; }
        .sequence-step-controls { display: inline-flex; gap: 5px; }
        .sequence-step-controls button {
          width: 30px; height: 30px; border-radius: 7px;
          border: 1px solid var(--border); background: rgba(255,255,255,.78);
          color: var(--navy); font: 800 14px/1 system-ui, sans-serif; cursor: pointer;
        }
        .sequence-step-controls button:hover:not(:disabled) {
          border-color: var(--accent-line); background: var(--accent-dim);
        }
        .sequence-step-controls button:disabled { opacity: .28; cursor: default; }
        .sequence-actions {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-top: 16px;
        }
        .sequence-submit, .sequence-skip {
          min-height: 43px; border-radius: 999px; padding: 0 19px;
          font: 750 13px/1 inherit; cursor: pointer;
        }
        .sequence-submit {
          border: 0; background: var(--navy); color: #fff;
          box-shadow: 0 9px 22px rgba(27,36,66,.22);
        }
        .sequence-submit:hover:not(:disabled) { background: #253566; transform: translateY(-1px); }
        .sequence-skip {
          border: 1px solid var(--border); background: rgba(255,255,255,.64);
          color: var(--muted);
        }
        .sequence-submit:disabled, .sequence-skip:disabled { opacity: .55; cursor: default; }

        /* Feedback */
        .feedback-bar {
          margin-top: 20px; padding: 14px 18px; border-radius: 13px;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .feedback-bar.correct { background: var(--correct-bg); border: 1px solid var(--correct-line); }
        .feedback-bar.wrong   { background: var(--wrong-bg);   border: 1px solid var(--wrong-line); }
        .feedback-bar.skipped { background: rgba(27,36,66,.045); border: 1px solid rgba(86,96,112,.18); }
        .feedback-bar.recorded { background: var(--accent-dim); border: 1px solid var(--accent-line); }
        .feedback-text { font-size: 13.5px; font-weight: 600; }
        .feedback-bar.correct .feedback-text { color: var(--correct); }
        .feedback-bar.wrong   .feedback-text { color: var(--wrong); }
        .feedback-bar.skipped .feedback-text { color: var(--muted); }
        .feedback-bar.recorded .feedback-text { color: #0a6969; }
        .next-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 18px; border-radius: 999px;
          background: var(--navy); color: #fff;
          font-size: 13px; font-weight: 600; border: none; cursor: pointer;
          white-space: nowrap; flex-shrink: 0; font-family: inherit;
          transition: background .13s, transform .11s; text-decoration: none;
        }
        .next-btn:hover { background: #253566; transform: translateY(-1px); }

        /* Score row */
        .score-row {
          display: flex; gap: 20px; margin-top: 20px; padding-top: 16px;
          border-top: 1px solid var(--border);
        }
        .score-item { font-size: 12.5px; color: var(--muted); }
        .score-item strong { color: var(--navy); font-size: 15px; display: block; }

        /* Milestone banner */
        .milestone-banner {
          margin-top: 16px; padding: 14px 16px; border-radius: 12px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          font-size: 13px; color: #0a5a5a; font-weight: 500;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .milestone-banner svg { width: 16px; height: 16px; flex-shrink: 0; color: var(--accent); }
        .milestone-copy { display: flex; align-items: center; gap: 8px; line-height: 1.4; }
        .milestone-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .milestone-results, .milestone-dashboard {
          min-height: 36px; display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px; padding: 0 14px; font: 750 12px "Inter", sans-serif;
          text-decoration: none; cursor: pointer; white-space: nowrap;
        }
        .milestone-results { color: #fff; background: var(--navy); border: 1px solid var(--navy); }
        .milestone-dashboard { color: #0a6969; background: rgba(255,255,255,.6); border: 1px solid var(--accent-line); }

        .cosmic-burst {
          position: fixed; inset: 0; z-index: 12; pointer-events: none; overflow: hidden;
          mix-blend-mode: screen;
        }
        .firework {
          --spark-length: 34px;
          --delay: 0s;
          position: absolute; width: 112px; height: 96px;
          left: 10vw; top: 24vh;
          color: rgba(173,232,255,1);
          opacity: 0;
          animation: fireworkPop 1.75s ease-out var(--delay) both;
        }
        .firework::before {
          content: ""; position: absolute; left: 50%; top: 50%;
          width: 8px; height: 8px; border-radius: 999px;
          background: currentColor;
          box-shadow: 0 0 18px currentColor, 0 0 36px rgba(255,255,255,.32);
          transform: translate(-50%, -50%);
          animation: fireworkCore 1.75s ease-out var(--delay) both;
        }
        .spark {
          position: absolute; left: 50%; top: 50%;
          width: var(--spark-length); height: 3px; border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,.95), currentColor 55%, transparent);
          filter: drop-shadow(0 0 7px currentColor);
          transform-origin: 0 50%;
          opacity: 0;
          animation: fireworkSpark 1.75s ease-out var(--delay) both;
        }
        .spark-a { --x: -7px;  --y: -8px;  --r: -125deg; }
        .spark-b { --x: -3px;  --y: -10px; --r: -98deg; }
        .spark-c { --x: 4px;   --y: -8px;  --r: -62deg; }
        .spark-d { --x: 8px;   --y: -2px;  --r: -28deg; }
        .spark-e { --x: 4px;   --y: 7px;   --r: 32deg; opacity: .72; }
        .spark-f { --x: -8px;  --y: 6px;   --r: 148deg; opacity: .72; }
        .firework-one { left: 8vw; top: 25vh; color: rgba(173,232,255,1); --delay: 0s; }
        .firework-two { left: 13vw; top: 18vh; color: rgba(212,160,23,.98); --delay: .16s; transform: scale(.9); }
        .firework-three { left: 17vw; top: 28vh; color: rgba(10,163,163,.98); --delay: .32s; transform: scale(.82); }
        @keyframes fireworkPop {
          0% { opacity: 0; }
          12% { opacity: 1; }
          72% { opacity: .88; }
          100% { opacity: 0; }
        }
        @keyframes fireworkCore {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(.25); }
          16% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(.55); }
        }
        @keyframes fireworkSpark {
          0% { opacity: 0; width: 8px; transform: translate(var(--x), var(--y)) rotate(var(--r)) scaleX(.2); }
          18% { opacity: 1; width: var(--spark-length); }
          100% { opacity: 0; width: calc(var(--spark-length) * 1.12); transform: translate(calc(var(--x) * 3.2), calc(var(--y) * 3.2)) rotate(var(--r)) scaleX(1); }
        }

        /* Floating results button */
        .results-fab {
          position: fixed; bottom: 28px; right: 28px; z-index: 30;
          display: flex; align-items: center; gap: 11px;
          padding: 18px 28px; border-radius: 999px;
          background: linear-gradient(135deg, var(--navy), #253566 58%, #0a6e6e);
          color: #fff;
          font-size: 16px; font-weight: 800; border: none; cursor: pointer;
          box-shadow: 0 16px 38px rgba(0,0,0,.32), 0 0 28px rgba(10,163,163,.18);
          transition: transform .12s, box-shadow .15s;
          animation: fabIn .4s ease;
        }
        @keyframes fabIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .results-fab:hover { transform: translateY(-3px); box-shadow: 0 20px 44px rgba(0,0,0,.36), 0 0 34px rgba(10,163,163,.24); }
        .results-fab svg { width: 18px; height: 18px; }

        /* Results overlay */
        .overlay-backdrop {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(0,0,0,.6); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 24px;
        }
        .overlay-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 24px; padding: 36px 40px;
          box-shadow: var(--shadow); width: 100%; max-width: 480px;
          position: relative; animation: cardIn .25s ease;
        }
        .overlay-close {
          position: absolute; top: 16px; right: 16px;
          width: 32px; height: 32px; border-radius: 999px;
          background: rgba(27,36,66,.07); border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--muted); transition: background .13s;
        }
        .overlay-close:hover { background: rgba(27,36,66,.12); }
        .report-card { max-width: 520px; }
        .report-title {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 24px; font-weight: 650; color: var(--navy); margin-bottom: 8px;
        }
        .report-desc { font-size: 13.5px; color: var(--muted); line-height: 1.55; margin-bottom: 16px; }
        .report-question {
          padding: 12px 14px; border-radius: 12px;
          background: rgba(27,36,66,.045); border: 1px solid rgba(27,36,66,.08);
          color: var(--navy); font-size: 13.5px; line-height: 1.45; margin-bottom: 16px;
        }
        .report-options {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px; margin-bottom: 14px;
        }
        .report-option {
          border: 1.5px solid var(--border); background: rgba(255,255,255,.72);
          color: var(--navy); border-radius: 12px; padding: 11px 12px;
          font-size: 13.5px; font-weight: 700; cursor: pointer; font-family: inherit;
          transition: border-color .13s, background .13s, color .13s;
        }
        .report-option.is-active {
          background: var(--accent-dim); border-color: var(--accent-line); color: #0a5a5a;
        }
        .report-textarea {
          width: 100%; min-height: 108px; resize: vertical;
          border: 1.5px solid var(--border); border-radius: 12px;
          padding: 12px 14px; font-size: 14px; line-height: 1.5;
          font-family: inherit; color: var(--navy); outline: none;
          background: rgba(255,255,255,.74);
        }
        .report-textarea:focus { border-color: var(--accent-line); background: #fff; }
        .report-error { color: var(--wrong); font-size: 12.5px; font-weight: 650; margin-top: 10px; }
        .report-actions {
          display: flex; align-items: center; justify-content: flex-end;
          gap: 10px; margin-top: 16px;
        }
        .report-submit {
          border: none; border-radius: 999px; background: var(--navy); color: #fff;
          padding: 10px 18px; font-size: 13.5px; font-weight: 750;
          cursor: pointer; font-family: inherit;
        }
        .report-submit:disabled { opacity: .62; cursor: default; }
        .report-cancel {
          border: 1px solid var(--border); border-radius: 999px;
          background: rgba(255,255,255,.58); color: var(--muted);
          padding: 9px 16px; font-size: 13px; font-weight: 650;
          cursor: pointer; font-family: inherit;
        }
        .report-sent {
          padding: 22px 6px 4px; text-align: center;
          color: var(--correct); font-size: 15px; font-weight: 750;
        }
        .overlay-score {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 64px; font-weight: 700; color: var(--navy);
          line-height: 1; text-align: center; margin-bottom: 4px;
        }
        .overlay-label { text-align: center; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 20px; }
        .overlay-stats { display: flex; justify-content: center; gap: 28px; margin-bottom: 24px; }
        .overlay-stat { text-align: center; }
        .overlay-stat strong { display: block; font-size: 20px; font-weight: 700; color: var(--navy); font-family: "Crimson Pro", Georgia, serif; }
        .overlay-stat span { font-size: 12px; color: var(--muted); }
        .overlay-divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
        .overlay-heading { font-family: "Crimson Pro", Georgia, serif; font-size: 18px; font-weight: 600; color: var(--navy); margin-bottom: 12px; }
        .overlay-desc { font-size: 13.5px; color: var(--muted); line-height: 1.65; margin-bottom: 16px; }
        .google-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 12px 20px; border-radius: 12px;
          background: #fff; color: #1f2937; font-size: 14px; font-weight: 600;
          border: 1.5px solid rgba(27,36,66,.12); cursor: pointer; font-family: inherit;
          box-shadow: 0 2px 8px rgba(0,0,0,.08); transition: box-shadow .14s, transform .12s;
          margin-bottom: 12px;
        }
        .google-btn:hover { box-shadow: 0 4px 16px rgba(0,0,0,.12); transform: translateY(-1px); }
        .google-btn svg { width: 18px; height: 18px; flex-shrink: 0; }
        .divider-or { display: flex; align-items: center; gap: 10px; margin: 12px 0; }
        .divider-or::before, .divider-or::after { content: ""; flex: 1; height: 1px; background: var(--border); }
        .divider-or span { font-size: 12px; color: var(--muted); }
        .magic-row { display: flex; gap: 8px; }
        .magic-input {
          flex: 1; padding: 11px 14px; border-radius: 10px;
          border: 1.5px solid var(--border); font-size: 14px; font-family: inherit;
          outline: none; transition: border-color .13s;
        }
        .magic-input:focus { border-color: var(--accent-line); }
        .magic-btn {
          padding: 11px 18px; border-radius: 10px;
          background: var(--navy); color: #fff; font-size: 13.5px; font-weight: 600;
          border: none; cursor: pointer; font-family: inherit; white-space: nowrap;
          transition: background .13s;
        }
        .magic-btn:hover { background: #253566; }
        .save-success { font-size: 13.5px; color: var(--correct); font-weight: 600; text-align: center; padding: 12px; }
        .skip-link { display: block; text-align: center; margin-top: 12px; font-size: 13px; color: var(--muted); cursor: pointer; }
        .skip-link:hover { color: var(--navy); }

        /* Center card (loading/error/complete) */
        .center-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
        .big-num { font-family: "Crimson Pro", Georgia, serif; font-size: 72px; font-weight: 700; color: var(--navy); line-height: 1; }
        .card-heading { font-family: "Crimson Pro", Georgia, serif; font-size: 26px; font-weight: 600; color: var(--navy); }
        .card-sub { font-size: 15px; color: var(--muted); line-height: 1.6; max-width: 400px; }
        .btn-primary {
          display: flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 999px;
          background: var(--navy); color: #fff; font-size: 15px; font-weight: 600;
          text-decoration: none; border: none; cursor: pointer;
          box-shadow: 0 10px 28px rgba(27,36,66,.35); transition: background .15s, transform .13s;
        }
        .btn-primary:hover { background: #253566; transform: translateY(-2px); }
        .btn-secondary {
          font-size: 14px; color: var(--muted); text-decoration: none;
          padding: 10px 20px; border-radius: 999px;
          border: 1px solid var(--border); background: rgba(255,255,255,.5);
          transition: color .14s, background .14s;
        }
        .btn-secondary:hover { color: var(--navy); background: rgba(255,255,255,.8); }
        .spinner {
          width: 40px; height: 40px; border-radius: 50%;
          border: 3px solid rgba(27,36,66,.1); border-top-color: var(--accent);
          animation: spin .8s linear infinite; margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .selection-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px; width: 100%;
        }
        .testament-card {
          text-align: left; border: 1.5px solid var(--border);
          background: rgba(255,255,255,.68); border-radius: 18px;
          padding: 22px; cursor: pointer; font-family: inherit;
          transition: transform .14s, border-color .14s, background .14s, box-shadow .14s;
        }
        .testament-card:hover,
        .testament-card:focus-visible {
          outline: none; transform: translateY(-2px);
          border-color: var(--accent-line); background: #fff;
          box-shadow: 0 14px 30px rgba(27,36,66,.13);
        }
        .testament-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
        .testament-title {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 24px; font-weight: 700; color: var(--navy);
        }
        .pilot-badge {
          display: inline-flex; align-items: center; border-radius: 999px;
          padding: 5px 9px; font-size: 10.5px; font-weight: 850;
          letter-spacing: .08em; text-transform: uppercase;
          background: #fef3c7; color: #92400e; border: 1px solid #fde68a;
        }
        .testament-desc { color: var(--muted); font-size: 14px; line-height: 1.55; }
        .nt-scope-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px; width: 100%; max-height: 330px; overflow: auto; padding-right: 4px;
        }
        .nt-scope-btn {
          text-align: left; border: 1.5px solid var(--border);
          border-radius: 13px; background: rgba(255,255,255,.66);
          padding: 12px 13px; cursor: pointer; font-family: inherit;
          transition: border-color .13s, background .13s, transform .11s;
        }
        .nt-scope-btn:hover,
        .nt-scope-btn:focus-visible {
          outline: none; border-color: var(--accent-line);
          background: var(--accent-dim); transform: translateY(-1px);
        }
        .nt-scope-btn.is-active {
          border-color: var(--accent-line); background: var(--accent-dim);
        }
        .nt-scope-btn strong { display: block; color: var(--navy); font-size: 13.5px; margin-bottom: 3px; }
        .nt-scope-btn span { color: var(--muted); font-size: 11.5px; line-height: 1.35; }
        .pilot-note {
          padding: 12px 14px; border-radius: 12px;
          background: rgba(212,160,23,.12); border: 1px solid rgba(212,160,23,.26);
          color: #744a08; font-size: 13px; line-height: 1.5; font-weight: 600;
        }
        .nt-results-grid {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px; width: 100%;
        }
        .nt-result-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 11px 13px; border-radius: 12px; background: rgba(27,36,66,.045);
          color: var(--navy); font-size: 13px;
        }
        .nt-result-row span { color: var(--muted); font-weight: 650; }

        @media (max-width: 640px) {
          .card { padding: 30px 22px; max-width: 100%; }
          .nav { padding: 12px 16px; }
          .card-prompt { font-size: 20px; }
          .question-head { align-items: flex-start; }
          .report-options { grid-template-columns: 1fr; }
          .nav-center { min-width: 0; }
          .nav-subphase { display: none; }
          .progress-bar-track { width: 112px; }
          .results-fab { bottom: 16px; right: 16px; padding: 10px 16px; font-size: 13px; }
          .overlay-card { padding: 28px 24px; }
          .overlay-score { font-size: 52px; }
          .selection-grid, .nt-scope-grid, .nt-results-grid { grid-template-columns: 1fr; }
          .milestone-banner { align-items: stretch; flex-direction: column; }
          .milestone-actions { display: grid; grid-template-columns: 1fr 1fr; }
          .sequence-item { grid-template-columns: 30px 34px minmax(0,1fr); padding: 9px; gap: 8px; }
          .sequence-step-controls { grid-column: 2 / -1; justify-content: flex-end; }
          .sequence-actions { align-items: stretch; flex-direction: column-reverse; }
          .sequence-submit, .sequence-skip { width: 100%; }
        }
      `}</style>

      <canvas ref={canvasRef} className={`stars ${isDashboardTransitioning ? "dashboard-transition" : ""}`} aria-hidden="true" />
      {answeredCount > 0 && !isDashboardTransitioning && (
        <div className="confidence-nebula-label" aria-hidden="true">
          <span>Evidence</span>
          <strong>{scoreEvidence?.evidence_level ?? "Gathering"}</strong>
          <small>{scoreEvidence ? `${scoreEvidence.n_responses} responses` : "Updating estimate"}</small>
        </div>
      )}
      {isDashboardTransitioning && <div className="dashboard-warp" aria-hidden="true" />}
      {assessmentMode === "NT" && phase === "feedback" && isCorrect && (
        <div key={`${answeredCount}-${question?.out_generated_question_id || "correct"}`} className="cosmic-burst" aria-hidden="true">
          <span className="firework firework-one"><i className="spark spark-a" /><i className="spark spark-b" /><i className="spark spark-c" /><i className="spark spark-d" /><i className="spark spark-e" /><i className="spark spark-f" /></span>
          <span className="firework firework-two"><i className="spark spark-a" /><i className="spark spark-b" /><i className="spark spark-c" /><i className="spark spark-d" /><i className="spark spark-e" /><i className="spark spark-f" /></span>
          <span className="firework firework-three"><i className="spark spark-a" /><i className="spark spark-b" /><i className="spark spark-c" /><i className="spark spark-d" /><i className="spark spark-e" /><i className="spark spark-f" /></span>
        </div>
      )}

      {/* Nav */}
      <nav className={`nav ${isDashboardTransitioning ? "dashboard-transition" : ""}`}>
        <span className="brand-wrap">
          <Link className="nav-brand" href="/">Open Bible Assessment</Link>
          <span className="beta-badge" tabIndex={0}>
            Beta
            <span className="beta-tooltip" role="tooltip">
              Open Bible Assessment is still in active development. Scores and questions are being refined, so your results may shift as the platform matures.
            </span>
          </span>
        </span>
        <div className="nav-center">
          <span className="nav-phase">{displayNavPhaseLabel}</span>
          <span className="nav-subphase">{displayNavSubLabel}</span>
          <div className="nav-progress-row">
            <span className="nav-count">{answeredCount}</span>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${displayProgressPct}%` }} />
            </div>
            <span className="nav-count-right">{displayProgressEnd}</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {assessmentMode === "OT" && (isSignedIn ? (
            <button
              onClick={handleSignOut}
              style={{fontSize:12,color:"rgba(255,255,255,.4)",background:"none",border:"1px solid rgba(255,255,255,.08)",borderRadius:999,padding:"6px 12px",cursor:"pointer",fontFamily:"inherit",transition:"color .14s"}}
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => setShowResults(true)}
              style={{fontSize:12,color:"rgba(255,255,255,.4)",background:"none",border:"1px solid rgba(255,255,255,.08)",borderRadius:999,padding:"6px 12px",cursor:"pointer",fontFamily:"inherit",transition:"color .14s"}}
            >
              Sign in
            </button>
          ))}
          {attemptId && answeredCount > 0 && (
            <Link className="nav-exit" href={`/results/${attemptId}`}>Review session</Link>
          )}
          <Link className="nav-exit" href="/">Exit</Link>
        </div>
      </nav>

      <div className={`scene ${isDashboardTransitioning ? "dashboard-transition" : ""}`}>
        {assessmentMode === "select" && (
          <div className="card center-card">
            <p className="pilot-badge">Choose assessment</p>
            <div className="card-heading">What would you like to assess?</div>
            <p className="card-sub">The Old Testament assessment is the full adaptive BLI flow. The New Testament pilot is a developmental preview.</p>
            <div className="selection-grid">
              <button className="testament-card" type="button" onClick={() => window.location.href = "/assess"}>
                <div className="testament-top">
                  <strong className="testament-title">Old Testament Assessment</strong>
                </div>
                <p className="testament-desc">Full adaptive assessment across the Old Testament.</p>
              </button>
              <button className="testament-card" type="button" onClick={() => window.location.href = NT_PILOT_ENABLED ? "/assess?testament=NT" : "/assess?choose=1"}>
                <div className="testament-top">
                  <strong className="testament-title">New Testament Pilot</strong>
                  <span className="pilot-badge">Pilot</span>
                </div>
                <p className="testament-desc">Preview questions across all 27 New Testament books. Results are developmental and not yet credential-grade.</p>
              </button>
            </div>
            {!NT_PILOT_ENABLED && <p className="card-sub">The New Testament pilot is currently unavailable.</p>}
          </div>
        )}

        {assessmentMode === "NT" && phase === "starting" && (
          <div className="card center-card">
            <span className="pilot-badge">Pilot</span>
            <div className="card-heading">New Testament Pilot</div>
            <p className="card-sub">Choose a section or book. These results are developmental and do not affect your verified BLI credential.</p>
            {ntError && <p className="pilot-note">{ntError}</p>}
            {!ntMetadataLoaded && !ntError ? (
              <div className="spinner" />
            ) : (
              <>
                <div className="nt-scope-grid" role="group" aria-label="New Testament pilot scope">
                  {ntScopeOptions.map(option => (
                    <button
                      key={`${option.kind}-${option.value}`}
                      type="button"
                      className={`nt-scope-btn ${ntScope.kind === option.kind && ntScope.value === option.value ? "is-active" : ""}`}
                      onClick={() => setNtScope(option)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  ))}
                </div>
                {ntBooks.length === 0 && (
                  <p className="pilot-note">Book metadata is not visible yet, so individual book filters are hidden. You can still start the all-NT pilot if the NT question RPC is installed.</p>
                )}
                <p className="pilot-note">New Testament results are currently developmental and do not affect your verified BLI credential.</p>
                <button className="btn-primary" type="button" onClick={() => startNtPilot()} disabled={ntLoading}>
                  {ntLoading ? "Loading..." : `Start ${ntScope.label}`}
                </button>
                <Link className="btn-secondary" href="/assess?choose=1">Back to assessment choices</Link>
              </>
            )}
          </div>
        )}

        {assessmentMode === "OT" && phase === "starting" && (
          <div className="card center-card">
            <div className="spinner" />
            <p className="card-sub">Loading your assessment...</p>
          </div>
        )}

        {phase === "error" && assessmentMode !== "select" && (
          <div className="card center-card">
            <div className="card-heading">Something went wrong</div>
            <p className="card-sub">{errorMsg}</p>
            {assessmentMode === "NT" ? (
              <Link className="btn-primary" href="/assess?testament=NT">Explore another NT section</Link>
            ) : (
              <button
                className="btn-primary"
                type="button"
                onClick={() => {
                  clearAssessmentBrowserStorage();
                  window.location.href = "/assess";
                }}
              >
                Start fresh assessment
              </button>
            )}
          </div>
        )}

        {(phase === "question" || phase === "feedback") && question && assessmentMode !== "select" && (
          <div className="card">
            {/* Location graphic */}
            <div className="question-head">
              <div className="location-bar">
                <span
                  className="loc-pill"
                  style={{
                    color: SECTION_COLORS[question.section] || "#0aa3a3",
                    background: (SECTION_COLORS[question.section] || "#0aa3a3") + "18",
                    borderColor: (SECTION_COLORS[question.section] || "#0aa3a3") + "30",
                  }}
                >
                  <span
                    className="loc-dot"
                    style={{ background: SECTION_COLORS[question.section] || "#0aa3a3" }}
                  />
                  {assessmentMode === "NT" ? "New Testament Pilot" : question.section}
                </span>
                <span className="loc-sep">·</span>
                <span className="loc-pill" style={{ color: "#566070", background: "rgba(27,36,66,.05)", borderColor: "rgba(27,36,66,.09)" }}>
                  {assessmentMode === "NT" ? ((question as NtPilotQuestion).book_name || question.book_code) : BOOK_NAMES[question.book_code] || question.book_code}
                </span>
                {assessmentMode === "OT" && isTargetedOtAssessment && (
                  <>
                    <span className="loc-sep">·</span>
                    <span className="loc-pill" style={{ color: "#087f7f", background: "rgba(10,163,163,.10)", borderColor: "rgba(10,163,163,.22)" }}>
                      {otAssessment?.label ?? otRequest.label ?? "Targeted assessment"}
                    </span>
                  </>
                )}
                {assessmentMode === "NT" && (
                  <>
                    <span className="loc-sep">·</span>
                    <span className="loc-pill" style={{ color: "#92400e", background: "#fef3c7", borderColor: "#fde68a" }}>
                      Pilot
                    </span>
                  </>
                )}
                {question.importance_tier === 1 && (
                  <>
                    <span className="loc-sep">·</span>
                    <span className="loc-pill" style={{ color: "#b45309", background: "#fef3c7", borderColor: "#fde68a" }}>
                      <span className="tier-star">★</span> Tier 1
                    </span>
                  </>
                )}
              </div>
              {assessmentMode === "OT" && (
                <button
                  className="report-trigger"
                  type="button"
                  aria-label="Report a problem with this question"
                  title="Report a problem"
                  onClick={() => {
                    setReportStatus("idle");
                    setReportError("");
                    setShowReportModal(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <path d="M4 22V15" />
                  </svg>
                </button>
              )}
            </div>

            <p className="card-prompt">{question.prompt}</p>

            {isSequenceQuestion ? (
              <div className="sequence-question">
                <p className="sequence-instruction">Drag the events into order, earliest first.</p>
                <DndContext
                  sensors={sequenceSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSequenceDragEnd}
                >
                  <SortableContext
                    items={sequenceOrder.map(item => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="sequence-list" aria-label="Events in chronological order">
                      {sequenceOrder.map((item, index) => (
                        <SortableSequenceItem
                          key={item.id}
                          item={item}
                          index={index}
                          disabled={phase === "feedback" || isSubmittingAnswer}
                          isFirst={index === 0}
                          isLast={index === sequenceOrder.length - 1}
                          onMove={moveSequenceItem}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                {phase === "question" && (
                  <div className="sequence-actions">
                    <button
                      className="sequence-skip"
                      type="button"
                      disabled={isSubmittingAnswer}
                      onClick={() => submitAnswer(IDK_CHOICE_ID)}
                    >
                      I don&apos;t know - skip
                    </button>
                    <button
                      className="sequence-submit"
                      type="button"
                      disabled={isSubmittingAnswer || sequenceOrder.length === 0}
                      onClick={(event) => {
                        pendingSpawnRef.current = { x: event.clientX, y: event.clientY };
                        submitSequenceOrder();
                      }}
                    >
                      Submit order
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="choices">
                {visibleChoices.map((choice, index) => (
                  <button
                    key={choice.id}
                    type="button"
                    className={`choice ${phase === "feedback" ? choiceLabel(choice.id) : ""}`}
                    onClick={(e) => {
                      if (phase !== "question" || isSubmittingAnswer) return;
                      pendingSpawnRef.current = { x: e.clientX, y: e.clientY };
                      if (assessmentMode === "NT") submitNtAnswer(choice.id);
                      else submitAnswer(choice.id);
                    }}
                    disabled={phase === "feedback" || isSubmittingAnswer}
                  >
                    <span className="choice-letter">{choice.id === IDK_CHOICE_ID ? "E" : choice.id || String.fromCharCode(65 + index)}</span>
                    {choice.text}
                  </button>
                ))}
              </div>
            )}

            {phase === "feedback" && (
              <>
                <div className={`feedback-bar ${assessmentMode === "OT" ? "recorded" : isSkipped ? "skipped" : isCorrect ? "correct" : "wrong"}`}>
                  <span className="feedback-text">
                    {assessmentMode === "OT"
                      ? "Answer recorded."
                      : isSkipped
                        ? "Skipped — the correct answer is highlighted."
                        : isCorrect
                          ? "Correct!"
                          : "Not quite — the correct answer is highlighted."}
                  </span>
                  <button className="next-btn" type="button" onClick={nextQuestion}>
                    Next →
                  </button>
                </div>

                {assessmentMode === "NT" && (
                  <div className="score-row">
                    <div className="score-item"><strong>{answeredCount}</strong>answered</div>
                    <div className="score-item"><strong>{correctCount}</strong>correct</div>
                    <div className="score-item"><strong>{accuracy}%</strong>accuracy</div>
                  </div>
                )}

                {assessmentMode === "OT" && answeredCount === otTargetCount && (
                  <div className="milestone-banner">
                    <span className="milestone-copy">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20v-6"/><path d="M6 20v-3"/><path d="M18 20v-9"/><path d="M3 3h18"/>
                      </svg>
                      {isTargetedOtAssessment
                        ? isScopeOtAssessment
                          ? `${otAssessment?.label ?? "Targeted"} test complete. Your BLI has been updated.`
                          : `${otAssessment?.label} retest complete. Your recommendation is being recalculated.`
                        : "Your BLI snapshot is ready."}
                    </span>
                    <span className="milestone-actions">
                      {attemptId && <Link className="milestone-results" href={`/results/${attemptId}`}>See results</Link>}
                      <button className="milestone-dashboard" type="button" onClick={transitionToDashboard}>Dashboard</button>
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {phase === "complete" && assessmentMode === "NT" && (
          <div className="card center-card">
            <span className="pilot-badge">Pilot results</span>
            <div className="big-num">{accuracy}<span style={{ fontSize: 32 }}>%</span></div>
            <div className="card-heading">New Testament Pilot complete</div>
            <p className="card-sub">You answered {correctCount} of {answeredCount} questions correctly in {ntScope.label}.</p>
            <p className="pilot-note">New Testament results are currently developmental and do not affect your verified BLI credential.</p>
            {attemptId && <Link className="btn-primary" href={`/results/${attemptId}`}>Review session results</Link>}
            <button className="btn-primary" type="button" onClick={() => startNtPilot(ntScope)}>Retry same scope</button>
            <Link className="btn-secondary" href="/assess?testament=NT">Explore another NT section</Link>
            <Link className="btn-secondary" href="/">Back to dashboard</Link>
          </div>
        )}

        {phase === "complete" && assessmentMode === "OT" && (
          <div className="card center-card">
            <div className="big-num">{accuracy}<span style={{ fontSize: 32 }}>%</span></div>
            <div className="card-heading">
              {isTargetedOtAssessment
                ? `${otAssessment?.label ?? "Targeted"} ${isScopeOtAssessment ? "test" : "retest"} complete`
                : "Assessment complete"}
            </div>
            <p className="card-sub">
              {isTargetedOtAssessment
                ? isScopeOtAssessment
                  ? "Your new evidence has been added to your BLI and the dashboard will reflect this book or section."
                  : "Your new evidence has been added to your BLI. The dashboard will now recalculate this learning unit and your next recommendation."
                : `You answered ${correctCount} of ${answeredCount} questions correctly.`}
            </p>
            {attemptId && <Link className="btn-primary" href={`/results/${attemptId}`}>Review session results</Link>}
            <Link className="btn-primary" href="/">View your dashboard</Link>
            {!isTargetedOtAssessment && (
              <Link className="btn-secondary" href="/assess">Keep going</Link>
            )}
          </div>
        )}
      </div>

      {showReportModal && question && (
        <div className="overlay-backdrop" onClick={e => e.target === e.currentTarget && setShowReportModal(false)}>
          <div className="overlay-card report-card">
            <button className="overlay-close" type="button" onClick={() => setShowReportModal(false)} aria-label="Close report form">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>

            {reportStatus === "sent" ? (
              <div className="report-sent">Thanks. This question has been flagged for review.</div>
            ) : (
              <>
                <h2 className="report-title">Report this question</h2>
                <p className="report-desc">Choose what looks wrong and add a note if it would help the review.</p>
                <div className="report-question">{question.prompt}</div>

                <div className="report-options" role="group" aria-label="Report reason">
                  {REPORT_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`report-option ${reportCategory === option.value ? "is-active" : ""}`}
                      onClick={() => {
                        setReportCategory(option.value);
                        setReportError("");
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <textarea
                  className="report-textarea"
                  value={reportText}
                  maxLength={2000}
                  onChange={e => setReportText(e.target.value)}
                  placeholder="Optional note"
                />
                {reportError && <p className="report-error">{reportError}</p>}

                <div className="report-actions">
                  <button type="button" className="report-cancel" onClick={() => setShowReportModal(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="report-submit"
                    onClick={submitQuestionReport}
                    disabled={isSubmittingReport || (reportCategory === "other" && reportText.trim().length === 0)}
                  >
                    {isSubmittingReport ? "Submitting..." : "Submit report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Results overlay */}
      {assessmentMode === "OT" && showResults && (
        <div className="overlay-backdrop" onClick={e => e.target === e.currentTarget && setShowResults(false)}>
          <div className="overlay-card">
            <button className="overlay-close" onClick={() => setShowResults(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>

            <div className="overlay-score">{accuracy}<span style={{ fontSize: 28 }}>%</span></div>
            <div className="overlay-label">BLI Score (preliminary)</div>

            <div className="overlay-stats">
              <div className="overlay-stat"><strong>{answeredCount}</strong><span>answered</span></div>
              <div className="overlay-stat"><strong>{correctCount}</strong><span>correct</span></div>
              <div className="overlay-stat"><strong>{nextMilestone - answeredCount}</strong><span>to next update</span></div>
            </div>

            <hr className="overlay-divider" />

            {!showSavePrompt ? (
              <>
                <p className="overlay-heading">Save your progress</p>
                <p className="overlay-desc">Create a free account to save your BLI score and track your knowledge over time. Your progress so far will be linked automatically.</p>
                <button className="google-btn" onClick={handleGoogleSignIn} disabled={saving}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
                <div className="divider-or"><span>or</span></div>
                {saved ? (
                  <p className="save-success">Check your email for a sign-in link!</p>
                ) : (
                  <div className="magic-row">
                    <input
                      className="magic-input"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleMagicLink()}
                    />
                    <button className="magic-btn" onClick={handleMagicLink} disabled={saving || !email}>
                      {saving ? "..." : "Send link"}
                    </button>
                  </div>
                )}
                <span className="skip-link" onClick={() => setShowResults(false)}>Keep going without saving</span>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
