"use client";

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  locationLabel,
  locationPins,
  pinDistance,
  sameCountry,
  type LocationInput,
} from "@/lib/country-geo";
import { WORLD_MAP_PATH } from "@/lib/world-map-path";

/**
 * Two pins on a world map: where the lead is, in the brand's PRIMARY, and where
 * the company they work for is, in the brand's SECONDARY. The panel already STATES both as text, one row in the contact card and
 * one in the Organization card; this is the same two facts shown rather than
 * spelled, which is the whole reason it exists — a reader takes "United States"
 * and "France" off a map in one glance and off two text rows in two.
 *
 * REGION grain where the producer gave us a state or province, COUNTRY grain
 * where it did not — and the card STATES which of the two it used, so a dot never
 * implies a precision the data does not carry. City grain would need a coordinate
 * on the lead row itself; `locationPoint` explains why it is not done here.
 *
 * The map is an INLINE SVG and makes no network request of any kind. That is
 * not only about cost: a tile-server map would send every customer's lead
 * locations to a third party on every panel open, one request per pin, and would
 * render an unstyled light rectangle on the dark theme. At country grain the
 * tiles would carry no information the outline does not.
 */

/** How close two pins have to be before they read as one blob, in map units. */
const PIN_MERGE_DISTANCE = 14;

const PIN_RADIUS = 11;

interface LeadLocationMapProps {
  person: LocationInput | null | undefined;
  organization: LocationInput | null | undefined;
}

export function LeadLocationMap({ person, organization }: LeadLocationMapProps) {
  const pins = locationPins(person, organization);

  // No country we recognise on either side means there is nothing to draw. An
  // empty world map states that we know nothing about this lead's location,
  // which the two text rows above already say better.
  if (pins.length === 0) return null;

  const personPin = pins.find((p) => p.kind === "person") ?? null;
  const orgPin = pins.find((p) => p.kind === "organization") ?? null;

  // Two pins within a few units of each other draw as one circle rather than two
  // overlapping ones: at this grain Belgium and the Netherlands are close enough
  // that two dots read as a rendering fault. Merging is a DISPLAY choice — the
  // legend below still states both places separately.
  const merged =
    personPin && orgPin && pinDistance(personPin.at, orgPin.at) < PIN_MERGE_DISTANCE;

  const bothKnown = Boolean(personPin && orgPin);
  const differentCountries = bothKnown && !sameCountry(person, organization);

  const personLabel = personPin?.label || locationLabel(person);
  const orgLabel = orgPin?.label || locationLabel(organization);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Location</h3>

      <div className="rounded-md bg-gray-50 border border-gray-200 overflow-hidden">
        <svg
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          className="w-full h-auto block"
          role="img"
          aria-label={
            differentCountries
              ? `${personLabel} and ${orgLabel}`
              : personLabel || orgLabel || "Location"
          }
        >
          {/* The landmass. `fill-gray-300` carries its own `html.dark` rule, which
              is the point: an SVG fill attribute is reached by no utility remap, so
              a hardcoded hex would glare on one of the two themes, and the obvious
              `currentColor` off a remapped TEXT class lands on `--dy-muted` — a
              tone meant for readable type, which paints the continents as the
              loudest thing on the dark surface. Verified by reproduction. */}
          <path d={WORLD_MAP_PATH} className="fill-gray-300" />

          {merged && personPin ? (
            <Pin
              at={personPin.at}
              toneClassName="text-brand-600"
              title={[personLabel, orgLabel].filter(Boolean).join(" · ")}
            />
          ) : (
            <>
              {orgPin && (
                // The person wears the brand's PRIMARY, their employer the brand's
                // SECONDARY — one pair, one relationship. `tone-tile` is what makes
                // the purple rotate to the customer's own hue; without that ancestor
                // the class renders OUR purple on their dashboard.
                <Pin
                  at={orgPin.at}
                  toneClassName="tone-tile text-purple-600"
                  title={orgLabel}
                />
              )}
              {personPin && (
                <Pin at={personPin.at} toneClassName="text-brand-600" title={personLabel} />
              )}
            </>
          )}
        </svg>
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        {personPin && (
          <LegendRow
            dotClassName="bg-brand-600"
            term="Lead"
            detail={personLabel}
          />
        )}
        {orgPin && (
          <LegendRow
            /* Merged into one pin ⟹ the legend wears that pin's colour. A secondary
               dot beside a map holding only a primary pin is one card contradicting
               itself about which dot the reader is looking for. */
            dotClassName={merged ? "bg-brand-600" : "bg-purple-600"}
            rowClassName={merged ? undefined : "tone-tile"}
            /* "Organization", never the employer's own name: the row beside it
               reads "Lead", so naming one side and labelling the other makes the
               pair read as two different kinds of thing. The name is one card
               above, under that exact heading. */
            term="Organization"
            detail={orgLabel}
          />
        )}
      </dl>

      {differentCountries && (
        <p className="mt-3 text-xs text-gray-500">
          This lead is not in the same country as the company they work for.
        </p>
      )}
    </div>
  );
}

function Pin({
  at,
  toneClassName,
  title,
}: {
  at: { x: number; y: number };
  toneClassName: string;
  title: string;
}) {
  return (
    <g className={toneClassName}>
      {/* The map surface punched out from under the dot, so a pin over a light
          landmass and a pin over the ocean both read as one shape rather than
          dissolving into either. `fill-gray-50` matches the map container's own
          background and carries its own `html.dark` rule — an SVG fill is reached
          by no utility remap, so a hardcoded white would glare on the dark theme. */}
      <circle cx={at.x} cy={at.y} r={PIN_RADIUS + 4} className="fill-gray-50" />
      <circle cx={at.x} cy={at.y} r={PIN_RADIUS} fill="currentColor">
        <title>{title}</title>
      </circle>
    </g>
  );
}

function LegendRow({
  dotClassName,
  term,
  detail,
  rowClassName,
}: {
  dotClassName: string;
  term: string;
  detail: string;
  /* `tone-tile` rides the ROW, not the dot: the brand-hue rotation for
     `bg-purple-600` is a DESCENDANT selector, so a dot carrying both classes on
     one element keeps OUR secondary on a customer's own dashboard. */
  rowClassName?: string;
}) {
  return (
    <div className={`flex items-baseline gap-2 ${rowClassName ?? ""}`}>
      <span
        className={`${dotClassName} inline-block w-2.5 h-2.5 rounded-full shrink-0 translate-y-0.5`}
        aria-hidden
      />
      <dt className="text-gray-500 shrink-0">{term}:</dt>
      <dd className="font-medium text-gray-800 min-w-0 truncate" title={detail}>
        {detail || "-"}
      </dd>
    </div>
  );
}
