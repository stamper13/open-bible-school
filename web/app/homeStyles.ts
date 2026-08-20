// Pure CSS text, rendered via a <style> tag on the homepage. No behavior change intended.
import { HOME_CHROME_STYLES } from "./homeStyles/chrome";
import { HOME_LANDING_STYLES } from "./homeStyles/landing";
import { HOME_SCORE_STYLES } from "./homeStyles/scores";
import { HOME_KNOWLEDGE_CONE_STYLES } from "./homeStyles/knowledgeCone";
import { HOME_RECOMMENDATION_STYLES } from "./homeStyles/recommendations";
import { HOME_SCOPE_DRAWER_STYLES } from "./homeStyles/scopeDrawer";
import { HOME_RESPONSIVE_STYLES } from "./homeStyles/responsive";

export const HOME_PAGE_STYLES = [
  HOME_CHROME_STYLES,
  HOME_LANDING_STYLES,
  HOME_SCORE_STYLES,
  HOME_KNOWLEDGE_CONE_STYLES,
  HOME_RECOMMENDATION_STYLES,
  HOME_SCOPE_DRAWER_STYLES,
  HOME_RESPONSIVE_STYLES,
].join("");
