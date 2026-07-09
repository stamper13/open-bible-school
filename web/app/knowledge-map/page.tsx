"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SectionKey = "Torah" | "Former Prophets" | "Latter Prophets" | "Writings";
type DimensionKey = "events" | "sequence" | "characters" | "speech" | "commands" | "details" | "structure" | "significance";
type MapMode = "mastery" | "tier" | "evidence";

type BankRow = {
  generated_question_id: string;
  question_type: string | null;
  payload: Record<string, unknown> | null;
  book_code: string | null;
  routing_score: number | null;
};

type AnswerRow = {
  generated_question_id: string | null;
  is_correct: boolean | null;
};

type Node = {
  id: string;
  section: SectionKey;
  dimension: DimensionKey;
  label: string;
  x: number;
  y: number;
  tier: 1 | 2 | 3;
  bankCount: number;
  answered: number;
  correct: number;
};

const SECTIONS: Array<{ key: SectionKey; books: string; color: string; x: number; y: number }> = [
  { key: "Torah", books: "Genesis - Deuteronomy", color: "#d4a017", x: 130, y: 210 },
  { key: "Former Prophets", books: "Joshua - Kings", color: "#0e8c6a", x: 360, y: 210 },
  { key: "Latter Prophets", books: "Isaiah - Malachi", color: "#2563c4", x: 590, y: 210 },
  { key: "Writings", books: "Psalms, Wisdom, Scrolls", color: "#7c3aed", x: 360, y: 410 },
];

const DIMENSIONS: Array<{ key: DimensionKey; label: string; short: string }> = [
  { key: "events", label: "Events", short: "Event" },
  { key: "sequence", label: "Sequence", short: "Seq" },
  { key: "characters", label: "Characters", short: "Char" },
  { key: "speech", label: "Speech & promise", short: "Speech" },
  { key: "commands", label: "Commands", short: "Cmd" },
  { key: "details", label: "Textual detail", short: "Detail" },
  { key: "structure", label: "Book structure", short: "Struct" },
  { key: "significance", label: "Significance", short: "Sig" },
];

const BOOK_SECTION: Record<string, SectionKey> = {
  GEN: "Torah", EXO: "Torah", LEV: "Torah", NUM: "Torah", DEU: "Torah",
  JOS: "Former Prophets", JDG: "Former Prophets", RUT: "Former Prophets", "1SA": "Former Prophets", "2SA": "Former Prophets",
  "1KI": "Former Prophets", "2KI": "Former Prophets", "1CH": "Former Prophets", "2CH": "Former Prophets", EZR: "Former Prophets",
  NEH: "Former Prophets", EST: "Former Prophets",
  ISA: "Latter Prophets", JER: "Latter Prophets", LAM: "Latter Prophets", EZE: "Latter Prophets", DAN: "Latter Prophets",
  HOS: "Latter Prophets", JOL: "Latter Prophets", AMO: "Latter Prophets", OBA: "Latter Prophets", JON: "Latter Prophets",
  MIC: "Latter Prophets", NAM: "Latter Prophets", HAB: "Latter Prophets", ZEP: "Latter Prophets", HAG: "Latter Prophets",
  ZEC: "Latter Prophets", MAL: "Latter Prophets",
  JOB: "Writings", PSA: "Writings", PRO: "Writings", ECC: "Writings", SNG: "Writings",
};

function dimensionForType(questionType: string | null): DimensionKey {
  const q = (questionType ?? "").toLowerCase();
  if (q.includes("chronology") || q.includes("sequence")) return "sequence";
  if (q.includes("relationship") || q.includes("role") || q.includes("oppressor") || q.includes("entity")) return "characters";
  if (q.includes("speech") || q.includes("promise")) return "speech";
  if (q.includes("command")) return "commands";
  if (q.includes("numeric") || q.includes("detail")) return "details";
  if (q.includes("outline")) return "structure";
  if (q.includes("significance") || q.includes("concept")) return "significance";
  return "events";
}

