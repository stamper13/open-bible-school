"use client";

import { useEffect, type RefObject } from "react";

/**
 * Slides the assessment header out of view on a downward scroll and brings it
 * back on an upward one, reclaiming its ~65px for the question on a phone.
 *
 * Toggles a class directly rather than holding the hidden state in React: this
 * fires on every scroll frame, and routing it through state would re-render the
 * whole question screen mid-drag for a purely visual change.
 *
 * The header stays sticky throughout, so this only ever moves it — the page
 * keeps its ordinary scroll and nothing can end up unreachable. Bringing it
 * back whenever the page is near the top matters more than it looks: a new
 * question resets the scroll, and the header must be there again for it.
 */
export function useHideNavOnScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const phone = window.matchMedia("(max-width: 640px)");
    /** Below this the header always shows, so the top of a question is never
     *  missing its Exit. */
    const NEAR_TOP = 12;
    /** Ignore sub-pixel jitter and iOS rubber-banding, which otherwise flap
     *  the header on and off while a finger rests still on the screen. */
    const DEAD_ZONE = 4;

    let last = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - last;
      last = y;
      if (!phone.matches) {
        el.classList.remove("is-hidden");
        return;
      }
      if (y <= NEAR_TOP) el.classList.remove("is-hidden");
      else if (delta > DEAD_ZONE) el.classList.add("is-hidden");
      else if (delta < -DEAD_ZONE) el.classList.remove("is-hidden");
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    phone.addEventListener("change", update);
    return () => {
      window.removeEventListener("scroll", onScroll);
      phone.removeEventListener("change", update);
      if (frame) cancelAnimationFrame(frame);
      el.classList.remove("is-hidden");
    };
  }, [ref]);
}
