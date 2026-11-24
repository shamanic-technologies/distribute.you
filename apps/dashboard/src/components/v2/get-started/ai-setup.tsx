"use client";

/**
 * « With my AI » on /get-started (AI-SETUP-STUCK-1124). The visitor names their AI
 * first, then reads only the steps that AI can follow:
 *  - a terminal agent (Claude Code, Codex, Cursor) gets the REST message it runs;
 *  - a chat app (ChatGPT, Claude) first adds our MCP server as a connector, then
 *    pastes a short message that uses only the connector's tools (no POST, no file);
 *  - a phone or tablet is told this runs from a computer, and is offered the walk.
 */

import { useEffect, useState } from "react";
import { TerminalWindowIcon } from "@phosphor-icons/react/dist/csr/TerminalWindow";
import { ChatCircleDotsIcon } from "@phosphor-icons/react/dist/csr/ChatCircleDots";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { DeviceMobileIcon } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import {
  AI_APPS,
  CONNECTOR_STEPS,
  DISTRIBUTE_MCP_URL,
  TOUCH_ONLY_QUERY,
  type AiApp,
} from "@/lib/v2/get-started";

const APP_MARKS: Record<AiApp, { Icon: typeof TerminalWindowIcon; tone: string }> = {
  terminal: { Icon: TerminalWindowIcon, tone: "var(--data-teal)" },
  chatgpt: { Icon: ChatCircleDotsIcon, tone: "var(--data-amber)" },
  claude: { Icon: SparkleIcon, tone: "var(--accent)" },
};

/** True on a phone or tablet (no hover, coarse pointer); false until mounted. */
export function useTouchOnly(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(TOUCH_ONLY_QUERY);
    setTouch(mq.matches);
    const on = () => setTouch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return touch;
}

export function aiSetupTitle(app: AiApp | null, touchOnly: boolean, forced: boolean): string {
  if (touchOnly && !forced) return "Your AI sets this up from a computer.";
  if (app === null) return "Which AI do you use?";
  if (app === "terminal") return "Paste this into your AI.";
  return `Add distribute.you to ${app === "chatgpt" ? "ChatGPT" : "Claude"}.`;
}

/** A copy button that says what it copied for a few seconds. */
function CopyButton({ text, label, done, onCopied, big }: { text: string; label: string; done: string; onCopied: () => void; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied();
    } catch (e) {
      console.error("[get-started] copy failed:", e);
    }
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={big ? "k-btn-accent k-cta mt-4 flex w-full items-center justify-center" : "k-btn shrink-0"}
    >
      {copied ? done : label}
    </button>
  );
}

export function AiSetup({
  app,
  touchOnly,
  forced,
  terminalPrompt,
  chatPrompt,
  onPick,
  onForce,
  onCopied,
  onManual,
}: {
  app: AiApp | null;
  touchOnly: boolean;
  /** A phone visitor asked to see the AI steps anyway. */
  forced: boolean;
  terminalPrompt: string;
  chatPrompt: string;
  onPick: (app: AiApp) => void;
  onForce: () => void;
  onCopied: (app: AiApp, what: "prompt" | "connector_url") => void;
  onManual: () => void;
}) {
  if (touchOnly && !forced) {
    return (
      <div className="gs-in mt-6" style={{ animationDelay: "60ms" }}>
        <div className="k-card flex items-start gap-3 p-5">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: "color-mix(in oklch, var(--data-amber) 16%, transparent)", color: "var(--data-amber)" }}
          >
            <DeviceMobileIcon weight="duotone" className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="k-fg2 text-[14px] leading-6">
            No AI app can add our tools from a phone. Set up here in a few taps, or come back from a computer.
          </p>
        </div>
        <button type="button" onClick={onManual} className="k-btn-accent k-cta mt-4 flex w-full items-center justify-center">
          Set up here, step by step
        </button>
        <button type="button" onClick={onForce} className="k-btn-ghost -ml-2 mt-3 h-7 text-[12px]">
          I am on a computer
        </button>
      </div>
    );
  }

  if (app === null) {
    return (
      <div className="gs-in mt-6 grid grid-cols-1 gap-3" style={{ animationDelay: "60ms" }}>
        {AI_APPS.map((a, i) => {
          const { Icon, tone } = APP_MARKS[a.key];
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => onPick(a.key)}
              className="k-card gs-in flex items-center gap-3 p-4 text-left"
              style={{ animationDelay: `${90 + i * 50}ms` }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]"
                style={{ background: `color-mix(in oklch, ${tone} 16%, transparent)`, color: tone }}
              >
                <Icon weight="duotone" className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="k-fg text-[15px] font-medium">{a.name}</span>
                <span className="k-fg3 text-[12px] leading-5">{a.hint}</span>
              </span>
              <span className="k-fg3 ml-auto" aria-hidden="true">
                →
              </span>
            </button>
          );
        })}
        <button type="button" onClick={onManual} className="k-btn-ghost -ml-2 mt-1 h-7 justify-self-start text-[12px]">
          Set up myself instead
        </button>
      </div>
    );
  }

  if (app === "terminal") {
    return (
      <div className="gs-in mt-6" style={{ animationDelay: "60ms" }}>
        <pre className="k-inset k-fg2 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[12px] p-4 text-[13px] leading-5">{terminalPrompt}</pre>
        <CopyButton big text={terminalPrompt} label="Copy instructions" done="Copied. Paste it into your AI." onCopied={() => onCopied("terminal", "prompt")} />
        <button type="button" onClick={onManual} className="k-btn-ghost -ml-2 mt-3 h-7 text-[12px]">
          Set up myself instead
        </button>
      </div>
    );
  }

  const guide = CONNECTOR_STEPS[app];
  return (
    <div className="gs-in mt-6" style={{ animationDelay: "60ms" }}>
      <p className="k-label">Step 1 · Add our tools</p>
      <ol className="k-card mt-2 flex flex-col gap-2.5 p-4">
        {guide.steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-[13px] leading-5">
            <span className="k-fg3 k-mono w-4 shrink-0 tabular-nums">{i + 1}</span>
            <span className="k-fg2">{s}</span>
          </li>
        ))}
        <li className="k-inset mt-1 flex items-center gap-2 rounded-[10px] p-2 pl-3">
          <code className="k-fg k-mono min-w-0 flex-1 truncate text-[12px]">{DISTRIBUTE_MCP_URL}</code>
          <CopyButton text={DISTRIBUTE_MCP_URL} label="Copy URL" done="Copied" onCopied={() => onCopied(app, "connector_url")} />
        </li>
      </ol>
      <p className="k-fg3 mt-2 text-[12px] leading-5">{guide.plans}</p>
      <p className="k-label mt-6">Step 2 · Paste this in a new chat</p>
      <pre className="k-inset k-fg2 mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap rounded-[12px] p-4 text-[13px] leading-5">{chatPrompt}</pre>
      <CopyButton big text={chatPrompt} label="Copy message" done="Copied. Paste it into your AI." onCopied={() => onCopied(app, "prompt")} />
      <button type="button" onClick={onManual} className="k-btn-ghost -ml-2 mt-3 h-7 text-[12px]">
        Set up myself instead
      </button>
    </div>
  );
}
