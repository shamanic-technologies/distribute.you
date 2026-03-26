"use client";

import { useState } from "react";
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowsUpDownIcon,
} from "@heroicons/react/20/solid";

export interface FeatureInputDraft {
  key: string;
  label: string;
  description: string;
  placeholder?: string;
}

export interface FeatureOutputDraft {
  key: string;
  label: string;
  description?: string;
}

export interface FeatureDraft {
  name: string;
  description: string;
  inputs: FeatureInputDraft[];
  outputs: FeatureOutputDraft[];
}

const EMPTY_DRAFT: FeatureDraft = {
  name: "",
  description: "",
  inputs: [],
  outputs: [],
};

/* ─── Inline editable item ─────────────────────────────────────────── */

function EditableItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: { key: string; label: string; description?: string };
  onUpdate: (updated: { key: string; label: string; description?: string }) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(item.label);
  const [editKey, setEditKey] = useState(item.key);
  const [editDesc, setEditDesc] = useState(item.description ?? "");

  function save() {
    if (!editLabel.trim() || !editKey.trim()) return;
    onUpdate({ key: editKey.trim(), label: editLabel.trim(), description: editDesc.trim() || undefined });
    setEditing(false);
  }

  function cancel() {
    setEditLabel(item.label);
    setEditKey(item.key);
    setEditDesc(item.description ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-3 space-y-2 border border-gray-200 dark:border-white/[0.08]">
        <input
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          placeholder="Label"
          className="w-full text-sm rounded-md border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <input
          value={editKey}
          onChange={(e) => setEditKey(e.target.value)}
          placeholder="Key (e.g. company_name)"
          className="w-full text-xs font-mono rounded-md border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <input
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          placeholder="Description (optional)"
          className="w-full text-xs rounded-md border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
        <div className="flex gap-1.5 justify-end">
          <button type="button" onClick={cancel} className="p-1 text-gray-400 hover:text-gray-600 transition">
            <XMarkIcon className="w-4 h-4" />
          </button>
          <button type="button" onClick={save} className="p-1 text-brand-600 hover:text-brand-700 transition">
            <CheckIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
      <ArrowsUpDownIcon className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition cursor-grab" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.label}</span>
          <code className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded">
            {item.key}
          </code>
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
        )}
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
        <button type="button" onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-gray-600 transition">
          <PencilIcon className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500 transition">
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Add item form ────────────────────────────────────────────────── */

function AddItemForm({
  type,
  onAdd,
}: {
  type: "input" | "output";
  onAdd: (item: { key: string; label: string; description?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");

  function handleAdd() {
    if (!label.trim() || !key.trim()) return;
    onAdd({ key: key.trim(), label: label.trim(), description: description.trim() || undefined });
    setLabel("");
    setKey("");
    setDescription("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 transition px-3 py-1.5"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        Add {type}
      </button>
    );
  }

  return (
    <div className="mx-3 mb-2 bg-gray-50 dark:bg-white/[0.04] rounded-lg p-3 space-y-2 border border-gray-200 dark:border-white/[0.08]">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
        autoFocus
        className="w-full text-sm rounded-md border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      <input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Key (e.g. company_name)"
        className="w-full text-xs font-mono rounded-md border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full text-xs rounded-md border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      <div className="flex gap-1.5 justify-end">
        <button
          type="button"
          onClick={() => { setOpen(false); setLabel(""); setKey(""); setDescription(""); }}
          className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!label.trim() || !key.trim()}
          className="px-2.5 py-1 text-xs font-medium bg-brand-600 text-white rounded-md hover:bg-brand-700 transition disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}

/* ─── Section with items list ──────────────────────────────────────── */

function ItemsSection({
  title,
  type,
  items,
  onUpdate,
  onRemove,
  onAdd,
}: {
  title: string;
  type: "input" | "output";
  items: Array<{ key: string; label: string; description?: string }>;
  onUpdate: (index: number, item: { key: string; label: string; description?: string }) => void;
  onRemove: (index: number) => void;
  onAdd: (item: { key: string; label: string; description?: string }) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-3 mb-1">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title}
        </h3>
        <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic px-3 py-2">
          No {type}s defined yet. Use the chat to describe your feature, or add manually.
        </p>
      ) : (
        <div className="space-y-0.5">
          {items.map((item, i) => (
            <EditableItem
              key={`${item.key}-${i}`}
              item={item}
              onUpdate={(updated) => onUpdate(i, updated)}
              onRemove={() => onRemove(i)}
            />
          ))}
        </div>
      )}
      <AddItemForm type={type} onAdd={onAdd} />
    </div>
  );
}

/* ─── Main panel ───────────────────────────────────────────────────── */

interface FeatureBuilderPanelProps {
  draft: FeatureDraft;
  onDraftChange: (draft: FeatureDraft) => void;
}

export function FeatureBuilderPanel({ draft, onDraftChange }: FeatureBuilderPanelProps) {
  function updateField(field: keyof FeatureDraft, value: string) {
    onDraftChange({ ...draft, [field]: value });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[15px] font-bold text-gray-900 dark:text-gray-100">
              New Feature
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Define inputs and outputs for your feature
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Name & Description */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name</label>
            <input
              value={draft.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g. Sales Cold Emails"
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
            <textarea
              value={draft.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="What does this feature do?"
              rows={2}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-shadow resize-none"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-white/[0.04]" />

        {/* Inputs */}
        <ItemsSection
          title="Inputs"
          type="input"
          items={draft.inputs}
          onUpdate={(i, updated) => {
            const next = [...draft.inputs];
            next[i] = updated as FeatureInputDraft;
            onDraftChange({ ...draft, inputs: next });
          }}
          onRemove={(i) => {
            const next = draft.inputs.filter((_, idx) => idx !== i);
            onDraftChange({ ...draft, inputs: next });
          }}
          onAdd={(item) => {
            onDraftChange({ ...draft, inputs: [...draft.inputs, item as FeatureInputDraft] });
          }}
        />

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-white/[0.04]" />

        {/* Outputs */}
        <ItemsSection
          title="Outputs"
          type="output"
          items={draft.outputs}
          onUpdate={(i, updated) => {
            const next = [...draft.outputs];
            next[i] = updated as FeatureOutputDraft;
            onDraftChange({ ...draft, outputs: next });
          }}
          onRemove={(i) => {
            const next = draft.outputs.filter((_, idx) => idx !== i);
            onDraftChange({ ...draft, outputs: next });
          }}
          onAdd={(item) => {
            onDraftChange({ ...draft, outputs: [...draft.outputs, item as FeatureOutputDraft] });
          }}
        />
      </div>
    </div>
  );
}

export { EMPTY_DRAFT };
