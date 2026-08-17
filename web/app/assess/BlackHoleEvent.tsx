"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { BIBLE_BOOKS, chapterCountForBook } from "@/lib/bibleTaxonomy";
import StarfieldRewardsLayer from "@/components/StarfieldRewardsLayer";

// Rare, on purpose: fires somewhere between 50 and 100 answered questions
// after the last one closed. Gated per-user (or per-browser for anonymous
// sessions) via localStorage — see storageKey below.
const MIN_TRIGGER_GAP = 50;
const MAX_TRIGGER_GAP = 100;

// Six clicks total to fully mature: five that grow it, one more (once it's
// at max size) that triggers the absorb. Growth is capped at one click per
// answered question, so this can't be button-mashed through — it takes at
// least six more questions once it appears.
const GROWTHS_TO_ABSORB = 5;
const BASE_RADIUS = 10;
const GROWTH_STEP = 9;

type Passage = {
  id: string;
  book_code: string;
  book_name: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  passage_text: string;
};

type Phase = "idle" | "dormant" | "absorbing" | "guessing" | "reveal";

type AmbientStar = {
  baseX: number; baseY: number; // fraction of viewport, 0-1
  x: number; y: number; // current animated px, lazily initialized
  r: number;
  o: number;
  angle: number;
};

function randomTriggerGap() {
  return MIN_TRIGGER_GAP + Math.floor(Math.random() * (MAX_TRIGGER_GAP - MIN_TRIGGER_GAP + 1));
}

