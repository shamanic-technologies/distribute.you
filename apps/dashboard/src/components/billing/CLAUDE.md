# Billing, payment holds, rewards (dashboard)

## Card change: a debtor is never refused the page that replaces their card (#4092, #4195)
- stripe-service (v0.48.2) mints portal sessions on a pinned config: "Change card" opens `payment_method_update` (no remove control); "View invoices" config has card management OFF. Caller-supplied config refused; missing `STRIPE_PORTAL_*_CONFIGURATION_ID` env is a 5xx, never a fallback to the full portal.
- billing-service (v0.80.1) charges a negative balance to the card on file when the session is requested and hands the session over WHATEVER the charge does (no 402 on either card-setup route). No chargeable card + negative balance: spend stops, customer gets `credit-debt-card-required`, staff `unpaid_debt_uncollectable`, `GET /internal/unpaid-debts` lists it. api-service (#933) forwards billing's body field-for-field.
- **Do NOT gate the recovery surface on the failure it recovers from.** Refusing the session on a failed charge locked out exactly the person whose card is dead. Collect on the click, log loudly, let sweeps own collection. Cost 2026-09-17: two declined $29.84 clicks, each refused, zero way forward.
- Page copy: `Change card`; notice has TWO sentences (charged to the card on file on open, AND the card can be changed whether or not that goes through). `catch` renders its own line, never `err.message`. Guard `tests/billing.test.ts` pins the ABSENCE of the refusal path.
- Do NOT probe `POST /v1/portal-sessions` on a real negative-balance org: it CHARGES. Use the deployed `openapi.json` (no `outstanding_balance`, no 402) or stripe-service `/internal/card_setup/by-org/:orgId`.

## A charge behind a button must be CONFIRMED first, and show it is running
The click settles on the card (6.3 s measured) before the session is minted; silence made it a surprise charge. `CardChangeConfirmModal` + alias-free `lib/card-change-settle.ts` (`tests/card-change-settle.test.ts`):
- BOTH "Change card" and "View invoices" go through the gate (same endpoint, same settle).
- ONE derivation `cardChangeSettleCents(account)`, read by modal AND notice (guard pins call count 1).
- Stricter than `availableCents < 0`: billing skips settle for non-off_session cards (India/RBI) and deficits under the acquirer 50-cent minimum; do not promise a charge that cannot fire.
- Nothing owed: open the page DIRECTLY, no modal.
- Modal shows `Charging $91.50...`, both buttons disabled, keep-page-open line.
- Unreadable `balance_cents` is `null`, never `0`.
- **Read the side-effect outcome before redirecting**: billing states `settle_result` (`charged|declined|failed|not_attempted`) + `settle_decline_message`; `cardSessionSettleProblem` turns `declined`/`failed` into a modal and keeps the prepared card page one click away. Keep declined vs failed apart.
- Open: "View invoices" opens the card-update flow (stripe-service `POST /v1/billing_portal/sessions` without `flow_data` is not proxied by api-service). Nothing retries the debt on the NEW card.

## Campaign paused over PAYMENT says why; refused restart shows campaign-service's sentence
Owner rule 2026-09-27: no chargeable card (removed or never added) also stops the org. billing outlook `charge_blocked` / `no_chargeable_card`; campaign-service (v0.73.14) stops with `stopReason: "no_payment_method"` or `"payment_declined"` and 409s starts with `{error, reason, blockedReason}` (502 `billing_unavailable`). Nothing resumes on its own.
- `lib/payment-hold-reason.ts` (no imports) maps stop reasons to `PaymentHoldKind` (`declined | no_payment_method`); `lib/payment-declined.ts` (alias-free) is the ONE home: labels/notes/titles are `Record`s over the kind, `isPaymentDeclinedStop`, `scopePaymentHold` / `strongestPaymentHold` (declined wins), `scopeHeldByPayment` (fires only while NOTHING in scope runs), `campaignStartRefusalMessage` (keyed on status + machine `reason`, returns producer `error` verbatim). `ControlRow.paymentHold` replaces the old boolean.
- Surfaces: Campaigns table pill (`stopReason`), controls trigger/modal rows, Campaign Settings heading; v2: `Mission.paymentHold`, `StateDot hold=`, `ScopePaymentDeclinedBand` in `V2Shell` off `["campaigns", brandId]` linking the v2 Billing twin. Label `Paused: payment declined` (amber). Guard `tests/payment-declined.test.ts`.

## A REFUSED charge is on the wire already (`lib/payment-failure.ts`, `PaymentFailedBanner` at top of `/billing`)
- `last_payment_error` was always served (stripe-service mirrors the PaymentIntent, api-service `/v1/billing/payments` is a passthrough); `PaymentIntentSchema` just did not declare it. "Producer does not serve X" is a claim about a payload: verify against one.
- Two gates hid it: the Payments card filters to `succeeded`, and "Top Up Credits" renders only while auto-topup is OFF. Banner reads the UNFILTERED list and carries its own Retry.
- A SUCCEEDED payment is never a failure even with an error (earlier attempt); an intent with NO error object is not one (abandoned checkout). Measure against the newest SUCCEEDED payment.
- Reason = Stripe's `message` verbatim, no decline-code map. "Campaigns are stopped" is gated on `availableCreditCents(account) <= 0`, not on the decline.
- Retry opens the hard-402 modal (`showPaymentRequired`, `depleted` when out); do NOT pass the refused amount as `required_cents`.
- Billing page only. Guard `tests/payment-failure.test.ts`.

## Free-credit promise (`V2ReferralPage` in `components/v2/setup-pages.tsx`)
- Confirmation is a TOAST (`components/toast.tsx`, `role="status"`, centred bottom: the support FAB owns bottom-right).
- Heading = billing's served `outstanding_total_cents` (`.optional()`, absent is not zero); never sum rows here. Bar + line describe the NEAREST promise only (billing orders cheapest-bar-first).
- Line from `promiseUnlockLine` (`lib/free-credit-promise-view`): `Unlock $347 free credits after $376 more in payments.`; a referral row (referrer only, earned on the REFERRED org's payments) reads `Get $500 free credits once Acme has paid $300 more.` Promises WHOLE dollars (`formatBillingCentsWhole`), charges keep cents; remaining bar CEILED; no measured progress => no bar. Key `["freeCreditPromises"]` is Billing's; link reads org from the URL, never `useParams`. Guards `tests/referral-invite-wiring.test.ts`, `tests/free-credit-promise-view.test.ts`.

## Billing / top-up UX lives in TWO surfaces only
- `components/v2/billing-page.tsx` (Add Credits one-time charge + auto-topup config) and `lib/billing-guard.tsx` (`showPaymentRequired` at campaign launch: the ONLY place card + auto-topup get set up). Onboarding asks NO card (a `$10` threshold over a `$2` welcome credit fired an instant $50 charge, #1528). Recurring launch => auto-topup MANDATORY (#1536). Identify the surface first when a top-up symptom is reported.
- "Available credit" for runway warnings = `balance_cents` (credited - confirmed - provisioned), NEVER `actual_balance_cents` (ignores holds) or `credited_cents`.
- Hosted top-up coupon = Stripe `allow_promotion_codes` set in billing-service (hosted payment-mode only); no dashboard change. Credit = what Stripe RECEIVED, so a 100%-off code lands $0 credit by design; comp via `POST /v1/credits/grant`.
- **Revolut saves a card ONLY through its in-page widget**; its hosted page takes the money and keeps nothing (2026-10-01: a $135 top-up left an org cardless, auto top-up never armed, "reload failed" mails looped). Any money/card path asks the embedded variant first (`createEmbeddedCheckoutSession`, `card_setup`) and keeps hosted for Stripe only. Moving an org Stripe → Revolut by hand: DELETE its auto top-up first, then stripe-service `DELETE /internal/payment_methods/by-org/:id` + `PUT /internal/acquirer/by-org/:id {acquirer:"revolut"}`.
