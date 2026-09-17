/**
 * The reader's own IANA timezone, for the reads that BUCKET BY DAY.
 *
 * `pipeline-activity` is a per-day series and features-service REQUIRES the zone the
 * days are cut in — it answers `400 {"error":"timezone query parameter is required"}`
 * without one, which is a 400 on every poll of the surface that forgot it. So this is
 * not an optional nicety a caller may leave out: it is part of the request.
 *
 * ONE home because there were already two identical copies of the `Intl` read (the
 * brand Overview and the campaign Overview) and the funnel Overview was about to be a
 * third — and a third copy is how one surface comes to bucket a customer's days in a
 * different zone from the surface beside it.
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` is absent on no browser we support
 * and can still be an empty string in an unusual runtime, so it falls back to `UTC`
 * rather than sending nothing: a stated zone the producer can bucket in beats a request
 * it has to refuse. That is a DEFAULT for a value the browser declined to state, not a
 * swallowed error — nothing here catches a failure of ours.
 *
 * Alias-free on purpose (no `@/…` import), so it carries real unit tests.
 */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
