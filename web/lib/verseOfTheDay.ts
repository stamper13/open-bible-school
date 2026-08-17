// A small, curated rotation for the dashboard's "Verse of the Day" — shown
// in the middle column of the score strip, which is otherwise empty
// breathing room once a score exists (see .level-block in app/page.tsx).
//
// Scope is deliberate: New Testament passages, or Old Testament passages
// the New Testament itself quotes or alludes to heavily (messianic
// prophecy, the Shema, etc.) — not a general "inspirational verses" grab
// bag. Text is King James Version, which is public domain; wording was
// fetched from bible-api.com and cross-checked against a second source
// (BibleGateway) for the one entry that came back with what looked like a
// transcription typo (Genesis 12:3 — "treates" corrected to "treats").
//
// The picker is deterministic (day-of-year mod pool size), not random, so
// "today's verse" means the same thing on every reload and every device
// for the same calendar day.

export type Verse = {
  reference: string;
  text: string;
};

export const VERSES: Verse[] = [
  // New Testament
  {
    reference: "Matthew 6:33",
    text: "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.",
  },
  {
    reference: "Matthew 11:28",
    text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.",
  },
  {
    reference: "John 1:1",
    text: "In the beginning was the Word, and the Word was with God, and the Word was God.",
  },
  {
    reference: "John 3:16",
    text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
  },
  {
    reference: "John 8:12",
    text: "Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.",
  },
  {
    reference: "John 14:6",
    text: "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.",
  },
  {
    reference: "Romans 8:28",
    text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
  },
  {
    reference: "Romans 12:2",
    text: "And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.",
  },
  {
    reference: "2 Corinthians 5:17",
    text: "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.",
  },
  {
    reference: "Galatians 2:20",
    text: "I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me: and the life which I now live in the flesh I live by the faith of the Son of God, who loved me, and gave himself for me.",
  },
  {
    reference: "Ephesians 2:8-9",
    text: "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: not of works, lest any man should boast.",
  },
  {
    reference: "Philippians 4:13",
    text: "I can do all things through Christ which strengtheneth me.",
  },
  {
    reference: "Colossians 3:23-24",
    text: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men; knowing that of the Lord ye shall receive the reward of the inheritance: for ye serve the Lord Christ.",
  },
  {
    reference: "Hebrews 11:1",
    text: "Now faith is the substance of things hoped for, the evidence of things not seen.",
  },
  {
    reference: "1 Peter 5:7",
    text: "Casting all your care upon him; for he careth for you.",
  },
  {
    reference: "1 John 4:19",
    text: "We love him, because he first loved us.",
  },
  {
    reference: "Revelation 21:4",
    text: "And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.",
  },

  // Old Testament — heavily quoted or alluded to in the New Testament
  {
    reference: "Genesis 1:1",
    text: "In the beginning God created the heaven and the earth.",
  },
  {
    reference: "Genesis 12:3",
    text: "And I will bless them that bless thee, and curse him that curseth thee: and in thee shall all families of the earth be blessed.",
  },
  {
    reference: "Exodus 3:14",
    text: "And God said unto Moses, I AM THAT I AM: and he said, Thus shalt thou say unto the children of Israel, I AM hath sent me unto you.",
  },
  {
    reference: "Leviticus 19:18",
    text: "Thou shalt not avenge, nor bear any grudge against the children of thy people, but thou shalt love thy neighbour as thyself: I am the LORD.",
  },
  {
    reference: "Deuteronomy 6:5",
    text: "And thou shalt love the LORD thy God with all thine heart, and with all thy soul, and with all thy might.",
  },
  {
    reference: "Psalm 22:1",
    text: "My God, my God, why hast thou forsaken me? why art thou so far from helping me, and from the words of my roaring?",
  },
  {
    reference: "Psalm 110:1",
    text: "The LORD said unto my Lord, Sit thou at my right hand, until I make thine enemies thy footstool.",
  },
  {
    reference: "Psalm 118:22",
    text: "The stone which the builders refused is become the head stone of the corner.",
  },
  {
    reference: "Isaiah 7:14",
    text: "Therefore the Lord himself shall give you a sign; Behold, a virgin shall conceive, and bear a son, and shall call his name Immanuel.",
  },
  {
    reference: "Isaiah 9:6",
    text: "For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.",
  },
  {
    reference: "Isaiah 53:5",
    text: "But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed.",
  },
  {
    reference: "Isaiah 61:1",
    text: "The Spirit of the Lord GOD is upon me; because the LORD hath anointed me to preach good tidings unto the meek; he hath sent me to bind up the brokenhearted, to proclaim liberty to the captives, and the opening of the prison to them that are bound.",
  },
  {
    reference: "Micah 5:2",
    text: "But thou, Bethlehem Ephratah, though thou be little among the thousands of Judah, yet out of thee shall he come forth unto me that is to be ruler in Israel; whose goings forth have been from of old, from everlasting.",
  },
  {
    reference: "Habakkuk 2:4",
    text: "Behold, his soul which is lifted up is not upright in him: but the just shall live by his faith.",
  },
];

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((now - start) / 86_400_000);
}

/** Deterministic by calendar date (UTC) — same verse all day, everywhere,
 *  rather than a new one on every reload. */
export function verseOfTheDay(date: Date = new Date()): Verse {
  const index = dayOfYear(date) % VERSES.length;
  return VERSES[index];
}
