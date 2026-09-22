/**
 * The face, the name and the role behind a client's proof card.
 *
 * A proof card leads with the PERSON rather than the company, and a person is the one
 * thing no read can hand us: features-service answers with a brand, its funnel and its
 * money, and has no opinion about who runs it. So this map is the whole of it, keyed on
 * the brand's own domain — the same key every other surface joins these clients on.
 *
 * ⚠️ A CLIENT THE MAP DOES NOT NAME STILL DRAWS A CARD, AND DRAWS NO PERSON.
 *
 * That is a deliberate departure from the dashboard's own proof cards, which skip a
 * brand they cannot name. It was the right call there — that surface picks from a fixed
 * catalogue and a missing face means somebody forgot. Here the pick is the producer's
 * and moves on its own, so refusing to draw an unnamed client would silently shrink the
 * section to whoever happens to be in this file, which is the frozen list the dynamic
 * pick exists to replace.
 *
 * What must NEVER happen is the other direction: inventing a person. No placeholder
 * name, no stock face, no "Founder" for somebody we have not met. An unnamed client is
 * drawn as the COMPANY — its own logo and its own name — which is true, and is what the
 * hero's live cards already do for every client they draw.
 */
export interface ShowcasePerson {
  /** A real photograph, committed under `public/landing/v2/assets/`. */
  photo: string;
  /** The person's own name, as they write it. */
  name: string;
  /** Their role, in their words — never a guess from the domain. */
  role: string;
}

/**
 * The clients whose founder has sat for a photograph, keyed on the brand domain the
 * producer states.
 *
 * Adding a client here is a commit: a face, a name and a role, each of them a fact
 * somebody checked. It is deliberately not a config row and deliberately not derived
 * from anything — there is no source to derive a person from.
 */
export const SHOWCASE_PEOPLE: Readonly<Record<string, ShowcasePerson>> = {
  "docdinners.com": {
    photo: "/landing/v2/assets/ryan-parenti.jpg",
    name: "Ryan W.D. Parenti",
    role: "Founder, Doc Dinners",
  },
  "opsfolio.com": {
    photo: "/landing/v2/assets/shahid-shah.jpg",
    name: "Shahid Shah",
    role: "CEO Netspective, Opsfolio",
  },
  "shockwavecenters.com": {
    photo: "/landing/v2/assets/david-tucker.jpg",
    name: "David Tucker",
    role: "Cofounder, Shockwave Centers",
  },
};

/** The person behind a domain, or `null` when we have never met them. */
export function personFor(domain: string | null | undefined): ShowcasePerson | null {
  if (!domain) return null;
  return SHOWCASE_PEOPLE[domain.toLowerCase()] ?? null;
}
