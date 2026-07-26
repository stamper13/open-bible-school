export type Testament = "OT" | "NT";

export type BibleSectionKey =
  | "TORAH"
  | "FORMER"
  | "LATTER"
  | "WRITINGS"
  | "GOSPELS_ACTS"
  | "PAULINE"
  | "GENERAL"
  | "APOCALYPSE";

export type BibleSectionName =
  | "Torah"
  | "Former Prophets"
  | "Latter Prophets"
  | "Writings"
  | "Gospels & Acts"
  | "Pauline Epistles"
  | "General Epistles"
  | "Apocalypse";

export type OldTestamentSectionName =
  | "Torah"
  | "Former Prophets"
  | "Latter Prophets"
  | "Writings";

export type BibleBook = {
  code: string;
  name: string;
  testament: Testament;
  sectionKey: BibleSectionKey;
  section: BibleSectionName;
  order: number;
};

const book = (
  code: string,
  name: string,
  testament: Testament,
  sectionKey: BibleSectionKey,
  section: BibleSectionName,
  order: number,
): BibleBook => ({ code, name, testament, sectionKey, section, order });

export const BIBLE_BOOKS: BibleBook[] = [
  book("GEN", "Genesis", "OT", "TORAH", "Torah", 1),
  book("EXO", "Exodus", "OT", "TORAH", "Torah", 2),
  book("LEV", "Leviticus", "OT", "TORAH", "Torah", 3),
  book("NUM", "Numbers", "OT", "TORAH", "Torah", 4),
  book("DEU", "Deuteronomy", "OT", "TORAH", "Torah", 5),
  book("JOS", "Joshua", "OT", "FORMER", "Former Prophets", 6),
  book("JDG", "Judges", "OT", "FORMER", "Former Prophets", 7),
  book("RUT", "Ruth", "OT", "FORMER", "Former Prophets", 8),
  book("1SA", "1 Samuel", "OT", "FORMER", "Former Prophets", 9),
  book("2SA", "2 Samuel", "OT", "FORMER", "Former Prophets", 10),
  book("1KI", "1 Kings", "OT", "FORMER", "Former Prophets", 11),
  book("2KI", "2 Kings", "OT", "FORMER", "Former Prophets", 12),
  book("1CH", "1 Chronicles", "OT", "WRITINGS", "Writings", 13),
  book("2CH", "2 Chronicles", "OT", "WRITINGS", "Writings", 14),
  book("EZR", "Ezra", "OT", "WRITINGS", "Writings", 15),
  book("NEH", "Nehemiah", "OT", "WRITINGS", "Writings", 16),
  book("EST", "Esther", "OT", "WRITINGS", "Writings", 17),
  book("JOB", "Job", "OT", "WRITINGS", "Writings", 18),
  book("PSA", "Psalms", "OT", "WRITINGS", "Writings", 19),
  book("PRO", "Proverbs", "OT", "WRITINGS", "Writings", 20),
  book("ECC", "Ecclesiastes", "OT", "WRITINGS", "Writings", 21),
  book("SNG", "Song of Songs", "OT", "WRITINGS", "Writings", 22),
  book("ISA", "Isaiah", "OT", "LATTER", "Latter Prophets", 23),
  book("JER", "Jeremiah", "OT", "LATTER", "Latter Prophets", 24),
  book("LAM", "Lamentations", "OT", "LATTER", "Latter Prophets", 25),
  book("EZE", "Ezekiel", "OT", "LATTER", "Latter Prophets", 26),
  book("DAN", "Daniel", "OT", "LATTER", "Latter Prophets", 27),
  book("HOS", "Hosea", "OT", "LATTER", "Latter Prophets", 28),
  book("JOL", "Joel", "OT", "LATTER", "Latter Prophets", 29),
  book("AMO", "Amos", "OT", "LATTER", "Latter Prophets", 30),
  book("OBA", "Obadiah", "OT", "LATTER", "Latter Prophets", 31),
  book("JON", "Jonah", "OT", "LATTER", "Latter Prophets", 32),
  book("MIC", "Micah", "OT", "LATTER", "Latter Prophets", 33),
  book("NAM", "Nahum", "OT", "LATTER", "Latter Prophets", 34),
  book("HAB", "Habakkuk", "OT", "LATTER", "Latter Prophets", 35),
  book("ZEP", "Zephaniah", "OT", "LATTER", "Latter Prophets", 36),
  book("HAG", "Haggai", "OT", "LATTER", "Latter Prophets", 37),
  book("ZEC", "Zechariah", "OT", "LATTER", "Latter Prophets", 38),
  book("MAL", "Malachi", "OT", "LATTER", "Latter Prophets", 39),
  book("MAT", "Matthew", "NT", "GOSPELS_ACTS", "Gospels & Acts", 40),
  book("MRK", "Mark", "NT", "GOSPELS_ACTS", "Gospels & Acts", 41),
  book("LUK", "Luke", "NT", "GOSPELS_ACTS", "Gospels & Acts", 42),
  book("JHN", "John", "NT", "GOSPELS_ACTS", "Gospels & Acts", 43),
  book("ACT", "Acts", "NT", "GOSPELS_ACTS", "Gospels & Acts", 44),
  book("ROM", "Romans", "NT", "PAULINE", "Pauline Epistles", 45),
  book("1CO", "1 Corinthians", "NT", "PAULINE", "Pauline Epistles", 46),
  book("2CO", "2 Corinthians", "NT", "PAULINE", "Pauline Epistles", 47),
  book("GAL", "Galatians", "NT", "PAULINE", "Pauline Epistles", 48),
  book("EPH", "Ephesians", "NT", "PAULINE", "Pauline Epistles", 49),
  book("PHP", "Philippians", "NT", "PAULINE", "Pauline Epistles", 50),
  book("COL", "Colossians", "NT", "PAULINE", "Pauline Epistles", 51),
  book("1TH", "1 Thessalonians", "NT", "PAULINE", "Pauline Epistles", 52),
  book("2TH", "2 Thessalonians", "NT", "PAULINE", "Pauline Epistles", 53),
  book("1TI", "1 Timothy", "NT", "PAULINE", "Pauline Epistles", 54),
  book("2TI", "2 Timothy", "NT", "PAULINE", "Pauline Epistles", 55),
  book("TIT", "Titus", "NT", "PAULINE", "Pauline Epistles", 56),
  book("PHM", "Philemon", "NT", "PAULINE", "Pauline Epistles", 57),
  book("HEB", "Hebrews", "NT", "GENERAL", "General Epistles", 58),
  book("JAS", "James", "NT", "GENERAL", "General Epistles", 59),
  book("1PE", "1 Peter", "NT", "GENERAL", "General Epistles", 60),
  book("2PE", "2 Peter", "NT", "GENERAL", "General Epistles", 61),
  book("1JN", "1 John", "NT", "GENERAL", "General Epistles", 62),
  book("2JN", "2 John", "NT", "GENERAL", "General Epistles", 63),
  book("3JN", "3 John", "NT", "GENERAL", "General Epistles", 64),
  book("JUD", "Jude", "NT", "GENERAL", "General Epistles", 65),
  book("REV", "Revelation", "NT", "APOCALYPSE", "Apocalypse", 66),
];

