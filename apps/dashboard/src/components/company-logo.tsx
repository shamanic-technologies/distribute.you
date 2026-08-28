// The company mark beside a lead, drawn from its domain.
//
// Its own module because two surfaces render it now — the leads table and the leads
// board — and a second copy is how one of them ends up with a monogram where the
// other has a real logo.

const LOGO_DEV_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

// `size` is a style rather than a Tailwind class because the class would have to be
// built from the prop, which the compiler cannot see (same reason `AudienceAvatar`
// does it this way). Requests twice the rendered size so it stays crisp on a retina
// screen. `shrink-0` matters wherever the sibling text truncates.
export function CompanyLogo({
  domain,
  name,
  size = 24,
}: {
  domain: string | null;
  name: string | null;
  size?: number;
}) {
  const box = { width: size, height: size };
  if (domain) {
    return (
      <img
        src={`https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}&size=${size * 2}`}
        alt=""
        style={box}
        className="shrink-0 rounded"
        loading="lazy"
      />
    );
  }
  return (
    <div
      style={{ ...box, fontSize: Math.max(11, Math.round(size * 0.4)) }}
      className="shrink-0 rounded bg-gray-200 flex items-center justify-center font-medium text-gray-500"
    >
      {name ? name.charAt(0).toUpperCase() : "?"}
    </div>
  );
}
