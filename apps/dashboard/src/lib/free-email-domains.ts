/**
 * Free / personal / disposable email providers.
 *
 * Used to decide whether a signup email's domain is the domain of a BUSINESS
 * (kevin@acme.com -> acme.com is worth prefilling as the brand URL) or of a
 * mailbox provider (kevin@gmail.com -> gmail.com would send the user off to
 * analyze Gmail's own website).
 *
 * The asymmetry that governs how aggressive this list should be: a false BLOCK
 * just leaves the URL field empty, which is exactly today's behaviour, while a
 * false ALLOW prefills a wrong domain the user has to notice and clear. So when
 * in doubt, block.
 */
const FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  // Google / Apple / Microsoft consumer (see FAMILIES below for MS ccTLDs)
  "gmail.com",
  "googlemail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  // Privacy-first providers
  "protonmail.com",
  "protonmail.ch",
  "proton.me",
  "pm.me",
  "tutanota.com",
  "tutanota.de",
  "tuta.io",
  "duck.com",
  "hey.com",
  // Generic webmail
  "aol.com",
  "aim.com",
  "mail.com",
  "email.com",
  "usa.com",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "gmx.at",
  "gmx.ch",
  "web.de",
  "t-online.de",
  "freenet.de",
  "fastmail.com",
  "fastmail.fm",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "ya.ru",
  "rediffmail.com",
  // Asia
  "qq.com",
  "foxmail.com",
  "163.com",
  "126.com",
  "sina.com",
  "sohu.com",
  "naver.com",
  "hanmail.net",
  "daum.net",
  // France
  "free.fr",
  "orange.fr",
  "wanadoo.fr",
  "laposte.net",
  "sfr.fr",
  "bbox.fr",
  "numericable.fr",
  // Italy / Brazil
  "libero.it",
  "virgilio.it",
  "alice.it",
  "tin.it",
  "terra.com.br",
  "uol.com.br",
  "bol.com.br",
  // ISP mailboxes (US)
  "comcast.net",
  "verizon.net",
  "att.net",
  "sbcglobal.net",
  "bellsouth.net",
  "cox.net",
  "charter.net",
  "earthlink.net",
  "juno.com",
  "netzero.net",
  "roadrunner.com",
  "optonline.net",
  // ISP mailboxes (UK / CA / AU)
  "btinternet.com",
  "sky.com",
  "virginmedia.com",
  "talktalk.net",
  "ntlworld.com",
  "shaw.ca",
  "sympatico.ca",
  "rogers.com",
  "telus.net",
  "bigpond.com",
  "optusnet.com.au",
  "iinet.net.au",
  // Disposable inboxes
  "mailinator.com",
  "guerrillamail.com",
  "sharklasers.com",
  "10minutemail.com",
  "yopmail.com",
  "temp-mail.org",
  "throwaway.email",
  "trashmail.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "mailnesia.com",
]);

/**
 * Providers whose country variants are too numerous to enumerate
 * (yahoo.fr, yahoo.co.uk, hotmail.com.br, live.co.jp, ...). Matched on the
 * LEADING label, but only when what follows looks like a public suffix — so
 * `live.acme.com` (a business subdomain) is not mistaken for `live.com`.
 */
const FREE_EMAIL_FAMILIES: readonly string[] = [
  "yahoo",
  "ymail",
  "rocketmail",
  "hotmail",
  "outlook",
  "live",
  "msn",
  "passport",
];

/**
 * Shaped like a public suffix: a single label (`com`, `fr`, `io`) or a
 * second-level registry under a ccTLD (`co.uk`, `com.br`, `ne.jp`).
 */
const PUBLIC_SUFFIX_LIKE = /^(?:[a-z]{2,6}|(?:co|com|net|org|ne|or|ac|edu|gov)\.[a-z]{2,3})$/;

/** True when the domain belongs to a free / personal / disposable email provider. */
export function isFreeEmailDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return false;
  if (FREE_EMAIL_DOMAINS.has(normalized)) return true;

  const firstDot = normalized.indexOf(".");
  if (firstDot < 1) return false;
  const label = normalized.slice(0, firstDot);
  if (!FREE_EMAIL_FAMILIES.includes(label)) return false;
  return PUBLIC_SUFFIX_LIKE.test(normalized.slice(firstDot + 1));
}
