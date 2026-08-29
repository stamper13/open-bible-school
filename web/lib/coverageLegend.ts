type RecommendationFocusTree = {
  sections: {
    sectionKey: string;
    books: {
      units: { isFocus: boolean }[];
    }[];
  }[];
};

export function focusedRecommendationSectionKey(tree: RecommendationFocusTree): string | null {
  const focusedSection = tree.sections.find((section) => (
    section.books.some((book) => book.units.some((unit) => unit.isFocus))
  ));
  return focusedSection?.sectionKey ?? null;
}
