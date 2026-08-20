// Pure CSS text, rendered via a <style> tag on the assessment page. No behavior change intended.
import { ASSESS_CHROME_STYLES } from "./assessStyles/chrome";
import { ASSESS_QUESTION_CARD_STYLES } from "./assessStyles/questionCard";
import { ASSESS_INTERACTION_STYLES } from "./assessStyles/interactions";
import { ASSESS_OVERLAY_STYLES } from "./assessStyles/overlays";
import { ASSESS_SCREEN_STYLES } from "./assessStyles/screens";
import { ASSESS_RESPONSIVE_STYLES } from "./assessStyles/responsive";

export const ASSESS_PAGE_STYLES = [
  ASSESS_CHROME_STYLES,
  ASSESS_QUESTION_CARD_STYLES,
  ASSESS_INTERACTION_STYLES,
  ASSESS_OVERLAY_STYLES,
  ASSESS_SCREEN_STYLES,
  ASSESS_RESPONSIVE_STYLES,
].join("");