function tierFor(row: BankRow): 1 | 2 | 3 {
  const layer = Number(row.payload?.question_layer);
  if (layer === 1 || layer === 2 || layer === 3) return layer as 1 | 2 | 3;
  const score = Number(row.routing_score ?? 0);
  if (score >= 72) return 1;
  if (score >= 54) return 2;
  return 3;
}

function nodeStatus(node: Node) {
  if (node.answered === 0) return { label: "No evidence", pct: null, color: "#8a94a6" };
  const pct = Math.round((node.correct / node.answered) * 100);
  if (pct >= 80 && node.answered >= 3) return { label: "Stable", pct, color: "#0e8c6a" };
  if (pct >= 60) return { label: "Developing", pct, color: "#0aa3a3" };
  if (pct >= 35) return { label: "Fragile", pct, color: "#d4a017" };
  return { label: "Weak", pct, color: "#c2410c" };
}

function nodeColor(node: Node, mode: MapMode) {
  if (mode === "tier") return node.tier === 1 ? "#d4a017" : node.tier === 2 ? "#0aa3a3" : "#6b7f8a";
  if (mode === "evidence") return node.answered > 0 ? "#1b2442" : "#9aa3b2";
  return nodeStatus(node).color;
}

function nodeRadius(node: Node) {
  const tierBase = node.tier === 1 ? 17 : node.tier === 2 ? 14 : 11;
  return tierBase + Math.min(6, Math.sqrt(node.bankCount));
}

function buildNodes(bankRows: BankRow[], answerRows: AnswerRow[]) {
  const answerMap = new Map<string, { answered: number; correct: number }>();
  answerRows.forEach((answer) => {
    if (!answer.generated_question_id) return;
    const current = answerMap.get(answer.generated_question_id) ?? { answered: 0, correct: 0 };
    current.answered += 1;
    if (answer.is_correct) current.correct += 1;
    answerMap.set(answer.generated_question_id, current);
  });

  const grouped = new Map<string, Node>();
  bankRows.forEach((row) => {
    const book = (row.book_code ?? "").toUpperCase();
    const section = BOOK_SECTION[book];
    if (!section) return;
    const dimension = dimensionForType(row.question_type);
    const id = `${section}:${dimension}`;
    const sectionConfig = SECTIONS.find((item) => item.key === section)!;
    const dimIndex = DIMENSIONS.findIndex((item) => item.key === dimension);
    const ring = dimIndex < 4 ? 82 : 132;
    const angle = (-130 + (dimIndex % 4) * 72 + (dimIndex > 3 ? 28 : 0)) * Math.PI / 180;
    const existing = grouped.get(id) ?? {
      id,
      section,
      dimension,
      label: DIMENSIONS.find((item) => item.key === dimension)?.label ?? dimension,
      x: sectionConfig.x + Math.cos(angle) * ring,
      y: sectionConfig.y + Math.sin(angle) * ring,
      tier: 3,
      bankCount: 0,
      answered: 0,
      correct: 0,
    };
    const rowTier = tierFor(row);
    existing.tier = Math.min(existing.tier, rowTier) as 1 | 2 | 3;
    existing.bankCount += 1;
    const answer = answerMap.get(row.generated_question_id);
    if (answer) {
      existing.answered += answer.answered;
      existing.correct += answer.correct;
    }
    grouped.set(id, existing);
  });

  return [...grouped.values()];
}

