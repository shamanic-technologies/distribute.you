import { legCatalogueFromWire } from "../../src/lib/legs";

/**
 * The step vocabulary as features-service serves it on `GET /public/channels` since
 * v0.179.231 (owner 2026-10-15): every step carries its singular `label` and its
 * `pluralLabel`. `lead_found` reads "Lead" / "Leads"; the key never changes.
 */
export const SERVED_STEPS = legCatalogueFromWire({
  steps: [
    { key: "lead_found", label: "Lead", pluralLabel: "Leads" },
    { key: "conversation", label: "Positive reply", pluralLabel: "Positive replies" },
    { key: "website_visit", label: "Website visit", pluralLabel: "Website visits" },
    { key: "booking_call", label: "Booking call", pluralLabel: "Booking calls" },
    { key: "meeting_booked", label: "Meeting booked", pluralLabel: "Meetings booked" },
    { key: "meeting_attended", label: "Meeting attended", pluralLabel: "Meetings attended" },
    { key: "signup", label: "Signup", pluralLabel: "Signups" },
    { key: "form_submitted", label: "Form submitted", pluralLabel: "Forms submitted" },
    { key: "paid_client", label: "Paid client", pluralLabel: "Paid clients" },
  ],
});
