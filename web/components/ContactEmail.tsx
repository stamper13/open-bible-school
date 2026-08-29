"use client";

import { useSyncExternalStore } from "react";

/**
 * The feedback address, kept out of the server-rendered HTML.
 *
 * A plain `mailto:` in the markup is free food for address harvesters, and
 * this one is the author's personal inbox. The two halves are only joined
 * once the component has hydrated, so what ships in the HTML is the unlinked
 * "user [at] domain" fallback — still readable by a person (and by anyone
 * browsing without JavaScript), useless to a scraper that does not run
 * scripts.
 *
 * The hydration check is useSyncExternalStore rather than the usual
 * useState/useEffect pair: a setState in an effect body trips
 * react-hooks/set-state-in-effect, and this needs no state of its own — only
 * "is this the server render or not".
 *
 * Pass `label` where the link reads as something other than the address
 * itself (the footer's "Contact"). There the address was only ever in the
 * href, so the pre-hydration render is the same words as plain text, and it
 * becomes a link once the address exists to point at.
 *
 * Every page that offers an email should use this rather than writing the
 * address inline.
 */

const USER = "adstamper35";
const DOMAIN = "gmail.com";

const subscribe = () => () => {};

export default function ContactEmail({
  subject,
  label,
  className,
}: {
  subject: string;
  label?: string;
  className?: string;
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!hydrated) {
    return label ? (
      <span className={className}>{label}</span>
    ) : (
      <span>
        {USER} [at] {DOMAIN}
      </span>
    );
  }

  const address = `${USER}@${DOMAIN}`;
  return (
    <a className={className} href={`mailto:${address}?subject=${encodeURIComponent(subject)}`}>
      {label ?? address}
    </a>
  );
}
