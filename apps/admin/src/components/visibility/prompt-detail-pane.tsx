"use client";

import { useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { ProviderModelBadge } from "./provider-label";
import {
  DEBUG_FIELD_PLACEHOLDER,
  getPromptDebugFields,
  type DebugField,
  type PromptWithProvider,
} from "@/lib/visibility-detail";

interface PromptDetailPaneProps {
  prompt: PromptWithProvider | null;
  onClose: () => void;
}

export function PromptDetailPane({ prompt, onClose }: PromptDetailPaneProps) {
  useEffect(() => {
    if (!prompt) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prompt, onClose]);

  if (!prompt) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      data-testid="prompt-detail-pane"
    >
      <button
        type="button"
        aria-label="Close detail pane"
        className="flex-1 bg-black/30"
        onClick={onClose}
        data-testid="prompt-detail-overlay"
      />
      <aside className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <span className="font-semibold text-gray-700">
                Prompt #{prompt.promptIndex + 1}
              </span>
              <span>·</span>
              <ProviderModelBadge
                provider={prompt._provider}
                model={prompt._model}
              />
            </div>
            <p className="text-sm font-medium text-gray-900 break-words">
              {prompt.promptText}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1 -m-1"
            aria-label="Close"
            data-testid="prompt-detail-close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <MetricsGrid prompt={prompt} />

          {prompt.citationUrls && prompt.citationUrls.length > 0 && (
            <Section title="LLM citations">
              <ul className="space-y-1 text-xs">
                {prompt.citationUrls.map((url, i) => (
                  <li key={`${url}-${i}`}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:underline break-all"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="LLM answer">
            <div className="prose prose-sm max-w-none text-gray-800 prose-headings:font-semibold prose-a:text-brand-600 prose-pre:bg-gray-50 prose-code:text-gray-800">
              <Markdown remarkPlugins={[remarkGfm]}>
                {prompt.responseText || "_(empty response)_"}
              </Markdown>
            </div>
          </Section>

          <DebugSection
            title="Debug — exact LLM payloads"
            fields={getPromptDebugFields(prompt)}
          />
        </div>
      </aside>
    </div>
  );
}

export function DebugSection({
  title,
  fields,
}: {
  title: string;
  fields: DebugField[];
}) {
  return (
    <details className="border border-gray-200 rounded-lg bg-white">
      <summary className="cursor-pointer select-none px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700">
        {title}
      </summary>
      <div className="border-t border-gray-200 px-4 py-3 space-y-4">
        {fields.map((field) => (
          <div key={field.label}>
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
              {field.label}
            </p>
            {field.value === null ? (
              <p className="text-xs text-gray-400 italic">
                {DEBUG_FIELD_PLACEHOLDER}
              </p>
            ) : (
              <pre className="text-xs font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded p-3 overflow-x-auto whitespace-pre">
                {field.value}
              </pre>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function MetricsGrid({ prompt }: { prompt: PromptWithProvider }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Metric
        label="Brand mention"
        value={
          prompt.brandFound
            ? `Yes · count ${prompt.brandCount ?? "—"}`
            : "No"
        }
      />
      <Metric
        label="URL mention"
        value={
          prompt.urlFound
            ? `Yes · count ${prompt.urlCount ?? "—"}`
            : "No"
        }
      />
      <Metric
        label="Brand+URL co-occurrence"
        value={
          prompt.brandAndUrlCoOccurrence === null
            ? "—"
            : prompt.brandAndUrlCoOccurrence
              ? "Yes"
              : "No"
        }
      />
      <Metric
        label="Position"
        value={prompt.brandPosition !== null ? String(prompt.brandPosition) : "—"}
      />
      <Metric
        label="Sentiment"
        value={
          // No brand mention → no brand sentiment to show (backend defaults to "neutral"); render a dash.
          prompt.brandFound && prompt.sentiment
            ? prompt.sentimentScore !== null
              ? `${prompt.sentiment} (${prompt.sentimentScore})`
              : prompt.sentiment
            : "—"
        }
      />
      <Metric
        label="Max brands in response"
        value={prompt.maxBrandsInResponse !== null ? String(prompt.maxBrandsInResponse) : "—"}
      />
      <Metric
        label="Response length"
        value={
          prompt.responseLengthChars !== null
            ? `${prompt.responseLengthChars} chars`
            : "—"
        }
      />
      <Metric
        label="Latency"
        value={prompt.latencyMs !== null ? `${prompt.latencyMs} ms` : "—"}
      />
      <Metric
        label="Tokens (in / out)"
        value={
          prompt.tokensInput !== null && prompt.tokensOutput !== null
            ? `${prompt.tokensInput} / ${prompt.tokensOutput}`
            : "—"
        }
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
        {label}
      </p>
      <p className="text-sm font-medium text-gray-800 break-words">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}
