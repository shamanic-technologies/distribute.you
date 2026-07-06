// distribute's OWN per-brand conversion token + ingest URL — we dogfood our own
// conversion tracker (the same feature clients set up in Brand Settings) to
// report distribute's signups and a page-load liveness ping back to
// api.distribute.you. The token is a PUBLISHABLE write-key (it can only POST
// conversion events for distribute's one brand, never read), so it is safe to
// ship in the client bundle. Single source of truth — the signup reporter
// (`posthog-auth-tracker`) and the liveness ping (`conversion-ping`) both import
// it, so a rotation only has to change this one constant.
export const DISTRIBUTE_CONVERSION_TOKEN = "pk_conv_pxG5a-aAsFd5D5bEtxbvHNBQqA7p-m8y";
export const DISTRIBUTE_CONVERSION_INGEST_URL = "https://api.distribute.you/public/conversions";
