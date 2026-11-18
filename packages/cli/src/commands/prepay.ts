import { type ParsedArgs, flagValue } from "../args.js";
import { request } from "../client.js";
import { type Context, requireKey } from "../context.js";
import { EXIT, type ExitCode, usageError } from "../errors.js";
import { printJson } from "../output.js";

const USAGE =
  "Usage: distribute prepay --amount <dollars> [--reload <dollars>]. Each amount must be at least the minimum billing states. Returns a payment url to open, or to give your human.";

/**
 * Every paid call on distribute.you is paid upfront, and the balance refills
 * itself: the reload amount is charged to the saved card each time the balance
 * runs out. --reload is optional (billing applies its default). The minimums
 * live in billing-service only: it refuses an amount below one with a 400 that
 * names it, printed here as-is. This only turns dollars into cents.
 */
export async function prepay(context: Context, args: ParsedArgs): Promise<ExitCode> {
  const amount = dollars(args, "amount");
  const reload = flagValue(args, "reload") === undefined ? undefined : dollars(args, "reload");
  const successUrl = flagValue(args, "success-url");
  const cancelUrl = flagValue(args, "cancel-url");

  const response = await request({
    method: "POST",
    path: "/v1/billing/accounts/prepaid_checkout",
    apiUrl: context.apiUrl,
    apiKey: requireKey(context),
    body: {
      topup_amount_cents: amount,
      ...(reload !== undefined ? { auto_topup_amount_cents: reload } : {}),
      ...(successUrl ? { success_url: successUrl } : {}),
      ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
    },
    timeoutMs: context.timeoutMs,
  });

  printJson(
    context.io,
    {
      ok: true,
      ...(response.body as Record<string, unknown>),
      next: "Open the url and pay by card (or give it to your human). Then check with: distribute prepay status",
    },
    context.compact,
  );
  return EXIT.ok;
}

export async function prepayStatus(context: Context): Promise<ExitCode> {
  const response = await request({
    method: "GET",
    path: "/v1/billing/accounts/prepaid_status",
    apiUrl: context.apiUrl,
    apiKey: requireKey(context),
    timeoutMs: context.timeoutMs,
  });
  printJson(context.io, response.body, context.compact);
  return EXIT.ok;
}

function dollars(args: ParsedArgs, flag: string): number {
  const raw = flagValue(args, flag);
  if (raw === undefined) throw usageError(`Missing --${flag}. ${USAGE}`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw usageError(`--${flag} expects an amount in dollars, received: ${raw}. ${USAGE}`);
  return Math.round(value * 100);
}
