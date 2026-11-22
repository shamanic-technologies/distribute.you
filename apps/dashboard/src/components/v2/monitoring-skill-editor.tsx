"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Mention from "@tiptap/extension-mention";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench";

/**
 * The text editor of Distry's Prompt and skills (owner 2026-11-22: « l'editor looks exactly like what
 * I see, although we use markdown »). You edit the formatted text itself: headings, lists, bold, and
 * each mention as a chip. The text is still STORED as markdown (Tiptap's Markdown extension reads and
 * writes it), and a mention is still the token chat-service reads: `@skill:<slug>` / `@tool:<name>`.
 * Typing `@` opens a menu of skills and tools; a click on a chip opens what it names.
 */

export type Mentionable = { kind: "skill" | "tool"; ref: string; label: string };

/** The chip node: written `@skill:<slug>` / `@tool:<name>` in markdown, drawn as a chip in the editor. */
function mentionNode(labelOf: (kind: string, ref: string) => string) {
  return Mention.extend({
    markdownTokenName: "distryMention",
    markdownTokenizer: {
      name: "distryMention",
      level: "inline",
      start: (src: string) => src.search(/@(skill|tool):/),
      tokenize: (src: string) => {
        const m = /^@(skill|tool):([A-Za-z0-9_-]+)/.exec(src);
        if (!m) return undefined;
        return { type: "distryMention", raw: m[0], kind: m[1], ref: m[2] };
      },
    },
    parseMarkdown: (token, helpers) => helpers.createNode("mention", { id: `${token.kind}:${token.ref}`, label: labelOf(token.kind, token.ref) }),
    renderMarkdown: (node) => `@${node.attrs?.id ?? ""}`,
  });
}

/**
 * The serializer escapes every literal underscore (`distribute\\_call\\_api`); inside a word an underscore
 * is never emphasis, so the stored text keeps it plain (Distry reads these names). Measured on the PROD
 * Prompt: the only difference a load-and-save made, besides blank lines.
 */
export function cleanMarkdown(md: string): string {
  return md.replace(/(\w)\\_(?=\w)/g, "$1_").replace(/(\w)\\_(?=\w)/g, "$1_");
}

type Menu = { items: Mentionable[]; index: number; rect: DOMRect | null; command: (m: Mentionable) => void };

export function MarkdownEditor({
  value,
  mentionables,
  onChange,
  onBlur,
  onOpenMention,
  ariaLabel,
}: {
  value: string;
  mentionables: Mentionable[];
  /** Every edit, as markdown (the caller debounces or saves on blur). */
  onChange?: (markdown: string) => void;
  onBlur?: (markdown: string) => void;
  onOpenMention: (kind: "skill" | "tool", ref: string) => void;
  ariaLabel: string;
}) {
  // The extensions are built once; what they read later lives in refs.
  const names = useRef(mentionables);
  names.current = mentionables;
  const [menu, setMenu] = useState<Menu | null>(null);
  const menuRef = useRef<Menu | null>(null);
  menuRef.current = menu;
  const handlers = useRef({ onChange, onBlur, onOpenMention });
  handlers.current = { onChange, onBlur, onOpenMention };
  const labelOf = (kind: string, ref: string) => names.current.find((n) => n.kind === kind && n.ref === ref)?.label ?? ref;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Markdown,
      mentionNode(labelOf).configure({
        HTMLAttributes: { class: "k-chip k-mention" },
        renderText: ({ node }) => `@${node.attrs.id}`,
        renderHTML: ({ options, node }) => {
          const kind = String(node.attrs.id ?? "").split(":")[0];
          return ["span", { ...options.HTMLAttributes, "data-mention": node.attrs.id, "data-kind": kind, title: kind === "tool" ? "Tool: click to open it" : "Skill: click to open it" }, String(node.attrs.label ?? node.attrs.id)];
        },
        suggestion: {
          char: "@",
          items: ({ query }: { query: string }) => {
            const q = query.toLowerCase();
            return names.current.filter((n) => n.label.toLowerCase().includes(q) || n.ref.toLowerCase().includes(q)).slice(0, 8);
          },
          command: ({ editor: ed, range, props }) => {
            const m = props as unknown as Mentionable;
            ed.commands.insertContentAt(range, [{ type: "mention", attrs: { id: `${m.kind}:${m.ref}`, label: m.label } }, { type: "text", text: " " }]);
            ed.commands.focus();
          },
          render: () => ({
            onStart: (p: SuggestionProps<Mentionable>) => setMenu({ items: p.items, index: 0, rect: p.clientRect?.() ?? null, command: (m) => p.command(m as never) }),
            onUpdate: (p: SuggestionProps<Mentionable>) => setMenu({ items: p.items, index: 0, rect: p.clientRect?.() ?? null, command: (m) => p.command(m as never) }),
            onKeyDown: ({ event }: SuggestionKeyDownProps) => {
              const cur = menuRef.current;
              if (!cur || cur.items.length === 0) return false;
              if (event.key === "ArrowDown") {
                setMenu({ ...cur, index: (cur.index + 1) % cur.items.length });
                return true;
              }
              if (event.key === "ArrowUp") {
                setMenu({ ...cur, index: (cur.index - 1 + cur.items.length) % cur.items.length });
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                cur.command(cur.items[cur.index]);
                return true;
              }
              if (event.key === "Escape") {
                // Close the menu only: the panel around it must not read this Escape as "close".
                event.stopPropagation();
                setMenu(null);
                return true;
              }
              return false;
            },
            onExit: () => setMenu(null),
          }),
        },
      }),
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: { class: "k-prose outline-none", "aria-label": ariaLabel },
      handleClickOn: (_view, _pos, node) => {
        if (node.type.name !== "mention") return false;
        const [kind, ...rest] = String(node.attrs.id ?? "").split(":");
        handlers.current.onOpenMention(kind as "skill" | "tool", rest.join(":"));
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => handlers.current.onChange?.(cleanMarkdown(ed.getMarkdown())),
    onBlur: ({ editor: ed }) => handlers.current.onBlur?.(cleanMarkdown(ed.getMarkdown())),
  });

  // A new served text (another skill opened, a version restored) replaces the content, never while typing.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if (cleanMarkdown(editor.getMarkdown()) !== value) editor.commands.setContent(value, { contentType: "markdown", emitUpdate: false });
  }, [editor, value]);

  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal")), []);

  return (
    <>
      <EditorContent editor={editor} className="min-h-full cursor-text" />
      {menu &&
        menu.items.length > 0 &&
        menu.rect &&
        host &&
        createPortal(
          <div role="listbox" aria-label="Mention a skill or a tool" className="k-popover fixed z-[95] max-h-64 w-[300px] overflow-y-auto p-1" style={{ top: menu.rect.bottom + 6, left: menu.rect.left }}>
            {menu.items.map((o, i) => (
              <div
                key={`${o.kind}:${o.ref}`}
                role="option"
                aria-selected={i === menu.index}
                onMouseDown={(e) => {
                  e.preventDefault();
                  menu.command(o);
                }}
                className={`flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[13px] ${i === menu.index ? "k-selected" : "k-row"}`}
              >
                {o.kind === "skill" ? <FileTextIcon size={14} weight="duotone" className="k-fg3" /> : <WrenchIcon size={14} weight="duotone" className="k-fg3" />}
                <span className={`truncate ${o.kind === "tool" ? "k-mono" : ""}`}>{o.label}</span>
                <span className="k-fg3 ml-auto text-[11px]">{o.kind === "skill" ? "Skill" : "Tool"}</span>
              </div>
            ))}
          </div>,
          host,
        )}
    </>
  );
}
