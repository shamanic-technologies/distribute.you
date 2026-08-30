import RevolutCheckout from "@revolut/checkout";

/**
 * Mount the payment provider's card-saving widget.
 *
 * Uses the provider's official SDK package rather than its CDN build. The two
 * are not the same: the CDN script is a rolling build, while the package is
 * pinned and is what the documented option names are written against.
 *
 * `savePaymentMethodFor: "merchant"` is the whole point. Without it the card is
 * stored for the customer's own future checkouts and cannot be charged when
 * they are away — which is exactly what automatic top-ups need. The backend
 * returns that value rather than this file assuming it.
 */

export interface CardWidgetOptions {
  token: string;
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

  const instance = await RevolutCheckout(options.token, "prod");
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
