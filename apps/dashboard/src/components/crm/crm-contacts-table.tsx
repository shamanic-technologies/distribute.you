"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  contactCompanyName,
  contactIdentity,
  filterContacts,
  type CrmContact,
} from "@/lib/crm-view";
import { CrmContactDetail } from "@/components/crm/crm-contact-detail";

/** Their own CRM leaves most fields null, so an absent one says so rather than blanking. */
function Cell({ value }: { value: string | null }) {
  const v = (value ?? "").trim();
  return v ? <>{v}</> : <span className="text-gray-300">—</span>;
}

/**
 * The client's contacts, read out of their own CRM.
 *
 * The search is LOCAL to the rows in hand and the count says so, so a reader is
 * never told a person does not exist when they are simply on another page.
 *
 * COMPANY IS A COLUMN, not a detail behind a click. Measured on the first
 * customer's 2,694 mirrored contacts: 455 carry a company name and 454 of those
 * carry NO email, so for that set the company is the only signal beyond a name —
 * it is what a reader scanning the list actually has to match on.
 *
 * Opening a row shows everything else their CRM holds, which is what makes it
 * possible to decide whether a contact and one of our leads are the same person.
 */
export function CrmContactsTable({ contacts }: { contacts: CrmContact[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = filterContacts(contacts, query);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search these contacts"
          className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-300/40"
        />
        <span className="text-xs text-gray-500">
          {query.trim()
            ? `${rows.length} of ${contacts.length} loaded contacts`
            : `${contacts.length} contacts`}
        </span>
      </div>

      {/* Dense table: it scrolls rather than crushing, and the columns that fold
          away below `md` are the ones a phone can do without. */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full table-fixed text-sm md:table-auto md:min-w-[820px]">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="w-[55%] px-4 py-2 font-medium md:w-auto">Name</th>
              <th className="hidden px-4 py-2 font-medium md:table-cell">Company</th>
              <th className="w-[45%] px-4 py-2 font-medium md:w-auto">Email</th>
              <th className="hidden px-4 py-2 font-medium md:table-cell">Phone</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const who = contactIdentity(c);
              const company = contactCompanyName(c);
              const open = openId === c.id;
              const toggle = () => setOpenId(open ? null : c.id);
              return (
                <ContactRow
                  key={c.id}
                  contact={c}
                  label={who.label}
                  showFoldedPhone={who.source !== "phone"}
                  company={company}
                  open={open}
                  onToggle={toggle}
                />
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                  {query.trim() ? "No contact here matches that." : "No contacts yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * One person, and — while it is open — everything their CRM holds about them.
 *
 * The row is the control: a person deciding whether this is the same human as
 * one of our leads reaches for the row, not for a separate button. Enter and
 * Space open it too, so the detail is not mouse-only.
 */
function ContactRow({
  contact,
  label,
  showFoldedPhone,
  company,
  open,
  onToggle,
}: {
  contact: CrmContact;
  label: string;
  showFoldedPhone: boolean;
  company: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
      >
        <td className="px-4 py-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {open ? (
              <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-400" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400" />
            )}
            <span className="min-w-0 truncate font-medium text-gray-900">{label}</span>
          </div>
          {/* Folded away above `md`, where each has its own column. The phone is
              suppressed when the phone is ALREADY what named this person, so one
              row never states one value twice. */}
          <div className="mt-0.5 truncate pl-[1.375rem] text-xs text-gray-500 md:hidden">
            {company ? <span>{company}</span> : null}
            {company && showFoldedPhone ? <span className="px-1">·</span> : null}
            {showFoldedPhone ? <Cell value={contact.phoneE164} /> : null}
          </div>
        </td>
        <td className="hidden truncate px-4 py-2 text-gray-700 md:table-cell">
          <Cell value={company} />
        </td>
        <td className="truncate px-4 py-2 text-gray-700">
          <Cell value={contact.primaryEmail} />
        </td>
        <td className="hidden px-4 py-2 text-gray-700 md:table-cell">
          <Cell value={contact.phoneE164} />
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-gray-100 last:border-0">
          <td colSpan={4} className="p-0">
            <CrmContactDetail contact={contact} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
