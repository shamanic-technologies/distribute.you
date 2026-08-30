/**
 * Mount a payment provider's own card-saving widget.
 *
 * Some providers have no hosted page to redirect to: the only way to save a
 * card for future automatic charges is a widget this app mounts. The SDK is
 * loaded from the provider's CDN at click time rather than bundled, so the
 * dashboard carries no dependency for a path most orgs never take.
 *
 * `savePaymentMethodFor: "merchant"` is the whole point. Without it the card is
 * stored for the customer's own future checkouts and cannot be charged when
 * they are not on the page — which is exactly what automatic top-ups need. The
 * backend returns that value rather than this file assuming it.
 */

const SDK_URL = "https://merchant.revolut.com/embed.js";

declare global {
  interface Window {
    RevolutCheckout?: (token: string) => Promise<{
      payWithPopup: (options: Record<string, unknown>) => void;
    }>;
  }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Card setup needs a browser"));
  }
  if (window.RevolutCheckout) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Reset so a retry can try again rather than resolving a dead promise
      // forever — a blocked CDN is usually transient or an ad-blocker.
      sdkPromise = null;
      reject(new Error("Could not load the card form. Check for a blocker and retry."));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export interface CardWidgetOptions {
  token: string;
  savePaymentMethodFor: string;
  onSuccess: () => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

export async function openCardWidget(options: CardWidgetOptions): Promise<void> {
  await loadSdk();
  const factory = window.RevolutCheckout;
  if (!factory) {
    throw new Error("Could not load the card form. Check for a blocker and retry.");
  }
  const instance = await factory(options.token);
  instance.payWithPopup({
    savePaymentMethodFor: options.savePaymentMethodFor,
    onSuccess: options.onSuccess,
    onCancel: options.onCancel,
    onError: (err: unknown) =>
      options.onError(
        err instanceof Error ? err.message : "Could not save the card"
      ),
  });
}
