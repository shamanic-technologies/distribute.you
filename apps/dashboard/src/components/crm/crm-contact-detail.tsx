"use client";

import {
  contactPlace,
  contactTags,
  type CrmContact,
} from "@/lib/crm-view";
import { friendlyDateTime } from "@/lib/friendly-datetime";

/**
 * Everything their CRM holds about one person.
 *
 * This exists so a human can decide whether this contact and one of our leads
 * are the same person. With identity alone there is nothing to decide on, so
 * what is shown here is the company, where they are, and where the record came
 * from — read verbatim out of what crm-service serves.
 *
 * The three groups are the producer's own grouping and are kept in its order.
 * Nothing here maps their free text onto a vocabulary of ours: `type`,
 * `leadSource` and the tags are the customer's words and stay their words.
 */
export function CrmContactDetail({ contact }: { contact: CrmContact }) {
  const place = contactPlace(contact);
  const tags = contactTags(contact);

  return (
    <div className="grid gap-6 bg-gray-50 px-4 py-4 text-sm md:grid-cols-3">
      <Group title="Company">
        <Field label="Name" value={contact.company.name} />
        <Field label="Website" value={contact.company.website} href={contact.company.website} />
      </Group>

      <Group title="Where they are">
        <Field label="Place" value={place} />
        <Field label="Street" value={contact.location.streetAddress} />
        <Field label="Postal code" value={contact.location.postalCode} />
      </Group>

      <Group title="Where the record came from">
        <Field label="Type" value={contact.record.type} />
        <Field label="Lead source" value={contact.record.leadSource} />
        <Field label="Origin" value={contact.record.origin.medium} />
        <Field label="Origin page" value={contact.record.origin.url} href={contact.record.origin.url} />
        <Field label="Referrer" value={contact.record.origin.referrer} />
        <Field
          label="Added to their CRM"
          value={contact.record.createdAt ? friendlyDateTime(contact.record.createdAt) : null}
        />
        <Field
          label="Last changed there"
          value={contact.record.updatedAt ? friendlyDateTime(contact.record.updatedAt) : null}
        />
        {/* Their own tags. No tag at all reads as none rather than as a gap. */}
        <div className="mt-2">
          <div className="text-xs text-gray-500">Tags</div>
          {tags.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-0.5 text-gray-400">None</div>
          )}
        </div>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

/**
 * One value their CRM either holds or does not.
 *
 * An absent value says so in words. It is never blanked and never defaulted:
 * "their CRM does not hold this" and "we failed to read it" are different
 * statements, and only the first one is true here.
 */
function Field({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string | null;
}) {
  const v = (value ?? "").trim();
  const link = (href ?? "").trim();
  // Only http(s) is ever rendered as a link: any other scheme in an anchor is
  // somebody else's data deciding what a click does.
  const linkable = /^https?:\/\//i.test(link);

  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="truncate text-gray-800">
        {!v ? (
          <span className="text-gray-400">Not in their CRM</span>
        ) : linkable ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand-600 hover:underline"
          >
            {v}
          </a>
        ) : (
          v
        )}
      </dd>
    </div>
  );
}