export default function BlackHoleEvent({ answeredCount, userId }: { answeredCount: number; userId: string | null }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [growths, setGrowths] = useState(0);
  const [lastGrowthAt, setLastGrowthAt] = useState<number | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [bookQuery, setBookQuery] = useState("");
  const [selectedBookCode, setSelectedBookCode] = useState<string | null>(null);
  const [chapterQuery, setChapterQuery] = useState("");
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<{ reward: "star" | "planet" | null } | null>(null);
  const [rewardRefreshToken, setRewardRefreshToken] = useState(0);
  const [guessVisible, setGuessVisible] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayRadiusRef = useRef(0);
  const targetRadiusRef = useRef(0);
  const starsRef = useRef<AmbientStar[]>([]);
  const rafRef = useRef(0);
  // Mirrors storageKey every render so the trigger effect (kept at a fixed
  // dependency-array length) always reads the current key without needing
  // userId as a dependency.
  const storageKeyRef = useRef("");
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const storageKey = `obs_blackhole_next_${userId ?? "anon"}`;
  storageKeyRef.current = storageKey;

  const selectedBookName = selectedBookCode ? BIBLE_BOOKS.find(b => b.code === selectedBookCode)?.name ?? null : null;
  const selectedBookChapters = selectedBookCode ? chapterCountForBook(selectedBookCode) ?? 1 : 0;

  const spawn = useCallback(() => {
    const vw = window.innerWidth || 375;
    const vh = window.innerHeight || 667;
    const corner = Math.floor(Math.random() * 4);
    const marginX = Math.min(90 + Math.random() * 60, vw * 0.35);
    const marginY = Math.min(120 + Math.random() * 70, vh * 0.35);
    const rawX = corner % 2 === 0 ? marginX : vw - marginX;
    const rawY = corner < 2 ? marginY : vh - marginY;
    // Defensive clamp — always keep the whole hit area on-screen even on an
    // unusually small or not-yet-settled viewport.
    const x = Math.max(24, Math.min(vw - 24, rawX));
    const y = Math.max(24, Math.min(vh - 24, rawY));
    setPosition({ x, y });
    setGrowths(0);
    setLastGrowthAt(null);
    displayRadiusRef.current = 0;
    targetRadiusRef.current = BASE_RADIUS;
    starsRef.current = Array.from({ length: 90 }, () => ({
      baseX: Math.random(), baseY: Math.random(),
      x: 0, y: 0, r: 0.5 + Math.random() * 1.5, o: 0.35 + Math.random() * 0.55,
      angle: Math.random() * Math.PI * 2,
    }));
    setPhase("dormant");
  }, []);

  // --- trigger: roll a random threshold once, fire when answeredCount catches up ---
  useEffect(() => {
    if (phase !== "idle" || answeredCount <= 0) return;
    const key = storageKeyRef.current;
    const raw = localStorage.getItem(key);
    const stored = raw === null ? NaN : Number(raw);
    if (raw === null || Number.isNaN(stored)) {
      localStorage.setItem(key, String(answeredCount + randomTriggerGap()));
      return;
    }
    if (answeredCount >= stored) spawn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answeredCount, phase]);

  const loadPassage = useCallback(async () => {
    const { data, error } = await supabase.rpc("obs_get_random_starfield_passage");
    if (!error && data) setPassage(data as Passage);
    else if (error) console.error("Black hole: failed to load passage:", error);
  }, []);

  const canGrowNow = growths === 0 || (lastGrowthAt !== null && answeredCount > lastGrowthAt);

  const handleBlackHoleClick = useCallback(() => {
    if (phase !== "dormant" || !canGrowNow) return;
    if (growths < GROWTHS_TO_ABSORB) {
      const next = growths + 1;
      setGrowths(next);
      setLastGrowthAt(answeredCount);
      targetRadiusRef.current = BASE_RADIUS + next * GROWTH_STEP;
    } else {
      setLastGrowthAt(answeredCount);
      setPhase("absorbing");
      // Defensive fallback: an unreadied/odd viewport report here would make
      // diag (and therefore the absorb target) 0, which — since displayRadius
      // is already positive from prior growths — makes the "done absorbing"
      // check trivially true on the very next frame and skips the animation
      // entirely instead of expanding to cover the screen.
      const vw = window.innerWidth || 375;
      const vh = window.innerHeight || 667;
      const diag = Math.hypot(vw, vh) || 900;
      targetRadiusRef.current = diag * 1.1;
      void loadPassage();
    }
  }, [phase, canGrowNow, growths, answeredCount, loadPassage]);

  // --- canvas animation: ambient stars pulled toward the black hole, black
  // hole itself drawn with an accretion glow. Runs while dormant/absorbing;
  // frozen (last frame persists untouched) once guessing/reveal begin. ---
  useEffect(() => {
    if (phase === "idle") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    function drawBlackHole(cx: number, cy: number, r: number) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(cx, cy);
      const halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 3.2);
      halo.addColorStop(0, "rgba(150,120,255,0.35)");
      halo.addColorStop(0.5, "rgba(90,70,180,0.12)");
      halo.addColorStop(1, "rgba(90,70,180,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,238,196,0.85)";
      ctx.lineWidth = Math.max(1, r * 0.16);
      ctx.shadowColor = "rgba(255,224,150,0.8)";
      ctx.shadowBlur = r * 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.55, r * 0.55, Math.PI * 0.18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#05030a";
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width, h = canvas.height;

      displayRadiusRef.current += (targetRadiusRef.current - displayRadiusRef.current) * 0.09;
      const r = displayRadiusRef.current * DPR;
      const cx = (position?.x ?? w / 2 / DPR) * DPR;
      const cy = (position?.y ?? h / 2 / DPR) * DPR;

      ctx.clearRect(0, 0, w, h);

      const pullRadius = r * 9;
      const consumeRadius = r * 1.35;
      starsRef.current.forEach(star => {
        if (star.x === 0 && star.y === 0) {
          star.x = star.baseX * w;
          star.y = star.baseY * h;
        }
        const dx = cx - star.x, dy = cy - star.y;
        const dist = Math.hypot(dx, dy);
        if (dist < pullRadius) {
          const pull = 0.012 + (1 - dist / pullRadius) * 0.05;
          const angle = Math.atan2(dy, dx) + 0.55; // spiral, not a straight line
          star.x += Math.cos(angle) * dist * pull;
          star.y += Math.sin(angle) * dist * pull;
        }
        if (dist < consumeRadius) {
          // consumed — recycle it back out to the edge of the pull field
          const respawnAngle = Math.random() * Math.PI * 2;
          star.x = cx + Math.cos(respawnAngle) * pullRadius * (0.9 + Math.random() * 0.3);
          star.y = cy + Math.sin(respawnAngle) * pullRadius * (0.9 + Math.random() * 0.3);
          star.o = 0.35 + Math.random() * 0.55;
        }
        const fade = Math.min(1, Math.max(0.08, dist / consumeRadius));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r * DPR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.o * fade})`;
        ctx.fill();
      });

      if (r > 0.5) drawBlackHole(cx, cy, r);

      const doneAbsorbing = phaseRef.current === "absorbing" && displayRadiusRef.current >= targetRadiusRef.current * 0.985;
      if (doneAbsorbing) {
        setPhase("guessing");
        return; // stop the loop here; canvas keeps its last (fully covering) frame
      }
      if (!reduceMotion) rafRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [phase, position]);

  useEffect(() => {
    if (phase !== "guessing") { setGuessVisible(false); return; }
    const t = setTimeout(() => setGuessVisible(true), 260);
    return () => clearTimeout(t);
  }, [phase]);

  const closeEvent = useCallback(() => {
    setPhase("idle");
    setPosition(null);
    setPassage(null);
    setBookQuery(""); setSelectedBookCode(null);
    setChapterQuery(""); setSelectedChapter(null);
    setOutcome(null);
    localStorage.setItem(storageKey, String(answeredCount + randomTriggerGap()));
  }, [answeredCount, storageKey]);

  const handleReveal = useCallback(async () => {
    if (!passage || !selectedBookCode) return;
    const bookCorrect = selectedBookCode === passage.book_code;
    const chapterCorrect = bookCorrect && selectedChapter !== null && selectedChapter === passage.chapter;
    const rewardType: "star" | "planet" | null = chapterCorrect ? "planet" : bookCorrect ? "star" : null;

    if (rewardType && userId) {
      const seed = Math.floor(Math.random() * 2_147_483_647);
      const { error } = await supabase.from("obs_starfield_rewards").insert({
        user_id: userId,
        reward_type: rewardType,
        passage_id: passage.id,
        guessed_book_code: selectedBookCode,
        guessed_chapter: selectedChapter,
        book_correct: bookCorrect,
        chapter_correct: chapterCorrect,
        seed,
      });
      if (error) console.error("Black hole: failed to save reward:", error);
      else setRewardRefreshToken(t => t + 1);
    }
    setOutcome({ reward: rewardType });
    setPhase("reveal");
  }, [passage, selectedBookCode, selectedChapter, userId]);

  const bookMatches = bookQuery.trim().length === 0
    ? []
    : BIBLE_BOOKS.filter(b => b.name.toLowerCase().includes(bookQuery.trim().toLowerCase())).slice(0, 8);

  const chapterOptions = selectedBookChapters > 0
    ? Array.from({ length: selectedBookChapters }, (_, i) => i + 1).filter(n =>
        chapterQuery.trim() === "" ? true : String(n).startsWith(chapterQuery.trim())
      )
    : [];

  if (phase === "idle") {
    return <StarfieldRewardsLayer userId={userId} refreshToken={rewardRefreshToken} />;
  }

  const hitAreaSize = Math.max(28, displayRadiusRef.current * 2 + 30);

  return (
    <>
      <StarfieldRewardsLayer userId={userId} refreshToken={rewardRefreshToken} />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 60, pointerEvents: "none" }}
      />
      {phase === "dormant" && position && (
        <button
          type="button"
          onClick={handleBlackHoleClick}
          aria-label={canGrowNow ? "A small black hole has opened nearby — click to feed it" : "The black hole is resting until your next question"}
          className="bh-hit"
          style={{
            left: position.x - hitAreaSize / 2,
            top: position.y - hitAreaSize / 2,
            width: hitAreaSize,
            height: hitAreaSize,
            cursor: canGrowNow ? "pointer" : "default",
          }}
        />
      )}
      {(phase === "guessing" || phase === "reveal") && (
        <div className={`bh-guess ${guessVisible || phase === "reveal" ? "is-visible" : ""}`} role="dialog" aria-label="Black hole passage challenge">
          {phase === "guessing" && passage && (
            <>
              <p className="bh-eyebrow">A signal from the deep</p>
              <p className="bh-passage">&ldquo;{passage.passage_text}&rdquo;</p>
              <p className="bh-prompt">Which book — and which chapter — is this from?</p>

              {!selectedBookCode ? (
                <div className="bh-picker">
                  <input
                    autoFocus
                    className="bh-input"
                    placeholder="Start typing a book..."
                    value={bookQuery}
                    onChange={e => setBookQuery(e.target.value)}
                  />
                  {bookMatches.length > 0 && (
                    <div className="bh-pills">
                      {bookMatches.map(b => (
                        <button key={b.code} type="button" className="bh-pill" onClick={() => { setSelectedBookCode(b.code); setBookQuery(""); }}>
                          {b.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bh-picker">
                  <div className="bh-selected-row">
                    <span className="bh-selected-pill">{selectedBookName}</span>
                    <button type="button" className="bh-change" onClick={() => { setSelectedBookCode(null); setSelectedChapter(null); setChapterQuery(""); }}>
                      change
                    </button>
                  </div>
                  {!selectedChapter ? (
                    <>
                      <input
                        autoFocus
                        className="bh-input"
                        inputMode="numeric"
                        placeholder={`Chapter (1–${selectedBookChapters})...`}
                        value={chapterQuery}
                        onChange={e => setChapterQuery(e.target.value.replace(/[^0-9]/g, ""))}
                      />
                      <div className="bh-pills bh-pills-scroll">
                        {chapterOptions.map(n => (
                          <button key={n} type="button" className="bh-pill bh-pill-num" onClick={() => setSelectedChapter(n)}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="bh-selected-row">
                      <span className="bh-selected-pill">Chapter {selectedChapter}</span>
                      <button type="button" className="bh-change" onClick={() => { setSelectedChapter(null); setChapterQuery(""); }}>
                        change
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="bh-actions">
                <button type="button" className="bh-primary" disabled={!selectedBookCode} onClick={handleReveal}>
                  Reveal
                </button>
                <button type="button" className="bh-secondary" onClick={closeEvent}>
                  Let it close
                </button>
              </div>
            </>
          )}

          {phase === "reveal" && passage && outcome && (
            <>
              <p className="bh-eyebrow">
                {outcome.reward ? "The sky remembers this" : "Not this time"}
              </p>
              <p className="bh-passage">&ldquo;{passage.passage_text}&rdquo;</p>
              <p className="bh-prompt">
                It was <strong>{passage.book_name} {passage.chapter}</strong>.
              </p>
              {outcome.reward === "planet" && (
                <p className="bh-outcome">Book and chapter, exactly right — a new planet is permanently in your sky.</p>
              )}
              {outcome.reward === "star" && (
                <p className="bh-outcome">Right book — a new star is permanently in your sky.</p>
              )}
              {!outcome.reward && (
                <p className="bh-outcome">The black hole closes quietly. It&apos;ll open again sometime.</p>
              )}
              <div className="bh-actions">
                <button type="button" className="bh-primary" onClick={closeEvent}>Continue</button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        .bh-hit {
          position: fixed; z-index: 61; border-radius: 50%;
          background: transparent; border: none; padding: 0;
        }
        .bh-guess {
          position: fixed; inset: 0; z-index: 62;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 18px; padding: 32px; text-align: center;
          opacity: 0; transition: opacity 1s ease;
          pointer-events: none;
        }
        .bh-guess.is-visible { opacity: 1; pointer-events: auto; }
        .bh-eyebrow {
          font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase;
          color: rgba(210,225,255,.72);
          text-shadow: 0 0 18px rgba(150,170,255,.55);
        }
        .bh-passage {
          max-width: 620px; font-family: var(--font-crimson), Georgia, serif;
          font-style: italic; font-size: clamp(20px, 3.4vw, 30px); line-height: 1.4;
          color: #fff8e6;
          text-shadow: 0 0 4px rgba(255,244,214,.9), 0 0 26px rgba(255,220,140,.5), 0 0 60px rgba(255,220,140,.22);
        }
        .bh-prompt { font-size: 14px; color: rgba(255,255,255,.68); max-width: 480px; }
        .bh-outcome { font-size: 14px; color: rgba(255,244,214,.85); max-width: 480px; }
        .bh-picker { display: flex; flex-direction: column; align-items: center; gap: 12px; width: min(100%, 420px); }
        .bh-input {
          width: 100%; text-align: center; background: transparent; border: none;
          border-bottom: 1px solid rgba(255,255,255,.3); color: #fff;
          font-size: 16px; font-family: inherit; padding: 8px 4px; outline: none;
        }
        .bh-input:focus { border-bottom-color: rgba(255,224,150,.8); }
        .bh-input::placeholder { color: rgba(255,255,255,.35); }
        .bh-pills { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 460px; }
        .bh-pills-scroll { max-height: 160px; overflow-y: auto; }
        .bh-pill {
          padding: 7px 14px; border-radius: 999px; font-size: 13px; font-weight: 650;
          background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.2); color: #fff;
          cursor: pointer;
        }
        .bh-pill:hover, .bh-pill:focus-visible { background: rgba(255,224,150,.18); border-color: rgba(255,224,150,.5); }
        .bh-pill-num { min-width: 40px; }
        .bh-selected-row { display: flex; align-items: center; gap: 10px; }
        .bh-selected-pill {
          padding: 8px 16px; border-radius: 999px; font-size: 14px; font-weight: 700;
          background: rgba(255,224,150,.14); border: 1px solid rgba(255,224,150,.4); color: #fff8e6;
        }
        .bh-change { background: none; border: none; color: rgba(255,255,255,.5); font-size: 12px; text-decoration: underline; cursor: pointer; }
        .bh-actions { display: flex; gap: 12px; margin-top: 6px; }
        .bh-primary {
          padding: 12px 24px; border-radius: 999px; border: none; font-weight: 800; font-size: 14px;
          background: linear-gradient(135deg, #fff4cf, #e6ad12); color: #241a02; cursor: pointer;
          box-shadow: 0 10px 30px rgba(230,173,18,.35);
        }
        .bh-primary:disabled { opacity: .4; cursor: default; box-shadow: none; }
        .bh-secondary {
          padding: 12px 20px; border-radius: 999px; border: 1px solid rgba(255,255,255,.25);
          background: transparent; color: rgba(255,255,255,.75); font-size: 13px; cursor: pointer;
        }
      `}</style>
    </>
  );
}
