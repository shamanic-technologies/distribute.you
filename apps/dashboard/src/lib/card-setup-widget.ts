import RevolutCheckout from "@revolut/checkout";

/**
 * Mount the payment provider's card-saving widget.
 *
 * Uses the provider's official SDK package rather than its CDN build. The two
 * are not the same: the CDN script is a rolling build, while the package is
 * pinned and is what the documented option names are written against. The
 * backend also serves a `script_url` for the same SDK; we do not load it,
 * because loading a second copy of a payment SDK at a different version is a
 * worse outcome than ignoring a field. What that field IS good for is telling
 * us which environment the order was created in — see `environment` below.
 *
 * `savePaymentMethodFor: "merchant"` is the whole point. Without it the card is
 * stored for the customer's own future checkouts and cannot be charged when
 * they are away — which is exactly what automatic top-ups need. The backend
 * returns that value rather than this file assuming it.
 *
 * This SURFACE carries the option all the way to the provider, which was read
 * out of the DEPLOYED widget rather than out of the types. The npm package is
 * only a loader — the widget itself is a rolling build fetched from the
 * provider's CDN — so its `.d.ts` files describe a remote implementation and
 * cannot settle anything either way. The bundles can: `embed.js`'s
 * `payWithPopup` destructures `savePaymentMethodFor` and publishes it into the
 * card-popup iframe exactly as `createCardField` publishes into its own, and
 * `card-popup.js` receives it, threads it down, defaults it to `"customer"`
 * when absent and branches on `"merchant"`. So do NOT rewrite this onto
 * `createCardField` believing the popup cannot save — that claim is false.
 *
 * ⚠️ What is still open is one hop further out: whether the provider's BACKEND
 * then attaches the method to the customer. It accepted the same request
 * server-side on the order and silently did nothing with it, which is the bug
 * this path exists to route around, and accepting is not doing. Only a real
 * card appearing in the org's saved methods settles that.
 */

export interface CardWidgetOptions {
  token: string;
  /**
   * Which environment the order was created in. Passed through from the backend
   * rather than assumed: initialising the SDK against the wrong one fails on a
   * token that is perfectly valid, which reads as a broken card form.
   */
  environment: "prod" | "sandbox";
  savePaymentMethodFor: "merchant" | "customer";
  /** Prefilled so the provider does not have to ask for what we already know. */
  name?: string;
  email?: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

export async function openCardWidget(options: CardWidgetOptions): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Card setup needs a browser");
  }

  const instance = await RevolutCheckout(options.token, options.environment);
  instance.payWithPopup({
    savePaymentMethodFor: options.savePaymentMethodFor,
    ...(options.name ? { name: options.name } : {}),
    ...(options.email ? { email: options.email } : {}),
    onSuccess: options.onSuccess,
    onCancel: options.onCancel,
    // Surface what the provider actually said. A generic "could not save the
    // card" tells nobody anything, and this path has already failed twice in
    // production with the real reason discarded on the way out.
    onError: (error: unknown) => {
      const detail =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
      // eslint-disable-next-line no-console
      console.error("[card-setup] provider rejected the card:", error);
      options.onError(detail || "Could not save the card");
    },
  });
}
