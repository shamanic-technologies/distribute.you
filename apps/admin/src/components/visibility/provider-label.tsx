"use client";

import type { ReactNode } from "react";

interface ProviderModelDisplay {
  name: string;
  icon: ReactNode;
}

function GeminiIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1C7EFE" />
          <stop offset="50%" stopColor="#6A5DE0" />
          <stop offset="100%" stopColor="#F26C75" />
        </linearGradient>
      </defs>
      <path
        d="M12 2 C12 7 17 12 22 12 C17 12 12 17 12 22 C12 17 7 12 2 12 C7 12 12 7 12 2 Z"
        fill="url(#gemini-grad)"
      />
    </svg>
  );
}

function ClaudeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M5 4 L9 4 L14 12 L9 20 L5 20 L10 12 Z M11 4 L15 4 L20 12 L15 20 L11 20 L16 12 Z"
        fill="#D97757"
      />
    </svg>
  );
}

function OpenAIIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      fill="#10A37F"
    >
      <path d="M22.28 9.82a5.49 5.49 0 0 0-.47-4.51 5.55 5.55 0 0 0-5.98-2.66A5.53 5.53 0 0 0 11.66 0a5.55 5.55 0 0 0-5.29 3.83A5.55 5.55 0 0 0 2.69 6.5a5.54 5.54 0 0 0 .68 6.5 5.49 5.49 0 0 0 .47 4.51 5.55 5.55 0 0 0 5.98 2.66 5.53 5.53 0 0 0 4.18 1.86 5.55 5.55 0 0 0 5.3-3.83 5.55 5.55 0 0 0 3.67-2.67 5.54 5.54 0 0 0-.69-6.5Z" />
    </svg>
  );
}

function PerplexityIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      fill="#20808D"
    >
      <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z" />
    </svg>
  );
}

function GenericIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      fill="#9CA3AF"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

const PROVIDER_NAME_MAP: Record<string, string> = {
  google: "Google",
  anthropic: "Anthropic",
  openai: "OpenAI",
  perplexity: "Perplexity",
};

const MODEL_FAMILY_MAP: Record<string, string> = {
  "google/pro": "Gemini Pro",
  "google/flash": "Gemini Flash",
  "google/ultra": "Gemini Ultra",
  "anthropic/opus": "Claude Opus",
  "anthropic/sonnet": "Claude Sonnet",
  "anthropic/haiku": "Claude Haiku",
  "openai/gpt-5": "GPT-5",
  "openai/gpt-4o": "GPT-4o",
  "openai/gpt-4": "GPT-4",
  "perplexity/sonar": "Perplexity Sonar",
};

export function formatProviderModel(
  provider: string,
  model: string,
): ProviderModelDisplay {
  const key = `${provider}/${model}`;
  const mapped = MODEL_FAMILY_MAP[key];
  if (!mapped) {
    console.error(
      `[dashboard] Unmapped LLM provider/model "${key}" in formatProviderModel. ` +
        `Falling back to raw display. Add to MODEL_FAMILY_MAP.`,
    );
  }
  const name = mapped ?? `${PROVIDER_NAME_MAP[provider] ?? provider}/${model}`;
  let icon: ReactNode;
  switch (provider) {
    case "google":
      icon = <GeminiIcon />;
      break;
    case "anthropic":
      icon = <ClaudeIcon />;
      break;
    case "openai":
      icon = <OpenAIIcon />;
      break;
    case "perplexity":
      icon = <PerplexityIcon />;
      break;
    default:
      icon = <GenericIcon />;
  }
  return { name, icon };
}

export function ProviderModelBadge({
  provider,
  model,
  className = "",
}: {
  provider: string;
  model: string;
  className?: string;
}) {
  const { name, icon } = formatProviderModel(provider, model);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-gray-700 ${className}`}
      data-testid="provider-model-badge"
    >
      {icon}
      <span className="whitespace-nowrap">{name}</span>
    </span>
  );
}

export function formatProviderModelName(provider: string, model: string): string {
  return formatProviderModel(provider, model).name;
}