export const BIBLE_BOOK_CODES = BIBLE_BOOKS.map((item) => item.code);
export const OT_BOOK_CODES = BIBLE_BOOKS
  .filter((item) => item.testament === "OT")
  .map((item) => item.code);
export const NT_BOOK_CODES = BIBLE_BOOKS
  .filter((item) => item.testament === "NT")
  .map((item) => item.code);

export const BOOK_NAMES: Record<string, string> = Object.fromEntries(
  BIBLE_BOOKS.map((item) => [item.code, item.name]),
);

export const SECTION_BOOKS: Record<BibleSectionName, string[]> =
  Object.fromEntries(
    BIBLE_BOOKS.reduce((entries, item) => {
      const existing = entries.get(item.section) ?? [];
      existing.push(item.code);
      entries.set(item.section, existing);
      return entries;
    }, new Map<BibleSectionName, string[]>()),
  ) as Record<BibleSectionName, string[]>;

const BOOK_BY_CODE = new Map(
  BIBLE_BOOKS.map((item) => [item.code, item]),
);

export function bookForCode(bookCode: string | null | undefined) {
  return BOOK_BY_CODE.get((bookCode ?? "").toUpperCase()) ?? null;
}

export function sectionForBook(bookCode: string | null | undefined) {
  return bookForCode(bookCode)?.section ?? "Unmapped";
}

export function testamentForBook(bookCode: string | null | undefined) {
  return bookForCode(bookCode)?.testament ?? null;
}
