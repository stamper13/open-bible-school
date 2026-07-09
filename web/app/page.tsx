"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

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

// BLI display scale (200-800) + seven-level bands. compute_bli returns raw 0-100.
const BLI_BANDS = [
  { name: "Unfamiliar", min: 200, max: 290, color: "#566070", description: "You do not yet have a steady grasp of the Old Testament's major plot, events, characters, and book locations." },
  { name: "Acquainted", min: 291, max: 434, color: "#6b7f8a", description: "You recognize some major people and stories, but many core events, sequences, and book-level connections are still forming." },
  { name: "Familiar",   min: 435, max: 584, color: "#0aa3a3", description: "You know many major stories and characters, with growing awareness of where events belong and how they connect." },
  { name: "Literate",   min: 585, max: 674, color: "#0e8c6a", description: "You can navigate the Old Testament with confidence, connecting books, events, characters, and theological themes." },
  { name: "Studied",    min: 675, max: 734, color: "#2563c4", description: "You show detailed knowledge of the text, including less obvious events, patterns, references, and historical flow." },
  { name: "Learned",    min: 735, max: 770, color: "#7c3aed", description: "You understand the Old Testament at a deep level, with strong command of structure, sequence, characters, and theology." },
  { name: "Scholar",    min: 771, max: 800, color: "#d4a017", description: "You demonstrate exceptional mastery, including fine textual detail, interconnections, and theological architecture." },
];
function toDisplayScore(raw: number): number {
  return Math.max(200, Math.min(800, Math.round(raw * 6 + 200)));
}
function levelForScore(s: number): string {
  return (BLI_BANDS.find(b => s <= b.max) ?? BLI_BANDS[BLI_BANDS.length - 1]).name;
}
function coneMarkerPercent(s: number): number {
  const bandIndex = BLI_BANDS.findIndex(b => s >= b.min && s <= b.max);
  const safeBandIndex = bandIndex === -1 ? (s < BLI_BANDS[0].min ? 0 : BLI_BANDS.length - 1) : bandIndex;
  const band = BLI_BANDS[safeBandIndex];
  const span = Math.max(1, band.max - band.min);
  const withinBand = Math.max(0, Math.min(1, (s - band.min) / span));
  const visualIndexFromTop = BLI_BANDS.length - 1 - safeBandIndex;
  return ((visualIndexFromTop + (1 - withinBand)) / BLI_BANDS.length) * 100;
}

const SECTION_RECOMMENDATIONS = [
  { name: "Torah", books: "Genesis - Deuteronomy", focus: "Rebuild the narrative spine from creation, covenant, exodus, Sinai, and wilderness into Deuteronomy.", priority: "Start here because later Old Testament history assumes this foundation." },
  { name: "Former Prophets", books: "Joshua - Kings", focus: "Trace Israel's settlement, monarchy, division, decline, and exile as one connected historical arc.", priority: "This is the next major narrative layer after Torah." },
  { name: "Latter Prophets", books: "Isaiah - Malachi", focus: "Connect prophetic messages to covenant failure, exile, restoration hope, and the coming kingdom.", priority: "Prophets make the most sense once the historical timeline is stable." },
  { name: "Writings", books: "Psalms, Proverbs, Job...", focus: "Deepen wisdom, worship, lament, poetry, and post-exilic reflection.", priority: "This strengthens texture and theology after the main chronology is clearer." },
];

type SectionScoreMap = Record<string, {pct: number, total: number, weighted_pct: number}>;

function getRecommendedStudy(sectionScores: SectionScoreMap, hasAssessment: boolean) {
  if (!hasAssessment) {
    return {
      label: "Begin with Torah",
      books: "Genesis - Deuteronomy",
      focus: "Start with the major Old Testament narrative spine: creation, covenant, exodus, Sinai, and wilderness.",
      priority: "Once you answer a few questions, this will adjust to your weakest important area.",
    };
  }

  const earliestMajorGap = SECTION_RECOMMENDATIONS.find(section => {
    const score = sectionScores[section.name];
    return !score || score.total < 4 || score.pct < 70;
  });
  const target = earliestMajorGap ?? [...SECTION_RECOMMENDATIONS]
    .sort((a, b) => (sectionScores[a.name]?.pct ?? 100) - (sectionScores[b.name]?.pct ?? 100))[0];
  const score = sectionScores[target.name];

  return {
    label: earliestMajorGap ? target.name : `Deepen ${target.name}`,
    books: target.books,
    focus: target.focus,
    priority: score
      ? `${score.pct}% across ${score.total} answered questions. ${target.priority}`
      : `Not enough answers here yet. ${target.priority}`,
  };
}

