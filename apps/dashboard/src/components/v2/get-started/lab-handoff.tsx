"use client";

/**
 * Lab Distry only (ONBOARDING-CHANNEL-HANDOFF-1125, owner 2026-11-25): the user dashboard is
 * going away, so the walk hands the founder over to a channel where Distry keeps working
 * with them. Two screens, both worn only under the Distry skin (`?skin=distry`, the lab's
 * links carry it):
 * - the first choice: continue here on the web (the main button, least friction), or set up
 *   with Distry in chat;
 * - the last screen, after payment: pick where Distry works with you.
 *
 * No code to type anywhere (owner: « non code putain »): WhatsApp knows the sender by their
 * number, Telegram's link carries the account, the AI connects through the one MCP sign-up.
 * A channel is offered only once it works end to end (Telegram at the start and Email wait
 * for chat-service, DISTRY-CHANNEL-HANDOFF-1125).
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
import { TelegramLogoIcon } from "@phosphor-icons/react/dist/csr/TelegramLogo";
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { createOwnerTelegramLinkCode, getBillingAccount, getOwnerTelegram } from "@/lib/api";
import { DISTRIBUTE_MCP_URL } from "@/lib/v2/get-started";
import { distryWhatsAppHref, labAiPrompt } from "@/lib/v2/lab-handoff";

/** True when the walk wears the Distry skin (the lab). */
export const LabDistryContext = createContext(false);
export const useLabDistry = () => useContext(LabDistryContext);

/** Telegram's link answers within seconds of the tap; re-read until it says so. */
const TELEGRAM_POLL_MS = 3000;

type Tone = "--data-teal" | "--accent" | "--run";

function Mark({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
      style={{ background: `color-mix(in oklch, var(${tone}) 16%, transparent)`, color: `var(${tone})` }}
    >
      {children}
    </span>
  );
}

const CARD = "k-card flex flex-col sm:min-h-[132px] items-start gap-3 p-5 text-left";