export default function KnowledgeMapPage() {
  const [bankRows, setBankRows] = useState<BankRow[]>([]);
  const [answerRows, setAnswerRows] = useState<AnswerRow[]>([]);
  const [selectedDimension, setSelectedDimension] = useState<DimensionKey | "all">("all");
  const [selectedSection, setSelectedSection] = useState<SectionKey | "all">("all");
  const [mode, setMode] = useState<MapMode>("mastery");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMap() {
      setLoading(true);
      setLoadError(null);
      const { data: bank, error: bankError } = await supabase
        .from("v_question_bank")
        .select("generated_question_id,question_type,payload,book_code,routing_score")
        .limit(1000);
      if (bankError) {
        if (!cancelled) {
          setLoadError(bankError.message);
          setLoading(false);
        }
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!cancelled) setUserEmail(session?.user?.email ?? null);

      let answers: AnswerRow[] = [];
      if (session?.user?.id) {
        const { data: answerData } = await supabase
          .from("assessment_answers")
          .select("generated_question_id,is_correct")
          .eq("user_id", session.user.id);
        answers = (answerData ?? []) as AnswerRow[];
      }

      if (!cancelled) {
        setBankRows((bank ?? []) as BankRow[]);
        setAnswerRows(answers);
        setLoading(false);
      }
    }
    loadMap();
    return () => { cancelled = true; };
  }, []);

  const nodes = useMemo(() => buildNodes(bankRows, answerRows), [bankRows, answerRows]);
  const filteredNodes = nodes.filter((node) =>
    (selectedDimension === "all" || node.dimension === selectedDimension) &&
    (selectedSection === "all" || node.section === selectedSection)
  );
  const selectedNode = filteredNodes.find((node) => node.id === selectedNodeId) ?? filteredNodes[0] ?? null;
  const totalAnswered = nodes.reduce((sum, node) => sum + node.answered, 0);
  const fragileTierOne = nodes.filter((node) => node.tier === 1 && (node.answered === 0 || (node.correct / Math.max(1, node.answered)) < 0.6));

  return (
    <>
      <style>{`
        :root {
          --ink: #f8fbff; --muted: rgba(226,236,248,.68); --navy: #eaf4ff;
          --accent: #72e7ff; --card: rgba(5,8,18,.72);
          --border: rgba(210,232,255,.18); --shadow: 0 22px 58px rgba(0,0,0,.46), 0 4px 14px rgba(0,0,0,.28);
        }
        *, *::before, *::after { box-sizing: border-box; }
        body {
          margin: 0; color: var(--ink); font-family: "Inter", system-ui, -apple-system, sans-serif;
          background:
            radial-gradient(circle at 18% 22%, rgba(110,201,255,.26) 0 1px, transparent 2px),
            radial-gradient(circle at 73% 18%, rgba(255,207,139,.30) 0 1px, transparent 2px),
            radial-gradient(circle at 82% 62%, rgba(255,118,99,.24) 0 1px, transparent 2px),
            radial-gradient(ellipse at 68% 42%, rgba(199,91,61,.34), transparent 42%),
            radial-gradient(ellipse at 28% 36%, rgba(50,131,154,.28), transparent 45%),
            linear-gradient(145deg, #020611 0%, #0c1326 38%, #261411 68%, #050712 100%);
          background-attachment: fixed;
        }
        body::before {
          content: ""; position: fixed; inset: 0; pointer-events: none; z-index: -1;
          background-image:
            radial-gradient(circle, rgba(255,255,255,.92) 0 1px, transparent 1.8px),
            radial-gradient(circle, rgba(116,213,255,.72) 0 1px, transparent 1.8px),
            radial-gradient(circle, rgba(255,171,118,.65) 0 1px, transparent 1.8px);
          background-size: 97px 83px, 151px 137px, 211px 181px;
          background-position: 0 0, 31px 53px, 91px 19px;
          opacity: .72;
        }
        .nav {
          position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between;
          padding: 10px 32px; background: rgba(0,0,0,.72); backdrop-filter: blur(14px);
          border-bottom: 2px solid rgba(226,236,248,.36);
          box-shadow: 0 12px 28px rgba(0,0,0,.42);
        }
        .nav-brand { font-family: "Crimson Pro", Georgia, serif; font-size: 18px; font-weight: 650; color: #fff; text-decoration: none; text-shadow: 0 2px 12px rgba(114,231,255,.32); }
        .nav-links { display: flex; align-items: center; gap: 8px; }
        .nav-link { color: rgba(255,255,255,.68); text-decoration: none; font-size: 13px; font-weight: 760; padding: 8px 13px; border-radius: 4px; text-transform: uppercase; letter-spacing: .04em; }
        .nav-link:hover, .nav-link.active { color: #fff; background: rgba(255,255,255,.10); }
        .page { width: min(1440px, 100%); margin: 0 auto; padding: 22px 18px 34px; }
        .topbar {
          display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: center; margin-bottom: 14px;
          min-height: 94px; padding: 15px 22px 15px 24px; position: relative;
          background: linear-gradient(180deg, rgba(0,0,0,.78), rgba(0,0,0,.48));
          border-top: 2px solid rgba(255,255,255,.48); border-bottom: 2px solid rgba(255,255,255,.32);
          box-shadow: 0 18px 42px rgba(0,0,0,.38);
        }
        .topbar::after {
          content: "Dependency Star Chart"; position: absolute; left: 50%; bottom: -34px; transform: translateX(-50%);
          min-width: 340px; text-align: center; color: #fff; font-family: "Crimson Pro", Georgia, serif;
          font-size: 24px; font-weight: 700; padding: 8px 42px 10px;
          background: rgba(0,0,0,.68); border: 2px solid rgba(255,255,255,.30);
          clip-path: polygon(0 0, 100% 0, 86% 100%, 14% 100%);
          text-shadow: 0 2px 10px rgba(0,0,0,.8);
        }
        .title { font-family: "Crimson Pro", Georgia, serif; font-size: clamp(34px, 5vw, 56px); color: #fff; line-height: .95; margin: 0; text-shadow: 0 4px 18px rgba(0,0,0,.86); }
        .subtitle { margin: 11px 0 0; color: rgba(238,246,255,.78); line-height: 1.45; max-width: 760px; font-size: 14px; text-shadow: 0 2px 12px rgba(0,0,0,.72); }
        .summary { display: grid; grid-template-columns: repeat(3, minmax(112px, 1fr)); gap: 10px; min-width: 380px; }
        .summary-item { background: rgba(5,8,18,.70); border: 1px solid rgba(226,236,248,.22); border-radius: 4px; padding: 11px 14px; box-shadow: inset 0 0 18px rgba(114,231,255,.06), 0 8px 24px rgba(0,0,0,.28); }
        .summary-value { display: block; font-family: "Crimson Pro", Georgia, serif; font-size: 32px; color: #fff; font-weight: 800; line-height: 1; text-shadow: 0 0 12px rgba(114,231,255,.22); }
        .summary-label { display: block; margin-top: 4px; color: rgba(238,246,255,.70); font-size: 10px; font-weight: 850; letter-spacing: .12em; text-transform: uppercase; }
        .shell { display: grid; grid-template-columns: 282px minmax(0, 1fr) 292px; gap: 0; align-items: stretch; margin-top: 42px; min-height: calc(100vh - 205px); }
        .panel { background: rgba(4,7,16,.66); border: 1px solid rgba(226,236,248,.20); border-radius: 0; box-shadow: var(--shadow); overflow: hidden; backdrop-filter: blur(10px); }
        .panel-pad { padding: 17px; }
        .panel-title { font-size: 12px; color: rgba(238,246,255,.72); font-weight: 900; letter-spacing: .14em; text-transform: uppercase; margin: 0 0 12px; text-shadow: 0 2px 10px rgba(0,0,0,.8); }
        .control-group { display: grid; gap: 7px; margin-bottom: 18px; }
        .control-btn {
          width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 8px;
          border: 1px solid rgba(226,236,248,.14); background: rgba(255,255,255,.05); color: rgba(238,246,255,.84);
          border-radius: 3px; padding: 10px 11px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 760;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
        }
        .control-btn:hover { background: rgba(255,255,255,.10); color: #fff; }
        .control-btn.active { border-color: rgba(114,231,255,.52); background: rgba(114,231,255,.13); color: #fff; box-shadow: 0 0 18px rgba(114,231,255,.10), inset 0 0 16px rgba(114,231,255,.08); }
        .dot-key { width: 10px; height: 10px; border-radius: 50%; display: inline-block; background: var(--key-color); }
        .mode-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: rgba(255,255,255,.08); padding: 4px; border-radius: 3px; }
        .mode-tabs button { border: 0; border-radius: 2px; background: transparent; color: rgba(238,246,255,.62); font: inherit; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; font-weight: 900; padding: 9px 6px; cursor: pointer; }
        .mode-tabs button.active { background: rgba(255,255,255,.92); color: #111827; box-shadow: 0 2px 8px rgba(0,0,0,.28); }
        .map-panel {
          position: relative; min-height: 690px; border-left: 0; border-right: 0;
          background:
            radial-gradient(circle at 42% 35%, rgba(255,255,255,.26) 0 2px, transparent 3px),
            radial-gradient(circle at 78% 18%, rgba(114,231,255,.30) 0 1px, transparent 2px),
            radial-gradient(circle at 22% 70%, rgba(255,190,134,.30) 0 1px, transparent 2px),
            radial-gradient(ellipse at 62% 48%, rgba(161,73,58,.28), transparent 48%),
            rgba(0,0,0,.36);
        }
        .map-panel::before {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
          background-size: 76px 76px;
          mask-image: radial-gradient(ellipse at center, black, transparent 76%);
        }
        .map-toolbar { position: absolute; left: 18px; top: 15px; z-index: 2; display: flex; gap: 8px; align-items: center; color: rgba(238,246,255,.76); font-size: 12px; font-weight: 850; text-transform: uppercase; letter-spacing: .08em; }
        .map-canvas { width: 100%; height: 690px; display: block; filter: drop-shadow(0 0 18px rgba(114,231,255,.12)); }
        .dep-line { stroke: rgba(244,249,255,.60); stroke-width: 2.6; fill: none; marker-end: url(#arrow); filter: drop-shadow(0 0 8px rgba(255,255,255,.30)); }
        .support-line { stroke: rgba(210,232,255,.18); stroke-width: 1.2; filter: drop-shadow(0 0 6px rgba(114,231,255,.16)); }
        .node-btn { cursor: pointer; }
        .node-btn:hover .node-ring, .node-btn.active .node-ring { stroke-width: 4; stroke: rgba(255,255,255,.96); filter: drop-shadow(0 0 12px rgba(255,255,255,.70)); }
        .node-label { pointer-events: none; font-size: 10px; font-weight: 900; fill: #fff; text-anchor: middle; dominant-baseline: middle; text-shadow: 0 2px 8px #000; }
        .section-label { font-family: "Crimson Pro", Georgia, serif; font-size: 17px; font-weight: 800; fill: #fff; text-anchor: middle; text-shadow: 0 2px 8px #000; }
        .section-books { font-size: 9px; font-weight: 800; fill: rgba(238,246,255,.70); text-anchor: middle; }
        .empty-state { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-weight: 700; }
        .detail-stat { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 10px 0; border-bottom: 1px solid rgba(226,236,248,.12); font-size: 13px; color: var(--muted); }
        .detail-stat strong { color: #fff; }
        .detail-heading { font-family: "Crimson Pro", Georgia, serif; font-size: 30px; color: #fff; line-height: 1; margin: 6px 0 10px; text-shadow: 0 3px 16px rgba(0,0,0,.72); }
        .status-pill { display: inline-flex; align-items: center; gap: 7px; border-radius: 3px; padding: 7px 10px; font-size: 10px; font-weight: 900; letter-spacing: .11em; text-transform: uppercase; background: rgba(255,255,255,.08); color: #fff; }
        .status-pill::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--status); }
        .next-list { display: grid; gap: 9px; margin-top: 14px; }
        .next-item { border: 1px solid rgba(226,236,248,.16); border-radius: 4px; padding: 10px; background: rgba(255,255,255,.06); color: #fff; cursor: pointer; text-align: left; }
        .next-item:hover { background: rgba(114,231,255,.10); border-color: rgba(114,231,255,.34); }
        .next-item strong { display: block; color: #fff; font-size: 13px; margin-bottom: 3px; }
        .next-item span { color: var(--muted); font-size: 12px; line-height: 1.4; display: block; }
        .legend { display: grid; gap: 9px; color: var(--muted); font-size: 12px; line-height: 1.45; }
        .legend-row { display: flex; align-items: center; gap: 8px; }
        .tier-mark { border-radius: 50%; border: 2px solid rgba(238,246,255,.50); background: rgba(255,255,255,.10); box-shadow: 0 0 12px rgba(114,231,255,.18); }
        @media (max-width: 980px) {
          .topbar, .shell { grid-template-columns: 1fr; }
          .summary { min-width: 0; }
          .topbar::after { position: static; transform: none; display: block; grid-column: 1 / -1; margin-top: 14px; min-width: 0; }
          .map-panel { min-height: 560px; }
          .map-canvas { height: 560px; }
        }
        @media (max-width: 620px) {
          .nav { padding: 12px 16px; }
          .nav-links .nav-link:not(.active) { display: none; }
          .page { padding: 26px 14px 60px; }
          .summary { grid-template-columns: 1fr; }
          .map-panel { overflow-x: auto; }
          .map-canvas { width: 780px; }
        }
      `}</style>

      <nav className="nav">
        <Link className="nav-brand" href="/">Open Bible School</Link>
        <div className="nav-links">
          <Link className="nav-link" href="/">Dashboard</Link>
          <Link className="nav-link active" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-link" href="/assess">Assess</Link>
        </div>
      </nav>

      <main className="page">
        <header className="topbar">
          <div>
            <h1 className="title">Knowledge Map</h1>
            <p className="subtitle">
              A dependency view of Old Testament literacy: Torah foundations, historical development, prophetic interpretation, and dimension-level evidence from the question bank.
            </p>
          </div>
          <div className="summary" aria-label="Map summary">
            <div className="summary-item">
              <span className="summary-value">{nodes.length || "--"}</span>
              <span className="summary-label">Map nodes</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">{bankRows.length || "--"}</span>
              <span className="summary-label">Questions</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">{totalAnswered || "--"}</span>
              <span className="summary-label">{userEmail ? "Your evidence" : "Signed out"}</span>
            </div>
          </div>
        </header>

        <div className="shell">
          <aside className="panel panel-pad" aria-label="Map controls">
            <p className="panel-title">View</p>
            <div className="mode-tabs" role="tablist" aria-label="Map color mode">
              {(["mastery", "tier", "evidence"] as MapMode[]).map((item) => (
                <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>
                  {item}
                </button>
              ))}
            </div>

            <p className="panel-title" style={{ marginTop: 20 }}>Sections</p>
            <div className="control-group">
              <button className={`control-btn ${selectedSection === "all" ? "active" : ""}`} onClick={() => setSelectedSection("all")}>
                All sections <span>{nodes.length}</span>
              </button>
              {SECTIONS.map((section) => (
                <button key={section.key} className={`control-btn ${selectedSection === section.key ? "active" : ""}`} onClick={() => setSelectedSection(section.key)}>
                  <span><span className="dot-key" style={{ "--key-color": section.color } as CSSProperties} /> {section.key}</span>
                  <span>{nodes.filter((node) => node.section === section.key).length}</span>
                </button>
              ))}
            </div>

            <p className="panel-title">Dimensions</p>
            <div className="control-group">
              <button className={`control-btn ${selectedDimension === "all" ? "active" : ""}`} onClick={() => setSelectedDimension("all")}>
                All dimensions <span>{nodes.length}</span>
              </button>
              {DIMENSIONS.map((dimension) => (
                <button key={dimension.key} className={`control-btn ${selectedDimension === dimension.key ? "active" : ""}`} onClick={() => setSelectedDimension(dimension.key)}>
                  {dimension.label}
                  <span>{nodes.filter((node) => node.dimension === dimension.key).length}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="panel map-panel" aria-label="User knowledge dependency map">
            <div className="map-toolbar">
              <span>{loading ? "Loading map..." : `${filteredNodes.length} visible nodes`}</span>
              {loadError && <span>{loadError}</span>}
            </div>
            {loading ? <div className="empty-state">Building map</div> : null}
            <svg className="map-canvas" viewBox="0 0 720 560" role="img" aria-label="Lines and dots knowledge map">
              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L9,3 z" fill="rgba(244,249,255,.74)" />
                </marker>
              </defs>
              <path className="dep-line" d="M170 210 C230 166, 260 166, 320 210" />
              <path className="dep-line" d="M400 210 C460 166, 490 166, 550 210" />
              <path className="dep-line" d="M360 255 C336 302, 336 350, 360 372" />
              {SECTIONS.map((section) => (
                <g key={section.key} opacity={selectedSection === "all" || selectedSection === section.key ? 1 : .18}>
                  <circle cx={section.x} cy={section.y} r="63" fill={section.color} opacity=".16" />
                  <circle cx={section.x} cy={section.y} r="47" fill="rgba(5,8,18,.70)" stroke={section.color} strokeWidth="4" />
                  <text className="section-label" x={section.x} y={section.y - 3}>{section.key}</text>
                  <text className="section-books" x={section.x} y={section.y + 18}>{section.books}</text>
                </g>
              ))}
              {filteredNodes.map((node) => {
                const section = SECTIONS.find((item) => item.key === node.section)!;
                return (
                  <line
                    key={`${node.id}-support`}
                    className="support-line"
                    x1={section.x}
                    y1={section.y}
                    x2={node.x}
                    y2={node.y}
                  />
                );
              })}
              {filteredNodes.map((node) => {
                const color = nodeColor(node, mode);
                const radius = nodeRadius(node);
                const isActive = selectedNode?.id === node.id;
                return (
                  <g
                    key={node.id}
                    className={`node-btn ${isActive ? "active" : ""}`}
                    onClick={() => setSelectedNodeId(node.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${node.section} ${node.label}`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedNodeId(node.id);
                    }}
                  >
                    <circle className="node-ring" cx={node.x} cy={node.y} r={radius + 7} fill={color} opacity=".18" stroke={color} strokeWidth="2" />
                    <circle cx={node.x} cy={node.y} r={radius} fill={color} stroke="rgba(255,255,255,.86)" strokeWidth="2.5" />
                    <text className="node-label" x={node.x} y={node.y}>{DIMENSIONS.find((item) => item.key === node.dimension)?.short}</text>
                  </g>
                );
              })}
            </svg>
          </section>

          <aside className="panel panel-pad" aria-label="Node details">
            <p className="panel-title">Selected node</p>
            {selectedNode ? (
              <>
                <span className="status-pill" style={{ "--status": nodeStatus(selectedNode).color } as CSSProperties}>
                  {nodeStatus(selectedNode).label}
                </span>
                <h2 className="detail-heading">{selectedNode.label}</h2>
                <div className="detail-stat"><span>Section</span><strong>{selectedNode.section}</strong></div>
                <div className="detail-stat"><span>Importance tier</span><strong>Tier {selectedNode.tier}</strong></div>
                <div className="detail-stat"><span>Question-bank coverage</span><strong>{selectedNode.bankCount}</strong></div>
                <div className="detail-stat"><span>Your answers</span><strong>{selectedNode.answered}</strong></div>
                <div className="detail-stat">
                  <span>Accuracy</span>
                  <strong>{nodeStatus(selectedNode).pct === null ? "No evidence" : `${nodeStatus(selectedNode).pct}%`}</strong>
                </div>
              </>
            ) : (
              <p className="subtitle">No nodes match the current filters.</p>
            )}

            <p className="panel-title" style={{ marginTop: 24 }}>Priority foundations</p>
            <div className="next-list">
              {fragileTierOne.slice(0, 4).map((node) => (
                <button key={node.id} className="next-item" onClick={() => setSelectedNodeId(node.id)}>
                  <strong>{node.section}: {node.label}</strong>
                  <span>{node.answered === 0 ? "No user evidence yet" : `${node.correct}/${node.answered} correct`} · Tier {node.tier}</span>
                </button>
              ))}
            </div>

            <p className="panel-title" style={{ marginTop: 24 }}>Legend</p>
            <div className="legend">
              <span className="legend-row"><span className="tier-mark" style={{ width: 28, height: 28 }} /> Tier 1 foundations</span>
              <span className="legend-row"><span className="tier-mark" style={{ width: 22, height: 22 }} /> Tier 2 connectors</span>
              <span className="legend-row"><span className="tier-mark" style={{ width: 17, height: 17 }} /> Tier 3 detail</span>
              <span>Lines show prerequisite flow and supporting dimensions, not BLI score math.</span>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
