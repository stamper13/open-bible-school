import { BOOK_NAMES } from "./bibleTaxonomy.ts";

export type RecommendationPassageParts = {
  book_code: string;
  start_chapter: number;
  end_chapter: number;
  label: string;
};

export function recommendationPassageLabel(recommendation: RecommendationPassageParts): string {
  if (!recommendation.label.includes(":999")) return recommendation.label;
  const bookName = BOOK_NAMES[recommendation.book_code] ?? recommendation.book_code;
  const startChapter = Number(recommendation.start_chapter);
  const endChapter = Number(recommendation.end_chapter);
  if (!bookName || !Number.isFinite(startChapter)) {
    return recommendation.label.replace(/:999\b/g, "");
  }
  const chapterRange = Number.isFinite(endChapter) && endChapter !== startChapter
    ? `${startChapter}-${endChapter}`
    : `${startChapter}`;
  return `${bookName} ${chapterRange}`;
}
