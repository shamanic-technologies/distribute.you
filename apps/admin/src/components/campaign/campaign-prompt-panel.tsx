"use client";

import { useEffect, useState } from "react";
import {
  usePromptAssignment,
  useSavePromptAssignment,
} from "@/lib/use-prompt-assignment";
import {
  checkVariableIntegrity,
  variableIntegrityMessage,
} from "@/lib/prompt-template";

interface CampaignPromptPanelProps {
  open: boolean;
  onClose: () => void;
  featureSlug: string;
}

// Slide-over editor for the prompt the GENERATE button renders. Reads the
// resolved prompt for the feature, lets the operator edit it (fork-on-save),
// shows the prompt-type slug with a copy button, and blocks save if a template
// variable was dropped / renamed / added.
export function CampaignPromptPanel({
  open,
  onClose,
  featureSlug,
}: CampaignPromptPanelProps) {
  const { data, isPending, isError, error } = usePromptAssignment(
    featureSlug,
    open,
  );
  const saveMutation = useSavePromptAssignment(featureSlug);

  const [text, setText] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset the editor whenever a fresh assignment loads (or the panel reopens).
  useEffect(() => {
    if (data) setText(data.prompt);
  }, [data?.promptType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const declaredNames = data?.variables.map((v) => v.name) ?? [];
  const dirty = data ? text !== data.prompt : false;

  const handleCopy = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(data.promptType);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = () => {
    if (!data) return;
    setLocalError(null);
    const integrity = checkVariableIntegrity(text, declaredNames);
    if (!integrity.ok) {
      setLocalError(variableIntegrityMessage(integrity));
      return;
    }
    saveMutation.mutate({
      featureSlug,
      prompt: text,
      variables: data.variables,
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl z-50 flex flex-col animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-display font-semibold text-gray-800">
            Generation Prompt
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isPending ? (
            <div className="h-64 bg-gray-50 border border-gray-200 rounded-lg animate-pulse" />
          ) : isError ? (
            <p className="text-sm text-red-600">
              Couldn&apos;t load the prompt: {error.message}
            </p>
          ) : data ? (
            <>
              <p className="text-sm text-gray-500">
                This is the prompt used when you click <strong>Generate</strong>.
                Editing it creates your own version (a fork) that becomes the
                prompt for this feature going forward.
              </p>

              {/* Prompt-type slug + copy + default badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500">Template</span>
                <code className="text-xs bg-gray-100 border border-gray-200 rounded px-2 py-1 text-gray-700">
                  {data.promptType}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                  data-testid="copy-prompt-type"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                {data.isDefault && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    default
                  </span>
                )}
              </div>

              {/* Declared variables — these must stay in the text */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Required variables (keep all of them in the text)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {declaredNames.map((name) => (
                    <code
                      key={name}
                      className="text-xs bg-brand-50 border border-brand-100 text-brand-700 rounded px-1.5 py-0.5"
                    >{`{{${name}}}`}</code>
                  ))}
                </div>
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={20}
                className="w-full text-sm border border-gray-200 rounded-lg p-3 font-mono focus:outline-none focus:border-brand-400"
                data-testid="prompt-editor-textarea"
              />

              {(localError || saveMutation.isError) && (
                <p className="text-sm text-red-600" data-testid="prompt-save-error">
                  {localError ?? saveMutation.error?.message}
                </p>
              )}
              {saveMutation.isSuccess && !dirty && (
                <p className="text-sm text-green-700">
                  Saved as <code>{data.promptType}</code>.
                </p>
              )}
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!data || !dirty || saveMutation.isPending}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="prompt-save-btn"
          >
            {saveMutation.isPending ? "Saving…" : "Save (fork)"}
          </button>
        </div>
      </div>
    </>
  );
}