export default function HomePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [assessmentData, setAssessmentData] = useState<{answered: number, correct: number, bli?: number} | null>(null);
  const [sectionScores, setSectionScores] = useState<Record<string, {pct: number, total: number, weighted_pct: number}>>({});
  const [bliLevel, setBliLevel] = useState<string | null>(null);
  const [showBliTooltip, setShowBliTooltip] = useState(false);
  const [expandedConeLayer, setExpandedConeLayer] = useState<string | null>(null);
  const [isAssessmentCharging, setIsAssessmentCharging] = useState(false);
  const [waterMotion, setWaterMotion] = useState<"idle" | "active" | "settling">("idle");
  const [activeDashboardTab, setActiveDashboardTab] = useState<"bli" | "church-history" | "biblical-languages">("bli");
  const tooltipCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assessmentHoldDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assessmentHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waterSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentDisplayScore = assessmentData
    ? toDisplayScore(assessmentData.bli ?? Math.round((assessmentData.correct / assessmentData.answered) * 100))
    : 200;
  const currentDisplayLevel = levelForScore(currentDisplayScore);
  const waterFillPercent = assessmentData ? 100 - coneMarkerPercent(currentDisplayScore) : 0;
  const confidenceScore = assessmentData
    ? Math.max(0, Math.min(99, Math.round(100 - (1.96 * Math.sqrt(0.25 / Math.max(assessmentData.answered, 1)) * 100))))
    : 0;
  const confidenceLabel = confidenceScore >= 90 ? "Very high"
    : confidenceScore >= 86 ? "High"
    : confidenceScore >= 80 ? "Moderate"
    : "Low";
  const recommendedStudy = getRecommendedStudy(sectionScores, !!assessmentData);

  const openBliTooltip = () => {
    if (tooltipCloseRef.current) clearTimeout(tooltipCloseRef.current);
    setShowBliTooltip(true);
  };
  const closeBliTooltipSoon = () => {
    if (tooltipCloseRef.current) clearTimeout(tooltipCloseRef.current);
    tooltipCloseRef.current = setTimeout(() => setShowBliTooltip(false), 220);
  };

  const startAssessmentHold = () => {
    if (assessmentHoldDelayRef.current) clearTimeout(assessmentHoldDelayRef.current);
    if (assessmentHoldRef.current) clearTimeout(assessmentHoldRef.current);
    assessmentHoldDelayRef.current = setTimeout(() => {
      setIsAssessmentCharging(true);
      assessmentHoldRef.current = setTimeout(() => {
        window.location.href = "/assess";
      }, 2000);
    }, 1000);
  };

  const cancelAssessmentHold = () => {
    if (assessmentHoldDelayRef.current) clearTimeout(assessmentHoldDelayRef.current);
    if (assessmentHoldRef.current) clearTimeout(assessmentHoldRef.current);
    assessmentHoldDelayRef.current = null;
    assessmentHoldRef.current = null;
    setIsAssessmentCharging(false);
  };

  const startWaterMotion = () => {
    if (waterMotion === "active") return;
    if (waterSettleRef.current) clearTimeout(waterSettleRef.current);
    setWaterMotion("active");
    waterSettleRef.current = setTimeout(() => {
      setWaterMotion("settling");
      waterSettleRef.current = setTimeout(() => {
        setWaterMotion("idle");
        waterSettleRef.current = null;
      }, 3600);
    }, 1150);
  };

  const settleWaterMotion = () => {
    if (waterMotion === "idle") return;
    if (waterSettleRef.current) clearTimeout(waterSettleRef.current);
    setWaterMotion("settling");
    waterSettleRef.current = setTimeout(() => {
      setWaterMotion("idle");
      waterSettleRef.current = null;
    }, 3600);
  };

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
  };

  useEffect(() => {
    return () => {
      if (waterSettleRef.current) clearTimeout(waterSettleRef.current);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) setUserEmail(session.user.email);
      if (session?.user?.id) {
        // Use compute_bli for all scoring
        const { data: bliData } = await supabase.rpc("compute_bli", {
          p_user_id: session.user.id
        });
        if (bliData && bliData.length > 0) {
          const b = bliData[0];
          if (b.questions_answered > 0) {
            setAssessmentData({
              answered: b.questions_answered,
              correct: Math.round(b.total_weighted_earned),
              bli: parseFloat(b.bli_score)
            });
            setBliLevel(b.bli_level);
            // Parse section scores
            if (b.section_scores) {
              const scores: Record<string, {pct: number, total: number, weighted_pct: number}> = {};
              Object.entries(b.section_scores).forEach(([section, data]: [string, unknown]) => {
                const d = data as {pct: number, total: number, weighted_pct: number};
                scores[section] = { pct: d.pct, total: d.total, weighted_pct: d.weighted_pct };
              });
              setSectionScores(scores);
            }
          }
        }
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
    });
    return () => subscription.unsubscribe();
  }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const SKY_OVERSCAN = 2.35;
    const random = createSeededRandom(getOrCreateSkySeed());
    const isArrivingFromAssessment = sessionStorage.getItem("obs_dashboard_arriving") === "1";
    const initialRotation = isArrivingFromAssessment
      ? Number(sessionStorage.getItem("obs_dashboard_sky_rotation") || 0)
      : 0;
    const initialFrame = isArrivingFromAssessment
      ? Number(sessionStorage.getItem("obs_dashboard_sky_frame") || 0)
      : 0;
    let initialOffset = { x: 0, y: 0 };
    if (isArrivingFromAssessment) {
      try {
        initialOffset = JSON.parse(sessionStorage.getItem("obs_dashboard_sky_offset") || "{}") || initialOffset;
      } catch {}
    }
    canvas.style.setProperty("--sky-start-rotation", `${initialRotation}deg`);
    document.documentElement.style.setProperty("--sky-start-rotation", `${initialRotation}deg`);
    sessionStorage.removeItem("obs_dashboard_arriving");
    sessionStorage.removeItem("obs_dashboard_sky_rotation");
    sessionStorage.removeItem("obs_dashboard_sky_frame");
    sessionStorage.removeItem("obs_dashboard_sky_offset");

    function resize() {
      if (!canvas || !ctx) return;
      const skyWidth = window.innerWidth * SKY_OVERSCAN;
      const skyHeight = window.innerHeight * SKY_OVERSCAN;
      canvas.width = skyWidth * DPR;
      canvas.height = skyHeight * DPR;
      canvas.style.width = skyWidth + "px";
      canvas.style.height = skyHeight + "px";
    }

    resize();
    window.addEventListener("resize", resize);

    function handleScroll() {
      scrollRef.current = window.scrollY || window.pageYOffset || 0;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Generate stars
    const STAR_COUNT = 1400;
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: random(),
      y: random(),
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

    function resetShootingStar(star: (typeof shootingStars)[number]) {
      Object.assign(star, createShootingStar(frame + 420 + Math.floor(random() * 1100)));
    }

    let frame = initialFrame;
    const skyOffsetX = Number(initialOffset.x || 0) * DPR;
    const skyOffsetY = Number(initialOffset.y || 0) * DPR;

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      // Deep navy gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#0b0f1e");
      grad.addColorStop(0.5, "#111827");
      grad.addColorStop(1, "#0d1530");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Draw stars with twinkle
      stars.forEach(star => {
        const twinkle = Math.sin(frame * star.twinkleSpeed + star.twinkleOffset);
        const opacity = star.opacity * (0.6 + 0.4 * twinkle);
        const x = ((star.x * w + skyOffsetX) % (w + 40) + w + 40) % (w + 40) - 20;
        const y = ((star.y * h + skyOffsetY - scrollRef.current * 0.15 * DPR) % (h + 40) + h + 40) % (h + 40) - 20;
        ctx.beginPath();
        ctx.arc(x, y, star.r, 0, Math.PI * 2);
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
        const headX = star.x * w + progress * w * star.dx + skyOffsetX * 0.12;
        const headY = star.y * h + progress * h * star.dy + skyOffsetY * 0.12;
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
      const nebula = ctx.createRadialGradient(w * 0.7 + skyOffsetX * 0.1, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.4);
      nebula.addColorStop(0, "rgba(10,163,163,0.05)");
      nebula.addColorStop(1, "transparent");
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);

      frame++;
      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>
      <style>{`
        :root {
          --ink: #0e1116; --muted: #566070; --navy: #1b2442;
          --accent: #0aa3a3; --accent-dim: rgba(10,163,163,.10);
          --accent-line: rgba(10,163,163,.22);
          --card: rgba(255,255,255,.92); --border: rgba(27,36,66,.09);
          --shadow: 0 22px 58px rgba(0,0,0,.35), 0 4px 14px rgba(0,0,0,.2);
          --shadow-sm: 0 6px 20px rgba(0,0,0,.25);
          --torah-bar: linear-gradient(90deg,#d4a017,#f5c842);
          --former-bar: linear-gradient(90deg,#0e8c6a,#34d399);
          --latter-bar: linear-gradient(90deg,#2563c4,#60a5fa);
          --writings-bar: linear-gradient(90deg,#7c3aed,#a78bfa);
        }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; }
        body {
          font-family: "Inter", system-ui, -apple-system, sans-serif;
          color: var(--ink); min-height: 100vh;
          background: #0b0f1e;
        }
        canvas.stars {
          position: fixed; left: 50%; top: 50%; z-index: 0; pointer-events: none;
          transform-origin: 50% 50%; transform: translate3d(-50%,-50%,0) rotate(var(--sky-start-rotation, 0deg));
        }
        .nav {
          position: sticky; top: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 32px;
          background: rgba(11,15,30,.80);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .nav-brand {
          font-family: "Crimson Pro", Georgia, serif;
          font-weight: 600; font-size: 18px;
          color: #fff; text-decoration: none; letter-spacing: .01em;
        }
        .nav-right { display: flex; align-items: center; gap: 10px; }
        .nav-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 999px;
          font-size: 13px; font-weight: 600;
          border: 1px solid rgba(255,255,255,.15); cursor: pointer; text-decoration: none;
          background: transparent; color: rgba(255,255,255,.7);
          transition: transform .14s ease, background .15s ease, color .15s ease;
        }
        .nav-btn:hover { background: rgba(255,255,255,.1); color: #fff; transform: translateY(-1px); }
        .page {
          max-width: 900px; margin: 0 auto; padding: 44px 24px 88px; position: relative; z-index: 1;
          animation: dashboardPageReveal 2.1s cubic-bezier(.22,.72,.18,1) .22s both;
        }
        @keyframes dashboardPageReveal {
          0%, 26% { opacity: 0; transform: translateY(10px); filter: blur(1.5px); }
          100% { opacity: 1; transform: none; filter: blur(0); }
        }
        .page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; margin-bottom: 36px; flex-wrap: wrap;
        }
        .page-title {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 30px; font-weight: 600; line-height: 1.1;
          color: #fff; letter-spacing: .005em;
        }
        .page-meta {
          font-size: 13px; color: rgba(255,255,255,.45); margin-top: 5px;
          display: flex; align-items: center; gap: 6px;
        }
        .page-meta::before {
          content: ""; display: inline-block;
          width: 7px; height: 7px; border-radius: 50%;
          background: rgba(255,255,255,.25);
        }
        .dashboard-tabs {
          display: inline-grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px; width: 100%; max-width: 720px;
          padding: 6px; margin: -14px 0 28px;
          border: 1px solid rgba(255,255,255,.12); border-radius: 16px;
          background: rgba(255,255,255,.07); backdrop-filter: blur(14px);
          box-shadow: 0 16px 40px rgba(0,0,0,.22);
        }
        .dashboard-tab {
          border: 0; border-radius: 11px; padding: 12px 14px;
          background: transparent; color: rgba(255,255,255,.62);
          display: flex; flex-direction: column; align-items: flex-start; gap: 3px;
          cursor: pointer; font-family: inherit; text-align: left;
          transition: background .16s ease, color .16s ease, transform .14s ease;
        }
        .dashboard-tab strong {
          font-size: 13px; font-weight: 800; letter-spacing: .02em;
        }
        .dashboard-tab span {
          font-size: 11px; font-weight: 650; color: rgba(255,255,255,.38);
        }
        .dashboard-tab:hover { background: rgba(255,255,255,.08); color: #fff; transform: translateY(-1px); }
        .dashboard-tab.is-active {
          background: rgba(255,255,255,.92); color: var(--navy);
          box-shadow: 0 10px 24px rgba(0,0,0,.2);
        }
        .dashboard-tab.is-active span { color: var(--muted); }
        .placeholder-dashboard {
          background: var(--card); border: 1px solid var(--border); border-radius: 20px;
          box-shadow: var(--shadow); backdrop-filter: blur(16px);
          padding: 44px 46px; min-height: 420px;
          display: grid; grid-template-columns: 1fr 240px; gap: 32px; align-items: center;
        }
        .placeholder-eyebrow {
          font-size: 12px; font-weight: 850; letter-spacing: .13em; text-transform: uppercase;
          color: #0a6e6e; margin-bottom: 12px;
        }
        .placeholder-title {
          font-family: "Crimson Pro", Georgia, serif; font-size: 36px; line-height: 1.04;
          color: var(--navy); margin-bottom: 14px;
        }
        .placeholder-copy { color: var(--muted); font-size: 15px; line-height: 1.65; max-width: 560px; }
        .placeholder-list { display: grid; gap: 10px; margin-top: 24px; }
        .placeholder-pill {
          width: fit-content; padding: 9px 13px; border-radius: 999px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #0a6e6e; font-size: 12px; font-weight: 800;
        }
        .placeholder-orbit {
          width: 220px; aspect-ratio: 1; border-radius: 999px; position: relative;
          border: 1px solid rgba(10,163,163,.22);
          background: radial-gradient(circle, rgba(255,255,255,.85) 0 18%, rgba(10,163,163,.12) 19% 46%, transparent 47%);
          box-shadow: inset 0 0 42px rgba(10,163,163,.13), 0 18px 42px rgba(27,36,66,.12);
        }
        .placeholder-orbit::before,
        .placeholder-orbit::after {
          content: ""; position: absolute; inset: 24px; border-radius: inherit;
          border: 1px solid rgba(27,36,66,.12); transform: rotate(-18deg) scaleX(1.28);
        }
        .placeholder-orbit::after {
          inset: 54px; border-color: rgba(212,160,23,.32); transform: rotate(28deg) scaleX(1.42);
        }
        .score-strip {
          display: grid; grid-template-columns: auto 1fr auto;
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; box-shadow: var(--shadow);
          backdrop-filter: blur(16px); overflow: visible;
          margin-bottom: 28px; position: relative; z-index: 40;
        }
        .score-strip::after {
          content: ""; position: absolute; inset: 0;
          background: repeating-linear-gradient(90deg,transparent,transparent 60px,rgba(255,255,255,.18) 60px,rgba(255,255,255,.18) 120px);
          pointer-events: none; border-radius: 20px;
          animation: shimmer 3s ease-in-out infinite;
        }
        @keyframes shimmer { 0%,100%{opacity:0} 50%{opacity:1} }
        .score-block {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 30px 36px; gap: 4px; border-right: 1px solid var(--border);
          position: relative; z-index: 2;
        }
        .score-number {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 56px; font-weight: 700; line-height: 1;
          color: rgba(27,36,66,.22); letter-spacing: -.02em; user-select: none;
        }
        .score-label {
          font-size: 11px; font-weight: 700; letter-spacing: .10em;
          text-transform: uppercase; color: var(--muted);
        }
        .score-label-row {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center;
          gap: 6px;
        }
        .bli-info-btn {
          width: 18px; height: 18px; border-radius: 50%;
          border: 1px solid rgba(27,36,66,.16);
          background: rgba(255,255,255,.72); color: var(--navy);
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; line-height: 1;
          cursor: pointer; font-family: inherit;
          box-shadow: 0 2px 8px rgba(27,36,66,.10);
        }
        .bli-info-btn:hover, .bli-info-btn:focus-visible {
          border-color: var(--accent-line); color: #0a6e6e; outline: none;
          background: #fff;
        }
        .bli-tooltip {
          position: absolute; top: 28px; left: 50%; transform: translateX(-50%);
          width: min(320px, calc(100vw - 48px));
          background: #fff; color: var(--navy);
          border: 1px solid var(--border); border-radius: 12px;
          box-shadow: var(--shadow-sm); padding: 14px 15px;
          text-align: left; z-index: 80;
          font-size: 12.5px; line-height: 1.55; font-weight: 500;
          letter-spacing: 0; text-transform: none; text-decoration: none;
          opacity: 0; visibility: hidden; pointer-events: none;
          transition: opacity .12s ease, visibility .12s ease;
        }
        .score-label-row:hover .bli-tooltip,
        .score-label-row:focus-within .bli-tooltip,
        .bli-tooltip.is-open {
          opacity: 1; visibility: visible; pointer-events: auto;
        }
        .bli-tooltip::before {
          content: ""; position: absolute; top: -6px; left: 50%;
          width: 12px; height: 12px; transform: translateX(-50%) rotate(45deg);
          background: #fff; border-left: 1px solid var(--border); border-top: 1px solid var(--border);
        }
        .bli-tooltip span {
          display: inline-flex; margin-top: 8px;
          color: #0a6e6e; font-weight: 700; text-decoration: none;
        }
        .bli-tooltip:hover span { text-decoration: underline; }
        .level-block {
          padding: 30px 32px;
          display: flex; flex-direction: column; justify-content: center; gap: 10px;
        }
        .level-badge-empty {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(27,36,66,.05); border: 1px solid var(--border);
          border-radius: 999px; padding: 5px 13px;
          font-size: 12px; font-weight: 700; color: var(--muted);
          letter-spacing: .05em; text-transform: uppercase; width: fit-content;
        }
        .level-badge-empty::before {
          content: ""; width: 7px; height: 7px;
          border-radius: 50%; background: rgba(27,36,66,.2);
        }
        .level-desc-empty {
          font-size: 14.5px; line-height: 1.6; color: var(--muted); max-width: 420px;
        }
        .level-desc-empty strong { color: var(--navy); }
        .knowledge-cone-card {
          position: relative; z-index: 1;
          background: rgba(255,255,255,.94); border: 1px solid var(--border);
          border-radius: 20px; box-shadow: var(--shadow);
          backdrop-filter: blur(16px); padding: 28px 32px 30px;
          margin-bottom: 18px; overflow: visible;
        }
        .knowledge-cone-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 18px; margin-bottom: 22px;
        }
        .knowledge-cone-title {
          font-family: "Crimson Pro", Georgia, serif;
          font-size: 25px; font-weight: 650; color: var(--navy); line-height: 1.1;
        }
        .knowledge-cone-sub { font-size: 13px; color: var(--muted); margin-top: 5px; }
        .knowledge-cone-score {
          display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
          color: var(--navy); font-weight: 700; font-size: 28px;
          font-family: "Crimson Pro", Georgia, serif;
        }
        .knowledge-cone-score span {
          font-family: "Inter", system-ui, sans-serif; font-size: 10px;
          letter-spacing: .10em; text-transform: uppercase; color: var(--muted);
        }
        .knowledge-cone-wrap {
          position: relative; min-height: 440px;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          perspective: 900px;
        }
        .knowledge-cone {
          position: relative; width: min(560px, 100%); height: 378px;
          transform: rotateX(7deg);
          filter: drop-shadow(0 34px 42px rgba(27,36,66,.38)) drop-shadow(0 13px 24px rgba(10,163,163,.22));
        }
        .glass-vessel {
          position: absolute; inset: 0;
          clip-path: polygon(1% 0, 99% 0, 74.5% 100%, 25.5% 100%);
          background:
            linear-gradient(90deg, rgba(255,255,255,.55), rgba(255,255,255,.12) 28%, rgba(255,255,255,.28) 50%, rgba(27,36,66,.10) 100%),
            linear-gradient(180deg, rgba(255,255,255,.20), rgba(10,163,163,.06));
          border: 1px solid rgba(255,255,255,.58);
          box-shadow:
            inset 20px 0 34px rgba(255,255,255,.36),
            inset -22px 0 34px rgba(27,36,66,.28),
            inset 0 -28px 40px rgba(8,74,104,.24),
            inset 0 0 0 1px rgba(27,36,66,.12);
          overflow: hidden; z-index: 1;
        }
        .glass-vessel::before {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 0 16%, rgba(255,255,255,.42) 18%, transparent 25% 100%);
          pointer-events: none;
        }
        .glass-vessel::after {
          content: ""; position: absolute; left: 1%; right: 1%; top: -9px; height: 24px;
          border-radius: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,.70), rgba(255,255,255,.10));
          border: 1px solid rgba(255,255,255,.56);
          box-shadow: 0 10px 22px rgba(27,36,66,.26), inset 0 -3px 10px rgba(27,36,66,.16);
          pointer-events: none;
        }
        .water-fill {
          position: absolute; left: 0; right: 0; bottom: 0;
          height: var(--water-level);
          background:
            linear-gradient(112deg, rgba(255,255,255,.18) 0%, transparent 24% 62%, rgba(255,255,255,.12) 100%),
            linear-gradient(180deg, rgba(189,248,255,.68) 0%, rgba(55,197,213,.72) 50%, rgba(18,123,154,.80) 100%);
          box-shadow:
            inset 18px 0 26px rgba(255,255,255,.22),
            inset -20px 0 34px rgba(8,74,104,.32),
            inset 0 22px 36px rgba(255,255,255,.36),
            inset 0 -30px 42px rgba(8,74,104,.42),
            0 -12px 34px rgba(10,163,163,.30),
            0 0 0 1px rgba(255,255,255,.22);
          animation: waterRise 6.4s cubic-bezier(.18,.76,.12,1) both;
          transform-origin: bottom;
          z-index: 3;
        }
        .water-fill::before {
          content: ""; position: absolute; left: -9%; right: -9%; top: -15px; height: 30px;
          border-radius: 46% 54% 50% 50% / 55% 55% 45% 45%;
          background:
            linear-gradient(90deg, rgba(255,255,255,.14), rgba(255,255,255,.74), rgba(255,255,255,.16)),
            radial-gradient(ellipse, rgba(217,251,255,.96), rgba(82,205,224,.68) 56%, rgba(82,205,224,0) 75%);
          filter: blur(.12px);
          transform-origin: 50% 50%;
          animation: waterSurface 6.4s cubic-bezier(.18,.76,.12,1) both, waterSlosh 5.2s ease-in-out infinite;
        }
        .water-fill::after {
          content: ""; position: absolute; inset: 0;
          background:
            linear-gradient(112deg, transparent 0 30%, rgba(255,255,255,.22) 41%, transparent 53% 100%),
            radial-gradient(ellipse at 50% 18%, rgba(255,255,255,.16), transparent 50%);
          mix-blend-mode: screen;
          opacity: .42;
          animation: internalSheen 6.2s ease-in-out infinite;
          pointer-events: none;
        }
        .water-wave {
          position: absolute; left: -18%; width: 136%; height: 34px;
          top: -17px; overflow: hidden; border-radius: 999px;
          pointer-events: none; mix-blend-mode: screen; opacity: .55;
          transform-origin: 50% 50%;
        }
        .water-wave::before {
          content: ""; position: absolute; left: 50%; top: var(--wave-top, -92px);
          width: var(--wave-size, 220px); height: var(--wave-size, 220px);
          border-radius: 43% 57% 46% 54% / 56% 44% 56% 44%;
          background:
            radial-gradient(circle at 35% 32%, rgba(255,255,255,.72), transparent 0 9%, rgba(255,255,255,0) 17%),
            radial-gradient(circle at 62% 66%, rgba(255,255,255,.30), transparent 0 12%, rgba(255,255,255,0) 22%),
            linear-gradient(135deg, rgba(217,251,255,.70), rgba(82,205,224,.28) 52%, rgba(18,123,154,.16));
          transform: translateX(-50%) rotate(0deg);
          animation: liquidRoll var(--wave-speed, 8s) linear infinite, liquidBob 5.4s ease-in-out infinite;
          filter: blur(.08px);
        }
        .water-wave-a { --wave-size: 245px; --wave-top: -105px; --wave-speed: 8.8s; opacity: .62; }
        .water-wave-b { --wave-size: 205px; --wave-top: -82px; --wave-speed: 7.1s; top: -11px; opacity: .42; transform: scaleX(1.06); }
        .water-wave-b::before { animation-direction: reverse, normal; background: linear-gradient(135deg, rgba(189,248,255,.54), rgba(10,163,163,.26) 55%, rgba(18,123,154,.14)); }
        .water-wave-c { --wave-size: 270px; --wave-top: -128px; --wave-speed: 11s; top: -23px; opacity: .25; transform: scaleX(.96); }
        .water-wave-c::before { background: linear-gradient(135deg, rgba(255,255,255,.44), rgba(189,248,255,.16) 58%, transparent); }
        @keyframes waterRise { from { height: 0; } to { height: var(--water-level); } }
        @keyframes waterSurface { 0% { opacity: .10; transform: scaleX(.48); } 22% { opacity: .92; transform: scaleX(.76); } 100% { opacity: 1; transform: scaleX(1); } }
        .knowledge-cone.is-water-active .water-fill {
          height: var(--water-level);
          animation: waterBodyImpulse 1.15s cubic-bezier(.2,.78,.28,1) both;
        }
        .knowledge-cone.is-water-active .water-fill::before {
          animation: waterSurfaceImpulse 1.15s cubic-bezier(.2,.78,.28,1) both;
        }
        .knowledge-cone.is-water-active .water-fill::after {
          animation: internalSheen 1.15s ease-in-out both;
          opacity: .66;
        }
        .knowledge-cone.is-water-active .water-wave-a { animation: liquidBandImpulseA 1.15s cubic-bezier(.2,.78,.28,1) both; opacity: .78; }
        .knowledge-cone.is-water-active .water-wave-b { animation: liquidBandImpulseB 1.15s cubic-bezier(.2,.78,.28,1) both; opacity: .60; }
        .knowledge-cone.is-water-active .water-wave-c { animation: liquidBandImpulseC 1.15s cubic-bezier(.2,.78,.28,1) both; opacity: .38; }
        .knowledge-cone.is-water-active .water-wave::before { animation-duration: 1.7s, 1.15s; }
        .knowledge-cone.is-water-settling .water-fill {
          height: var(--water-level);
          animation: waterBodySettle 3.6s cubic-bezier(.18,.76,.12,1) both;
        }
        .knowledge-cone.is-water-settling .water-fill::before {
          animation: waterSurfaceSettle 3.6s cubic-bezier(.18,.76,.12,1) both;
        }
        .knowledge-cone.is-water-settling .water-fill::after {
          animation: internalSheen 3.6s ease-out both;
        }
        .knowledge-cone.is-water-settling .water-wave-a { animation: liquidBandSettleA 3.6s cubic-bezier(.18,.76,.12,1) both; }
        .knowledge-cone.is-water-settling .water-wave-b { animation: liquidBandSettleB 3.6s cubic-bezier(.18,.76,.12,1) both; }
        .knowledge-cone.is-water-settling .water-wave-c { animation: liquidBandSettleC 3.6s cubic-bezier(.18,.76,.12,1) both; }
        @keyframes waterSlosh {
          0%, 100% { translate: -2.4% -1px; rotate: -2deg; scale: 1.02 .92; border-radius: 42% 58% 52% 48% / 53% 60% 40% 47%; }
          50% { translate: 2.4% 3px; rotate: 2deg; scale: 1.06 1.02; border-radius: 60% 40% 47% 53% / 60% 52% 48% 40%; }
        }
        @keyframes waterSurfaceImpulse {
          0% { translate: 0 0; rotate: 0deg; scale: 1 .96; border-radius: 50% 50% 50% 50% / 56% 56% 44% 44%; }
          22% { translate: -8% -3px; rotate: -5deg; scale: 1.14 .84; border-radius: 35% 65% 58% 42% / 46% 69% 31% 54%; }
          48% { translate: 7% 5px; rotate: 4.6deg; scale: 1.16 1.08; border-radius: 66% 34% 41% 59% / 68% 43% 57% 32%; }
          74% { translate: -4% 1px; rotate: -2.2deg; scale: 1.07 .95; border-radius: 43% 57% 54% 46% / 52% 62% 38% 48%; }
          100% { translate: 2.4% 2px; rotate: 1.4deg; scale: 1.04 1; border-radius: 56% 44% 48% 52% / 58% 50% 50% 42%; }
        }
        @keyframes waterBodyImpulse {
          0% { transform: skewX(0deg) translateX(0); }
          22% { transform: skewX(-2.4deg) translateX(-2%); }
          48% { transform: skewX(2.1deg) translateX(1.8%); }
          74% { transform: skewX(-1deg) translateX(-.8%); }
          100% { transform: skewX(.6deg) translateX(.5%); }
        }
        @keyframes waterBodySettle {
          0% { transform: skewX(.6deg) translateX(.5%); }
          18% { transform: skewX(-1.25deg) translateX(-1%); }
          38% { transform: skewX(.75deg) translateX(.6%); }
          62% { transform: skewX(-.35deg) translateX(-.25%); }
          82% { transform: skewX(.14deg) translateX(.1%); }
          100% { transform: skewX(0deg) translateX(0); }
        }
        @keyframes waterSurfaceSettle {
          0% { translate: 2.4% 2px; rotate: 1.4deg; scale: 1.04 1; border-radius: 56% 44% 48% 52% / 58% 50% 50% 42%; }
          18% { translate: -4.8% -2px; rotate: -3deg; scale: 1.09 .91; border-radius: 39% 61% 55% 45% / 49% 63% 37% 51%; }
          38% { translate: 2.8% 3px; rotate: 1.8deg; scale: 1.06 1.02; border-radius: 59% 41% 47% 53% / 60% 51% 49% 40%; }
          62% { translate: -1.4% 0; rotate: -.9deg; scale: 1.03 .97; border-radius: 47% 53% 52% 48% / 54% 57% 43% 46%; }
          82% { translate: .55% 1px; rotate: .35deg; scale: 1.015 .99; border-radius: 52% 48% 49% 51% / 55% 53% 47% 45%; }
          100% { translate: -2.4% -1px; rotate: -2deg; scale: 1.02 .92; border-radius: 42% 58% 52% 48% / 53% 60% 40% 47%; }
        }
        @keyframes liquidRoll {
          to { transform: translateX(-50%) rotate(1turn); }
        }
        @keyframes liquidBob {
          0%, 100% { top: var(--wave-top); border-radius: 43% 57% 46% 54% / 56% 44% 56% 44%; }
          50% { top: calc(var(--wave-top) + 7px); border-radius: 55% 45% 58% 42% / 44% 57% 43% 56%; }
        }
        @keyframes liquidBandImpulseA {
          0% { transform: translateX(0) translateY(0) rotate(0deg) scaleY(1); }
          24% { transform: translateX(-7%) translateY(-8px) rotate(-4deg) scaleY(1.22); }
          52% { transform: translateX(6%) translateY(6px) rotate(3deg) scaleY(.92); }
          78% { transform: translateX(-3%) translateY(-2px) rotate(-1.2deg) scaleY(1.07); }
          100% { transform: translateX(1.8%) translateY(1px) rotate(.5deg) scaleY(1); }
        }
        @keyframes liquidBandImpulseB {
          0% { transform: scaleX(1.06) translateX(0) translateY(0) rotate(0deg) scaleY(1); }
          22% { transform: scaleX(1.06) translateX(6%) translateY(5px) rotate(3deg) scaleY(.88); }
          50% { transform: scaleX(1.06) translateX(-7%) translateY(-7px) rotate(-3.4deg) scaleY(1.18); }
          76% { transform: scaleX(1.06) translateX(3%) translateY(2px) rotate(1.1deg) scaleY(.98); }
          100% { transform: scaleX(1.06) translateX(-1.4%) translateY(0) rotate(-.4deg) scaleY(1); }
        }
        @keyframes liquidBandImpulseC {
          0% { transform: scaleX(.96) translateX(0) translateY(0) scaleY(1); }
          30% { transform: scaleX(.96) translateX(-4%) translateY(-4px) scaleY(1.16); }
          60% { transform: scaleX(.96) translateX(4%) translateY(3px) scaleY(.94); }
          100% { transform: scaleX(.96) translateX(.8%) translateY(0) scaleY(1); }
        }
        @keyframes liquidBandSettleA {
          0% { transform: translateX(1.8%) translateY(1px) rotate(.5deg) scaleY(1); opacity: .70; }
          22% { transform: translateX(-4%) translateY(-5px) rotate(-2deg) scaleY(1.14); opacity: .66; }
          45% { transform: translateX(2.6%) translateY(3px) rotate(1.1deg) scaleY(.97); opacity: .58; }
          72% { transform: translateX(-1.2%) translateY(-1px) rotate(-.5deg) scaleY(1.03); opacity: .52; }
          100% { transform: translateX(0) translateY(0) rotate(0deg) scaleY(1); opacity: .48; }
        }
        @keyframes liquidBandSettleB {
          0% { transform: scaleX(1.06) translateX(-1.4%) translateY(0) rotate(-.4deg) scaleY(1); opacity: .54; }
          24% { transform: scaleX(1.06) translateX(3.2%) translateY(3px) rotate(1.3deg) scaleY(.93); opacity: .56; }
          48% { transform: scaleX(1.06) translateX(-2%) translateY(-2px) rotate(-.8deg) scaleY(1.07); opacity: .48; }
          76% { transform: scaleX(1.06) translateX(.8%) translateY(0) rotate(.25deg) scaleY(.99); opacity: .42; }
          100% { transform: scaleX(1.06) translateX(0) translateY(0) rotate(0deg) scaleY(1); opacity: .38; }
        }
        @keyframes liquidBandSettleC {
          0% { transform: scaleX(.96) translateX(.8%) translateY(0) scaleY(1); opacity: .34; }
          35% { transform: scaleX(.96) translateX(-1.7%) translateY(-2px) scaleY(1.08); opacity: .32; }
          70% { transform: scaleX(.96) translateX(.9%) translateY(0) scaleY(.98); opacity: .28; }
          100% { transform: scaleX(.96) translateX(0) translateY(0) scaleY(1); opacity: .24; }
        }
        @keyframes internalSheen { 0%, 100% { transform: translateX(-16%) skewX(-7deg); opacity: .30; } 48% { transform: translateX(16%) skewX(-7deg); opacity: .64; } }
        .cone-tier {
          position: relative; width: 100%; height: calc(100% / 7);
          display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px;
          padding: 0 calc(var(--text-inset) + 18px); color: var(--navy);
          background: transparent;
          border: 0; border-bottom: 1px solid rgba(27,36,66,.18);
          clip-path: polygon(var(--top-left) 0, var(--top-right) 0, var(--bottom-right) 100%, var(--bottom-left) 100%);
          transition: background .18s, box-shadow .18s, color .18s, transform .18s;
          transform-origin: center;
          z-index: 8;
          cursor: pointer; font-family: inherit; text-align: left;
        }
        .cone-tier:hover, .cone-tier:focus-visible {
          background: rgba(255,255,255,.24); outline: none;
          box-shadow: inset 0 0 0 2px rgba(255,255,255,.30);
        }
        .cone-tier:last-child { border-bottom: 0; }
        .cone-tier.is-active {
          background: rgba(255,255,255,.20);
          box-shadow: inset 0 0 0 2px rgba(27,36,66,.16);
        }
        .cone-tier.is-expanded {
          background: linear-gradient(90deg, rgba(13,21,48,.86), rgba(27,36,66,.74));
          box-shadow: inset 0 0 0 2px rgba(255,255,255,.24), 0 14px 30px rgba(8,13,30,.34);
          color: #fff;
          transform: scale(1.035, 1.22);
          z-index: 18;
        }
        .cone-tier.is-expanded .cone-tier-name,
        .cone-tier.is-expanded .cone-tier-range { transform: translateY(-8px); text-shadow: 0 1px 12px rgba(0,0,0,.35); }
        .cone-tier-name { position: relative; z-index: 1; font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; text-shadow: 0 1px 0 rgba(255,255,255,.50); transition: transform .18s, text-shadow .18s; }
        .cone-tier-range { position: relative; z-index: 1; font-size: 12px; font-weight: 800; opacity: .76; white-space: nowrap; text-shadow: 0 1px 0 rgba(255,255,255,.50); transition: transform .18s, text-shadow .18s; }
        .cone-layer-popover {
          position: absolute; left: calc(100% + 20px); top: calc(var(--popover-y) * 1%); width: min(340px, 46vw);
          padding: 17px 19px; border-radius: 10px; z-index: 30;
          background: rgba(255,255,255,.94); border: 1px solid rgba(27,36,66,.10);
          box-shadow: 0 20px 42px rgba(27,36,66,.34), 0 0 0 1px rgba(255,255,255,.56) inset;
          color: rgba(27,36,66,.88); transform: translateY(-50%);
          backdrop-filter: blur(14px); animation: coneDescriptionIn .18s ease-out both;
          pointer-events: none;
        }
        .cone-layer-popover::before {
          content: ""; position: absolute; left: -10px; top: 50%; width: 18px; height: 18px;
          background: rgba(255,255,255,.94); border-left: 1px solid rgba(27,36,66,.10); border-bottom: 1px solid rgba(27,36,66,.10);
          transform: translateY(-50%) rotate(45deg);
        }
        .cone-layer-popover strong { display: block; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 7px; color: var(--navy); }
        .cone-layer-popover span { display: block; font-size: 14px; line-height: 1.48; font-weight: 650; }
        @keyframes coneDescriptionIn { from { opacity: 0; transform: translateY(-50%) translateX(-8px) scale(.96); } to { opacity: 1; transform: translateY(-50%) translateX(0) scale(1); } }
        .cone-marker {
          position: absolute; right: -118px;
          top: calc(var(--marker-y) * 1%);
          transform: translateY(-50%);
          display: flex; align-items: center; gap: 10px;
          color: var(--navy); font-size: 12px; font-weight: 800;
          z-index: 20;
        }
        .cone-marker::before {
          content: ""; width: 74px; height: 2px;
          background: linear-gradient(90deg, rgba(27,36,66,.10), var(--navy));
        }
        .cone-marker-dot {
          width: 18px; height: 18px; border-radius: 50%;
          background: #fff; border: 4px solid var(--navy);
          box-shadow: 0 7px 18px rgba(0,0,0,.30);
        }
        .cone-empty-note {
          text-align: center; color: var(--muted); font-size: 14px; line-height: 1.6;
          max-width: 460px; margin: 0 auto;
        }
        .conf-block {
          display: flex; flex-direction: column; align-items: flex-start; justify-content: center;
          padding: 30px 32px; gap: 9px;
          border-left: 1px solid var(--border); min-width: 210px;
        }
        .conf-empty-label {
          display: inline-flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
          font-size: 13px; font-weight: 850; letter-spacing: .075em;
          text-transform: uppercase; color: rgba(27,36,66,.56); text-align: left;
        }
        .conf-percent {
          font-family: "Crimson Pro", Georgia, serif; font-size: 36px; line-height: .9;
          font-weight: 750; color: var(--navy); letter-spacing: 0; text-transform: none;
        }
        .conf-note { display: flex; align-items: center; gap: 9px; font-size: 13px; color: var(--muted); text-align: left; line-height: 1.35; }
        .conf-level {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 5px 10px; border-radius: 999px;
          background: var(--accent-dim); border: 1px solid var(--accent-line);
          color: #0a6e6e; font-size: 12px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase;
        }
        .start-hero {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; padding: 48px 40px;
          box-shadow: var(--shadow); backdrop-filter: blur(16px);
          margin-bottom: 28px;
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 20px;
        }
        .start-hero.compact {
          position: relative; overflow: hidden;
          min-height: 154px; padding: 30px 24px; margin-bottom: 28px;
          display: flex; align-items: center; justify-content: center;
          background:
            linear-gradient(115deg, rgba(255,255,255,.95), rgba(255,255,255,.86)),
            radial-gradient(circle at 28% 35%, rgba(10,163,163,.20), transparent 34%),
            radial-gradient(circle at 72% 70%, rgba(212,160,23,.18), transparent 36%);
        }
        .start-hero.compact::before {
          content: ""; position: absolute; inset: -42%;
          background: conic-gradient(from 120deg, transparent, rgba(10,163,163,.18), transparent 30%, rgba(212,160,23,.16), transparent 62%);
          animation: assessmentAura 13s linear infinite;
          pointer-events: none;
        }
        .start-hero.compact::after {
          content: ""; position: absolute; inset: 18px; border-radius: 16px;
          border: 1px solid rgba(10,163,163,.16);
          box-shadow: inset 0 0 36px rgba(10,163,163,.10);
          pointer-events: none;
        }
        .assessment-cta-wrap {
          position: absolute; inset: 0; z-index: 1;
          display: grid; place-items: center; padding: 30px 24px;
          transition: padding 2s cubic-bezier(.16,.84,.18,1);
        }
        .assessment-cta-wrap::before,
        .assessment-cta-wrap::after {
          content: ""; position: absolute; inset: -16px; border-radius: 999px;
          border: 1px solid rgba(10,163,163,.24);
          animation: assessmentPulse 2.8s ease-out infinite;
          pointer-events: none;
        }
        .assessment-cta-wrap::after { inset: -28px; animation-delay: .9s; opacity: .58; }
        .start-hero.compact.is-charging .assessment-cta-wrap::before,
        .start-hero.compact.is-charging .assessment-cta-wrap::after { opacity: 0; animation-play-state: paused; }
        .start-hero.compact.is-charging .assessment-cta-wrap { padding: 0; }
        .start-hero.compact .start-btn {
          position: relative; z-index: 1; width: 238px; min-width: 238px; height: 58px;
          justify-content: center; padding: 18px 34px; font-size: 16px;
          font-family: "Inter", system-ui, sans-serif; font-weight: 760; letter-spacing: .01em;
          white-space: nowrap;
          background: linear-gradient(135deg, #1b2442 0%, #253566 58%, #0a6e6e 100%);
          box-shadow: 0 18px 38px rgba(27,36,66,.38), 0 0 28px rgba(10,163,163,.22);
          transition: width 2s cubic-bezier(.16,.84,.18,1), height 2s cubic-bezier(.16,.84,.18,1), border-radius 2s cubic-bezier(.16,.84,.18,1), transform .13s ease, box-shadow .15s ease;
        }
        .start-hero.compact.is-charging .start-btn {
          width: 100%; height: 100%; border-radius: 20px;
          transform: none; box-shadow: 0 24px 54px rgba(27,36,66,.42), 0 0 42px rgba(10,163,163,.30);
        }
        .start-hero.compact .start-btn::before {
          content: ""; position: absolute; inset: 1px; border-radius: inherit;
          background: linear-gradient(110deg, transparent 0 28%, rgba(255,255,255,.24) 45%, transparent 62% 100%);
          transform: translateX(-120%); animation: assessmentShine 3.8s ease-in-out infinite;
          pointer-events: none;
        }
        .start-hero.compact .start-btn:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 22px 44px rgba(27,36,66,.44), 0 0 34px rgba(10,163,163,.28); }
        .start-hero.compact.is-charging .start-btn:hover { transform: none; }
        @keyframes assessmentAura { to { transform: rotate(1turn); } }
        @keyframes assessmentPulse { 0% { transform: scale(.92); opacity: .72; } 100% { transform: scale(1.16); opacity: 0; } }
        @keyframes assessmentShine { 0%, 44% { transform: translateX(-120%); } 72%, 100% { transform: translateX(120%); } }
        .start-btn {
          position: relative; overflow: hidden;
          display: flex; align-items: center; gap: 10px;
          padding: 16px 36px; border-radius: 999px;
          background: var(--navy); color: #fff;
          font-size: 16px; font-weight: 600;
          border: none; cursor: pointer; text-decoration: none;
          box-shadow: 0 12px 32px rgba(27,36,66,.4);
          transition: background .15s ease, transform .13s ease, box-shadow .15s ease;
        }
        .start-btn:hover { background: #253566; transform: translateY(-2px); }
        .start-btn svg { width: 20px; height: 20px; flex: 0 0 auto; }
        .start-btn-label { display: inline-block; white-space: nowrap; line-height: 1; }
        .recommended-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 20px; padding: 24px 26px; margin-bottom: 28px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 18px; align-items: center;
          position: relative; overflow: hidden;
        }
        .recommended-card::before {
          content: ""; position: absolute; inset: 0 auto 0 0; width: 5px;
          background: linear-gradient(180deg, var(--accent), #d4a017);
        }
        .recommended-eyebrow { font-size: 11px; font-weight: 850; letter-spacing: .11em; text-transform: uppercase; color: #0a6e6e; margin-bottom: 7px; }
        .recommended-title { font-family: "Crimson Pro", Georgia, serif; font-size: 26px; font-weight: 650; color: var(--navy); line-height: 1.05; }
        .recommended-books { margin-top: 5px; font-size: 13px; color: var(--muted); font-weight: 650; }
        .recommended-focus { margin-top: 13px; font-size: 14px; line-height: 1.55; color: rgba(27,36,66,.76); max-width: 660px; }
        .recommended-priority { font-size: 12.5px; line-height: 1.45; color: var(--muted); max-width: 260px; }
        .recommended-action { display: flex; align-items: center; gap: 8px; justify-self: end; margin-top: 12px; color: var(--navy); font-size: 13px; font-weight: 800; text-decoration: none; }
        .recommended-action svg { width: 16px; height: 16px; }
        .section-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: .10em;
          text-transform: uppercase; color: rgba(255,255,255,.45);
          margin-bottom: 14px; margin-top: 32px;
        }
        .sections-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .section-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 16px; padding: 20px 22px;
          box-shadow: var(--shadow-sm); backdrop-filter: blur(16px);
          position: relative; overflow: hidden; opacity: .75;
        }
        .section-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .section-card.torah::before   { background: var(--torah-bar); }
        .section-card.former::before  { background: var(--former-bar); }
        .section-card.latter::before  { background: var(--latter-bar); }
        .section-card.writings::before { background: var(--writings-bar); }
        .sc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .sc-name { font-size: 15px; font-weight: 650; color: var(--navy); }
        .sc-books { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .sc-pct-empty { font-family: "Crimson Pro",Georgia,serif; font-size: 24px; font-weight: 700; color: rgba(27,36,66,.18); line-height: 1; }
        .sc-bar-track { height: 6px; border-radius: 999px; background: rgba(27,36,66,.07); margin-bottom: 12px; }
        .sc-chip-empty { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; background: rgba(27,36,66,.05); border: 1px solid var(--border); color: var(--muted); }
        @media (max-width: 640px) {
          .score-strip { grid-template-columns: 1fr; }
          .score-block { border-right: none; border-bottom: 1px solid var(--border); }
          .conf-block { border-left: none; border-top: 1px solid var(--border); align-items: center; text-align: center; }
          .sections-grid { grid-template-columns: 1fr; }
          .recommended-card { grid-template-columns: 1fr; }
          .recommended-priority { max-width: none; }
          .recommended-action { justify-self: start; }
          .knowledge-cone-card { padding: 24px 18px; }
          .knowledge-cone-head { align-items: flex-start; flex-direction: column; }
          .knowledge-cone-score { align-items: flex-start; }
          .knowledge-cone-wrap { min-height: 360px; padding: 18px 8px 58px; }
          .knowledge-cone { height: 320px; transform: rotateX(5deg); }
          .cone-tier { padding: 0 calc(var(--text-inset) + 10px); }
          .cone-tier-name { font-size: 10px; }
          .cone-tier-range { font-size: 10px; }
          .cone-layer-popover { left: 50%; top: calc(var(--popover-y) * 1% + 42px); width: min(340px, 90vw); padding: 15px 17px; transform: translateX(-50%); }
          .cone-layer-popover::before { left: 50%; top: -9px; transform: translateX(-50%) rotate(135deg); }
          .cone-layer-popover strong { font-size: 13px; }
          .cone-layer-popover span { font-size: 13px; line-height: 1.46; }
          @keyframes coneDescriptionIn { from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(.96); } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
          .cone-marker { right: 50%; transform: translate(50%, -50%); }
          .cone-marker::before { width: 46px; }
          .start-hero { padding: 36px 24px; }
          .start-hero.compact { min-height: 144px; padding: 28px 18px; }
          .assessment-cta-wrap { padding: 28px 18px; }
          .start-hero.compact.is-charging .assessment-cta-wrap { padding: 0; }
          .start-hero.compact .start-btn { width: min(100%, 330px); min-width: min(100%, 330px); justify-content: center; padding: 17px 24px; }
          .dashboard-tabs { grid-template-columns: 1fr; margin-top: -8px; }
          .placeholder-dashboard { grid-template-columns: 1fr; padding: 30px 24px; min-height: 360px; }
          .placeholder-orbit { width: min(210px, 70vw); margin: 0 auto; }
          .nav { padding: 13px 16px; }
          .page { padding: 28px 16px 72px; }
        }
      `}</style>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{var r=sessionStorage.getItem("obs_dashboard_arriving")==="1"?sessionStorage.getItem("obs_dashboard_sky_rotation")||"0":"0";document.documentElement.style.setProperty("--sky-start-rotation",r+"deg");}catch(e){}`,
        }}
      />

      <canvas ref={canvasRef} className="stars" aria-hidden="true" />

      <nav className="nav">
        <Link className="nav-brand" href="/">Open Bible School</Link>
        <div className="nav-right">
          <Link className="nav-btn" href="/knowledge-map">Knowledge Map</Link>
          <Link className="nav-btn" href="/about">About</Link>
          <Link className="nav-btn" href="/credential">For Churches</Link>
          {userEmail ? (
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:12,color:"var(--muted)",padding:"6px 12px",borderRadius:999,border:"1px solid var(--border)",background:"rgba(255,255,255,.5)"}}>
                {userEmail}
              </span>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setUserEmail(null);
                  setAssessmentData(null);
                  setSectionScores({});
                  setBliLevel(null);
                }}
                style={{fontSize:12,color:"var(--muted)",padding:"6px 12px",borderRadius:999,border:"1px solid var(--border)",background:"rgba(255,255,255,.5)",cursor:"pointer",fontFamily:"inherit",transition:"color .14s"}}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button className="nav-btn" onClick={handleSignIn}>Sign in</button>
          )}
        </div>
      </nav>

      <main className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Your Learning Dashboard</h1>
            <p className="page-meta">
              {activeDashboardTab === "bli" && (assessmentData ? `${assessmentData.answered} questions answered` : "No assessment taken yet")}
              {activeDashboardTab === "church-history" && "Church History dashboard coming soon"}
              {activeDashboardTab === "biblical-languages" && "Biblical Languages dashboard coming soon"}
            </p>
          </div>
        </header>

        <div className="dashboard-tabs" role="tablist" aria-label="Dashboard views">
          <button
            type="button"
            role="tab"
            aria-selected={activeDashboardTab === "bli"}
            className={`dashboard-tab ${activeDashboardTab === "bli" ? "is-active" : ""}`}
            onClick={() => setActiveDashboardTab("bli")}
          >
            <strong>BLI</strong>
            <span>Old Testament literacy</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeDashboardTab === "church-history"}
            className={`dashboard-tab ${activeDashboardTab === "church-history" ? "is-active" : ""}`}
            onClick={() => setActiveDashboardTab("church-history")}
          >
            <strong>Church History</strong>
            <span>Temporary dashboard</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeDashboardTab === "biblical-languages"}
            className={`dashboard-tab ${activeDashboardTab === "biblical-languages" ? "is-active" : ""}`}
            onClick={() => setActiveDashboardTab("biblical-languages")}
          >
            <strong>Biblical Languages</strong>
            <span>Temporary dashboard</span>
          </button>
        </div>

        {activeDashboardTab === "bli" ? (
          <>
        <div className="score-strip">
          <div className="score-block">
            {assessmentData ? (
              <>
                <span className="score-number" style={{color:"#1b2442"}}>
                  {currentDisplayScore}
                </span>
                <span
                  className="score-label score-label-row"
                  onMouseEnter={openBliTooltip}
                  onMouseLeave={closeBliTooltipSoon}
                >
                  BLI Score
                  <button
                    type="button"
                    className="bli-info-btn"
                    aria-label="About the Bible Literacy Index"
                    aria-expanded={showBliTooltip}
                    onFocus={openBliTooltip}
                    onBlur={closeBliTooltipSoon}
                    onClick={() => setShowBliTooltip(v => !v)}
                  >
                    ⓘ
                  </button>
                  <Link
                    className={`bli-tooltip ${showBliTooltip ? "is-open" : ""}`}
                    role="tooltip"
                    href="/about"
                    onMouseEnter={openBliTooltip}
                    onMouseLeave={closeBliTooltipSoon}
                    onFocus={openBliTooltip}
                    onBlur={closeBliTooltipSoon}
                  >
                    Your Bible Literacy Index measures your knowledge of the Old Testament across four sections, weighted by the theological importance of each book and passage. Scores range from 200 (Unfamiliar) to 800 (Scholar).
                    <span>Learn more →</span>
                  </Link>
                </span>
              </>
            ) : (
              <>
                <span className="score-number">?</span>
                <span
                  className="score-label score-label-row"
                  onMouseEnter={openBliTooltip}
                  onMouseLeave={closeBliTooltipSoon}
                >
                  BLI Score
                  <button
                    type="button"
                    className="bli-info-btn"
                    aria-label="About the Bible Literacy Index"
                    aria-expanded={showBliTooltip}
                    onFocus={openBliTooltip}
                    onBlur={closeBliTooltipSoon}
                    onClick={() => setShowBliTooltip(v => !v)}
                  >
                    ⓘ
                  </button>
                  <Link
                    className={`bli-tooltip ${showBliTooltip ? "is-open" : ""}`}
                    role="tooltip"
                    href="/about"
                    onMouseEnter={openBliTooltip}
                    onMouseLeave={closeBliTooltipSoon}
                    onFocus={openBliTooltip}
                    onBlur={closeBliTooltipSoon}
                  >
                    Your Bible Literacy Index measures your knowledge of the Old Testament across four sections, weighted by the theological importance of each book and passage. Scores range from 200 (Unfamiliar) to 800 (Scholar).
                    <span>Learn more →</span>
                  </Link>
                </span>
              </>
            )}
          </div>
          <div className="level-block">
            {assessmentData && bliLevel ? (
              <>
                <div className="level-badge-empty" style={{background:"var(--accent-dim)",borderColor:"var(--accent-line)",color:"#0a6e6e"}}>
                  {bliLevel}
                </div>
                <p className="level-desc-empty">
                  {bliLevel === "Studied" && "You engage with the OT at a scholarly level — aware of intertextual connections, textual detail, and theological structure."}
                  {bliLevel === "Literate" && "You know both the stories and the text. You can navigate the OT with confidence and are ready to go deeper into its theological architecture."}
                  {bliLevel === "Familiar" && "You know the major stories and characters well. The next step is moving deeper into textual detail — specific words, names, and connections between events."}
                  {bliLevel === "Acquainted" && "You have some exposure to the OT but significant narrative gaps remain. Start with Genesis, Exodus, and 1-2 Samuel."}
                </p>
              </>
            ) : (
              <>
                <div className="level-badge-empty">Not yet assessed</div>
                <p className="level-desc-empty">
                  Take your first assessment to find out where you stand. The engine will build a picture of your knowledge across the Old Testament — <strong>starting with the events that matter most.</strong>
                </p>
              </>
            )}
          </div>
          <div className="conf-block">
            <span className="conf-empty-label">
              Confidence <span className="conf-percent">{assessmentData ? `${confidenceScore}%` : "--"}</span>
            </span>
            <span className="conf-note">
              {assessmentData ? (
                <>
                  <span className="conf-level">{confidenceLabel}</span>
                  <span>{assessmentData.answered} answers</span>
                </>
              ) : "Answer questions to calculate"}
            </span>
          </div>
        </div>

        <section className="knowledge-cone-card" aria-label="BLI knowledge cone">
          <div className="knowledge-cone-head">
            <div>
              <h2 className="knowledge-cone-title">Biblical Literacy Index</h2>
              <p className="knowledge-cone-sub">Knowledge expands upward from Unfamiliar to Scholar.</p>
            </div>
            <div className="knowledge-cone-score">
              {assessmentData ? currentDisplayScore : "--"}
              <span>{assessmentData ? currentDisplayLevel : "Not assessed"}</span>
            </div>
          </div>
          <div className="knowledge-cone-wrap">
            <div
              className={`knowledge-cone ${waterMotion === "active" ? "is-water-active" : ""} ${waterMotion === "settling" ? "is-water-settling" : ""}`}
              onPointerEnter={startWaterMotion}
              onPointerLeave={settleWaterMotion}
              style={{"--marker-y": `${coneMarkerPercent(currentDisplayScore)}`} as { [key: string]: string }}
            >
              <div className="glass-vessel" aria-hidden="true">
                <div
                  key={`water-${currentDisplayScore}-${assessmentData?.answered ?? 0}`}
                  className="water-fill"
                  style={{"--water-level": `${waterFillPercent}%`} as { [key: string]: string }}
                >
                  <span className="water-wave water-wave-a" />
                  <span className="water-wave water-wave-b" />
                  <span className="water-wave water-wave-c" />
                </div>
              </div>
              {[...BLI_BANDS].reverse().map((band, index) => {
                const topWidth = 98 - index * 7;
                const bottomWidth = index === BLI_BANDS.length - 1 ? topWidth - 7 : 98 - (index + 1) * 7;
                return (
                  <button
                    key={band.name}
                    type="button"
                    className={`cone-tier ${assessmentData && currentDisplayLevel === band.name ? "is-active" : ""} ${expandedConeLayer === band.name ? "is-expanded" : ""}`}
                    aria-expanded={expandedConeLayer === band.name}
                    onClick={() => setExpandedConeLayer(expandedConeLayer === band.name ? null : band.name)}
                    style={{
                      "--tier-color": band.color,
                      "--tier-index": String(index),
                      "--top-left": `${(100 - topWidth) / 2}%`,
                      "--top-right": `${100 - (100 - topWidth) / 2}%`,
                      "--bottom-left": `${(100 - bottomWidth) / 2}%`,
                      "--bottom-right": `${100 - (100 - bottomWidth) / 2}%`,
                      "--text-inset": `${Math.max((100 - topWidth) / 2, (100 - bottomWidth) / 2)}%`,
                    } as { [key: string]: string }}
                  >
                    <span className="cone-tier-name">{band.name}</span>
                    <span className="cone-tier-range">{band.min}-{band.max}</span>
                  </button>
                );
              })}
              {expandedConeLayer && (() => {
                const band = BLI_BANDS.find((item) => item.name === expandedConeLayer);
                const index = [...BLI_BANDS].reverse().findIndex((item) => item.name === expandedConeLayer);
                return band && index >= 0 ? (
                  <div
                    className="cone-layer-popover"
                    style={{"--popover-y": `${((index + 0.5) / BLI_BANDS.length) * 100}`} as { [key: string]: string }}
                  >
                    <strong>{band.name} · {band.min}-{band.max}</strong>
                    <span>{band.description}</span>
                  </div>
                ) : null;
              })()}
              {assessmentData && (
                <div className="cone-marker" aria-label={`Current BLI ${currentDisplayScore}, ${currentDisplayLevel}`}>
                  <span>{currentDisplayScore}</span>
                  <span className="cone-marker-dot" />
                </div>
              )}
            </div>
            {!assessmentData && (
              <p className="cone-empty-note">Take an assessment to place your score on the cone.</p>
            )}
          </div>
        </section>

        <div className={`start-hero compact ${isAssessmentCharging ? "is-charging" : ""}`}>
          <div
            className="assessment-cta-wrap"
            onMouseEnter={startAssessmentHold}
            onMouseLeave={cancelAssessmentHold}
          >
            <Link className="start-btn" href="/assess" onClick={cancelAssessmentHold}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h13"/><path d="M11 5l7 7-7 7"/>
              </svg>
              <span className="start-btn-label">{assessmentData ? "Continue assessment" : "Start assessment"}</span>
            </Link>
          </div>
        </div>

        <section className="recommended-card" aria-label="Recommended reading">
          <div>
            <p className="recommended-eyebrow">Recommended next</p>
            <h2 className="recommended-title">{recommendedStudy.label}</h2>
            <p className="recommended-books">{recommendedStudy.books}</p>
            <p className="recommended-focus">{recommendedStudy.focus}</p>
          </div>
          <div>
            <p className="recommended-priority">{recommendedStudy.priority}</p>
            <Link className="recommended-action" href="/knowledge-map">
              Open knowledge map
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        </section>

        <p className="section-eyebrow">Breakdown by section</p>
        <div className="sections-grid">
          {[
            { cls: "torah",    name: "Torah",           books: "Genesis - Deuteronomy" },
            { cls: "former",   name: "Former Prophets", books: "Joshua - Kings" },
            { cls: "latter",   name: "Latter Prophets", books: "Isaiah - Malachi" },
            { cls: "writings", name: "Writings",        books: "Psalms, Proverbs, Job..." },
          ].map(s => {
            const score = sectionScores[s.name];
            return (
              <div key={s.cls} className={"section-card " + s.cls} style={{opacity: score ? 1 : 0.55}}>
                <div className="sc-top">
                  <div>
                    <div className="sc-name">{s.name}</div>
                    <div className="sc-books">{s.books}</div>
                  </div>
                  <div className="sc-pct-empty" style={{color: score ? "#1b2442" : undefined}}>
                    {score ? score.pct + "%" : "-"}
                  </div>
                </div>
                <div className="sc-bar-track">
                  {score && (
                    <div className="sc-bar-fill" style={{
                      width: score.pct + "%",
                      background: s.cls === "torah" ? "linear-gradient(90deg,#d4a017,#f5c842)"
                        : s.cls === "former" ? "linear-gradient(90deg,#0e8c6a,#34d399)"
                        : s.cls === "latter" ? "linear-gradient(90deg,#2563c4,#60a5fa)"
                        : "linear-gradient(90deg,#7c3aed,#a78bfa)",
                      height: "100%", borderRadius: 999, transition: "width 1s ease"
                    }} />
                  )}
                </div>
                <span className="sc-chip-empty" style={score ? {
                  background: "var(--accent-dim)", borderColor: "var(--accent-line)", color: "#0a6e6e"
                } : {}}>
                  {score ? score.total + " questions answered" : "Not yet assessed"}
                </span>
              </div>
            );
          })}
        </div>
          </>
        ) : (
          <section className="placeholder-dashboard" aria-label={`${activeDashboardTab === "church-history" ? "Church History" : "Biblical Languages"} dashboard placeholder`}>
            <div>
              <p className="placeholder-eyebrow">Coming soon</p>
              <h2 className="placeholder-title">
                {activeDashboardTab === "church-history" ? "Church History Dashboard" : "Biblical Languages Dashboard"}
              </h2>
              <p className="placeholder-copy">
                {activeDashboardTab === "church-history"
                  ? "This space will eventually track progress through major eras, councils, figures, doctrines, movements, and the story of the global church. For now it is a holding place while the course content is being built."
                  : "This space will eventually track progress in biblical Hebrew, Greek, vocabulary, grammar, parsing, and reading fluency. For now it is a holding place while the language pathway is being built."}
              </p>
              <div className="placeholder-list">
                <span className="placeholder-pill">Progress metrics pending</span>
                <span className="placeholder-pill">Recommendations pending</span>
                <span className="placeholder-pill">Assessment engine pending</span>
              </div>
            </div>
            <div className="placeholder-orbit" aria-hidden="true" />
          </section>
        )}
      </main>
    </>
  );
}