/** The first choice on the lab: the web walk first, chat beside it. */
export function LabSetupChoice({ website, onWeb, onBack }: { website: string; onWeb: () => void; onBack: () => void }) {
  return (
    <div className="k-canvas relative flex min-h-[100dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-[560px]">
        <p className="k-label gs-in">distribute.you</p>
        <h1 className="gs-in k-fg mt-3 text-[28px] font-medium leading-9 tracking-[-0.01em]">How do you want to set up?</h1>
        <button
          type="button"
          onClick={() => {
            posthog.capture("get_started_setup_chosen", { mode: "web", lab: true });
            onWeb();
          }}
          className="gs-in k-btn-accent k-cta gs-glow mt-6 w-full justify-center"
          style={{ animationDelay: "60ms" }}
        >
          Continue here
        </button>
        <p className="gs-in k-label mt-6" style={{ animationDelay: "120ms" }}>
          Or with Distry, in chat
        </p>
        <div className="gs-in mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" style={{ animationDelay: "160ms" }}>
          <a
            href={distryWhatsAppHref(`Hi Distry! Set up distribute.you for ${website}.`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => posthog.capture("get_started_setup_chosen", { mode: "whatsapp", lab: true })}
            className={CARD}
          >
            <Mark tone="--run">
              <WhatsappLogoIcon weight="duotone" className="h-6 w-6" aria-hidden="true" />
            </Mark>
            <span className="k-fg text-[16px] font-medium">WhatsApp</span>
            <span className="k-fg2 text-[13px] leading-5">Distry sets it up with you in chat.</span>
          </a>
        </div>
        <div className="mt-4">
          <button type="button" onClick={onBack} className="k-btn-ghost text-[13px]">
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

/** The last screen on the lab, after payment: where Distry works with the founder from now on. */
export function ChannelHandoff({ website }: { website: string }) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [telegram, setTelegram] = useState<"idle" | "opening" | "waiting" | "linked">("idle");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<"whatsapp" | "telegram" | "ai" | null>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    getBillingAccount()
      .then((a) => {
        if (live.current) setOrgId(a.org_id);
      })
      .catch((e) => console.error("[lab-handoff] billing account read failed:", e));
    return () => {
      live.current = false;
    };
  }, []);

  // Telegram turns Connected on its own once the founder taps Start in the bot.
  useEffect(() => {
    if (telegram !== "waiting" || !orgId) return;
    const t = setInterval(() => {
      getOwnerTelegram(orgId)
        .then((s) => {
          if (s.reachable && live.current) {
            setTelegram("linked");
            posthog.capture("get_started_channel_linked", { channel: "telegram", lab: true });
          }
        })
        .catch((e) => console.error("[lab-handoff] telegram status read failed:", e));
    }, TELEGRAM_POLL_MS);
    return () => clearInterval(t);
  }, [telegram, orgId]);

  async function openTelegram() {
    if (!orgId) return;
    setError(null);
    setPicked("telegram");
    // The tab opens inside the click (a popup blocker lets it), then goes to the bot.
    const tab = window.open("", "_blank");
    setTelegram("opening");
    try {
      const link = await createOwnerTelegramLinkCode(orgId);
      if (tab) tab.location.href = link.linkUrl;
      else window.location.href = link.linkUrl;
      setTelegram("waiting");
      posthog.capture("get_started_channel_chosen", { channel: "telegram", lab: true });
    } catch (e) {
      tab?.close();
      console.error("[lab-handoff] telegram link failed:", e);
      setTelegram("idle");
      setError("We could not open Telegram just now. Try again.");
    }
  }

  async function copyAi() {
    setError(null);
    setPicked("ai");
    try {
      await navigator.clipboard.writeText(labAiPrompt(website, DISTRIBUTE_MCP_URL));
      setCopied(true);
      posthog.capture("get_started_channel_chosen", { channel: "ai", lab: true });
    } catch (e) {
      console.error("[lab-handoff] copy failed:", e);
      setError("Your browser blocked the copy. Try again.");
    }
  }

  return (
    <div className="k-canvas relative flex min-h-[100dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-[640px]">
        <p className="k-label gs-in">Your campaign is ready</p>
        <h1 className="gs-in k-fg mt-3 text-[28px] font-medium leading-9 tracking-[-0.01em]">Where should Distry work with you?</h1>
        <p className="gs-in k-fg2 mt-2 text-[14px] leading-5" style={{ animationDelay: "40ms" }}>
          Distry sends you your results there and answers you any time.
        </p>
        <div className="gs-in mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3" style={{ animationDelay: "80ms" }}>
          <a
            href={distryWhatsAppHref("Hi Distry!")}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              setPicked("whatsapp");
              posthog.capture("get_started_channel_chosen", { channel: "whatsapp", lab: true });
            }}
            className={`${CARD}${picked === "whatsapp" ? " k-card-on" : ""}`}
          >
            <Mark tone="--run">
              <WhatsappLogoIcon weight="duotone" className="h-6 w-6" aria-hidden="true" />
            </Mark>
            <span className="k-fg text-[16px] font-medium">WhatsApp</span>
            <span className="k-fg2 text-[13px] leading-5">{picked === "whatsapp" ? "Say hi in WhatsApp. Distry answers there." : "Say hi to Distry."}</span>
          </a>
          <button
            type="button"
            onClick={() => void openTelegram()}
            disabled={!orgId || telegram === "opening"}
            className={`${CARD}${picked === "telegram" ? " k-card-on" : ""}`}
          >
            <Mark tone="--accent">
              {telegram === "linked" ? (
                <CheckCircleIcon weight="duotone" className="h-6 w-6" aria-hidden="true" />
              ) : (
                <TelegramLogoIcon weight="duotone" className="h-6 w-6" aria-hidden="true" />
              )}
            </Mark>
            <span className="k-fg text-[16px] font-medium">Telegram</span>
            <span className="k-fg2 text-[13px] leading-5" aria-live="polite">
              {telegram === "linked"
                ? "Connected. Distry answers you there."
                : telegram === "waiting"
                  ? "Tap Start in Telegram."
                  : telegram === "opening"
                    ? "Opening Telegram..."
                    : "Tap Start in our bot."}
            </span>
          </button>
          <button type="button" onClick={() => void copyAi()} className={`${CARD}${picked === "ai" ? " k-card-on" : ""}`}>
            <Mark tone="--data-teal">
              <RobotIcon weight="duotone" className="h-6 w-6" aria-hidden="true" />
            </Mark>
            <span className="k-fg text-[16px] font-medium">Your AI</span>
            <span className="k-fg2 text-[13px] leading-5" aria-live="polite">
              {copied ? "Copied. Paste it in Claude or ChatGPT." : "Copy one line for Claude or ChatGPT."}
            </span>
          </button>
        </div>
        {error && (
          <p key={error} className="gs-in mt-3 text-[13px] text-[var(--data-rose)]" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
