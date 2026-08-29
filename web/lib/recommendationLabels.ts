import { BOOK_NAMES } from "./bibleTaxonomy.ts";

export type RecommendationPassageParts = {
  book_code: string;
  start_chapter: number;
  end_chapter: number;
  label: string;
};

export function sanitizePassageReference(reference: string): string {
  return reference
    .replace(/:999\b/g, "")
    .replace(/\b(\d+):1-(\d+)(?![\d:])/g, "$1-$2");
}

export function recommendationPassageLabel(recommendation: RecommendationPassageParts): string {
  const sanitized = sanitizePassageReference(recommendation.label);
  if (!recommendation.label.includes(":999")) return sanitized;
  const bookName = BOOK_NAMES[recommendation.book_code] ?? recommendation.book_code;
  const startChapter = Number(recommendation.start_chapter);
  const endChapter = Number(recommendation.end_chapter);
  if (!bookName || !Number.isFinite(startChapter)) {
    return sanitized;
  }
  const chapterRange = Number.isFinite(endChapter) && endChapter !== startChapter
    ? `${startChapter}-${endChapter}`
    : `${startChapter}`;
  return `${bookName} ${chapterRange}`;
}
