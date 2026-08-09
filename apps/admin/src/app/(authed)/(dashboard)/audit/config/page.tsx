"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/skeleton";
import {
  AGENT_CONFIG_PULL_COMMAND,
  AGENT_CONFIG_REPO,
  PRODUCT_CONFIG_PATH,
  configEntryLabel,
  type ConfigTreeGroup,
} from "@/lib/config-files";

/**
 * The Claude Code configuration console.
 *
 * What it edits lives in `shamanic-technologies/agent-config`, which the laptop
 * symlinks into `~/.claude` and `~/.agents/skills`. This console runs in a container
 * on the Hetzner box and cannot see that laptop, so it reads and writes the REPO
 * through GitHub. A save is a commit; the laptop sees it on its next pull, which is
 * why the pull command is printed rather than left implied.
 *
 * Three things are deliberately absent, and the page says so instead of pretending
 * otherwise: the MCP servers, the live `~/.claude/settings.json`, and the OAuth
 * credentials. All three exist only on the machine, in files no repository carries.
 *
 * Errors are rendered from the message the route returned, never from a thrown
 * `Error.message`, which would put a whole response body in front of a person.
 */

interface TreeResponse {
  agentConfigRepo: string;
  groups: ConfigTreeGroup[];
  repos: string[];
}

interface FileResponse {
  repo: string;
  path: string;
  content: string;
  sha: string;
  htmlUrl: string;
  editable: boolean;
  readOnlyReason: string | null;
}

interface Selection {
  repo: string;
  path: string;
}

/** Read the route's own sentence. A failed fetch has no body worth showing. */
async function readProblem(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? `The request failed with status ${res.status}.`;
}

/**
 * The single place this page turns a rejection into words. Everything that reaches it
 * was thrown by one of the fetchers above, so the message it carries is the sentence
 * `readProblem` lifted off the route. Routing all three error surfaces through one
 * helper is what keeps that true: a future fetcher that throws something else shows
 * the generic line rather than whatever it happened to be holding.
 */
function problemMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "The request did not go through.";
}

function CopyablePullCommand() {
  const [copied, setCopied] = useState(false);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p className="text-sm text-gray-800">
        Saving here commits to GitHub. Your machine picks the change up on its next pull.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded bg-white border border-blue-200 px-2 py-1 text-xs text-gray-800">
          {AGENT_CONFIG_PULL_COMMAND}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(AGENT_CONFIG_PULL_COMMAND).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/**
 * What this console cannot reach, stated rather than omitted. An absent section
 * reads as a gap someone forgot; a section explaining why it is absent is an answer.
 */
function MachineLocalCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-medium text-gray-900">Only on your machine</h3>
      <p className="mt-1 text-xs text-gray-500">
        These are not in any repository, so they cannot be read or edited from here.
      </p>
      <ul className="mt-3 space-y-2 text-xs text-gray-600">
        <li>
          <span className="font-medium text-gray-800">MCP servers</span> live in <code>~/.claude.json</code> alongside
          your project history. Inspect them with <code>claude mcp list</code>.
        </li>
        <li>
          <span className="font-medium text-gray-800">The live settings</span> are <code>~/.claude/settings.json</code>,
          which <code>install.sh</code> writes from the template in this repo.
        </li>
        <li>
          <span className="font-medium text-gray-800">OAuth credentials</span> sit in{" "}
          <code>~/.claude/.credentials.json</code> and are never going to be reachable from a browser.
        </li>
      </ul>
    </div>
  );
}

function TokenMissingCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-medium text-gray-900">No GitHub credential yet</h3>
      <p className="mt-1 text-sm text-gray-600">{message}</p>
      <p className="mt-3 text-xs text-gray-500">
        Create a fine grained personal access token with read and write access to repository contents, then put it on
        the box and restart the console:
      </p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-800">
        {`echo 'GITHUB_CONFIG_TOKEN=github_pat_...' >> /root/distribute/env/admin-app.env
cd /root/distribute && ./deploy-admin.sh`}
      </pre>
    </div>
  );
}

export default function ConfigAuditPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const tree = useQuery<TreeResponse>({
    queryKey: ["configTree"],
    queryFn: async () => {
      const res = await fetch("/api/admin/config/tree");
      if (!res.ok) throw new Error(await readProblem(res));
      return (await res.json()) as TreeResponse;
    },
    retry: false,
  });

  const file = useQuery<FileResponse>({
    queryKey: ["configFile", selection?.repo ?? "", selection?.path ?? ""],
    enabled: selection !== null,
    retry: false,
    queryFn: async () => {
      if (!selection) throw new Error("No file selected.");
      const params = new URLSearchParams({ repo: selection.repo, path: selection.path });
      const res = await fetch(`/api/admin/config/file?${params.toString()}`);
      if (!res.ok) throw new Error(await readProblem(res));
      return (await res.json()) as FileResponse;
    },
  });

  // The draft follows whatever the wire last returned. Keyed on the sha so a save
  // (which returns a new sha) rebases the draft on what actually landed, and a
  // reopened file never restores an edit the user walked away from.
  const loadedSha = file.data?.sha;
  useEffect(() => {
    if (file.data) setDraft(file.data.content);
  }, [loadedSha, file.data]);

  useEffect(() => {
    setSaveError(null);
    setSaved(false);
  }, [selection]);

  const dirty = file.data !== undefined && draft !== null && draft !== file.data.content;

  const save = useMutation({
    mutationFn: async () => {
      if (!selection || !file.data || draft === null) throw new Error("Nothing to save.");
      const res = await fetch("/api/admin/config/file", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repo: selection.repo,
          path: selection.path,
          content: draft,
          sha: file.data.sha,
        }),
      });
      if (!res.ok) throw new Error(await readProblem(res));
      return (await res.json()) as { commitSha: string; sha: string };
    },
    onSuccess: async () => {
      setSaveError(null);
      setSaved(true);
      // Re-read rather than patching the cached copy: the sha the next save needs is
      // whatever GitHub now holds, and asking is cheaper than being wrong about it.
      await queryClient.invalidateQueries({
        queryKey: ["configFile", selection?.repo ?? "", selection?.path ?? ""],
      });
    },
    onError: (err: unknown) => {
      setSaved(false);
      setSaveError(problemMessage(err));
    },
  });

  const treeProblem = tree.error ? problemMessage(tree.error) : null;
  const noToken = treeProblem?.includes("GITHUB_CONFIG_TOKEN") ?? false;

  const groups = useMemo(() => tree.data?.groups ?? [], [tree.data]);

  /**
   * ONE box narrowing BOTH lists, because the column holds the whole config: the
   * agent-config tree is around 90 entries on its own, and every repository in the
   * organisation adds a row under it. Scrolling for a file you can name is the wrong
   * way to reach it, and splitting the box in two would make you guess which half a
   * name lives in.
   *
   * Matched against the rendered LABEL as well as the path, so typing what is on
   * screen works: a skill renders as its directory, and a repository as its name
   * without the owner.
   */
  const needle = filter.trim().toLowerCase();

  const visibleGroups = useMemo(() => {
    if (!needle) return groups;
    return groups.flatMap((group) => {
      const entries = group.entries.filter(
        (entry) =>
          entry.path.toLowerCase().includes(needle) ||
          configEntryLabel(entry.path).toLowerCase().includes(needle),
      );
      return entries.length > 0 ? [{ ...group, entries }] : [];
    });
  }, [groups, needle]);

  const visibleRepos = useMemo(() => {
    const repos = tree.data?.repos ?? [];
    if (!needle) return repos;
    return repos.filter((repo) => repo.toLowerCase().includes(needle));
  }, [tree.data, needle]);

  const nothingMatches =
    needle.length > 0 && visibleGroups.length === 0 && visibleRepos.length === 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Claude Code configuration</h1>
        <p className="mt-1 text-sm text-gray-600">
          The global CLAUDE.md, the skills, the hooks and each repository&apos;s own CLAUDE.md, read straight from{" "}
          <code className="text-xs">{AGENT_CONFIG_REPO}</code> and its siblings.
        </p>
      </div>

      <CopyablePullCommand />

      {noToken && treeProblem ? <TokenMissingCard message={treeProblem} /> : null}

      {treeProblem && !noToken ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-800">{treeProblem}</p>
        </div>
      ) : null}

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-72 shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            {tree.isPending ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-5 w-full rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter files and repositories"
                  aria-label="Filter files and repositories"
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300"
                />

                {nothingMatches && (
                  <p className="px-2 py-1 text-xs text-gray-500">Nothing matches that.</p>
                )}

                {visibleGroups.map((group) => (
                  <div key={group.section}>
                    <h4 className="px-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      {group.label}
                    </h4>
                    {group.entries.map((entry) => {
                      const isActive =
                        selection?.repo === AGENT_CONFIG_REPO && selection?.path === entry.path;
                      return (
                        <button
                          key={entry.path}
                          type="button"
                          onClick={() => setSelection({ repo: AGENT_CONFIG_REPO, path: entry.path })}
                          className={`w-full truncate rounded-lg px-2 py-1 text-left text-xs ${
                            isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {configEntryLabel(entry.path)}
                          {!entry.editable && <span className="ml-1 text-[10px] text-gray-400">read only</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {visibleRepos.length > 0 && (
                  <div>
                    <h4 className="px-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Repository CLAUDE.md
                    </h4>
                    {visibleRepos.map((repo) => {
                      const isActive = selection?.repo === repo;
                      return (
                        <button
                          key={repo}
                          type="button"
                          onClick={() => setSelection({ repo, path: PRODUCT_CONFIG_PATH })}
                          className={`w-full truncate rounded-lg px-2 py-1 text-left text-xs ${
                            isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {repo.split("/")[1]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <MachineLocalCard />
        </div>

        <div className="min-w-0 flex-1">
          {!selection ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-500">Pick a file to read it.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-medium text-gray-900">{selection.path}</h2>
                  <p className="truncate text-xs text-gray-500">{selection.repo}</p>
                </div>
                {file.data?.htmlUrl && (
                  <a
                    href={file.data.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    Open on GitHub
                  </a>
                )}
              </div>

              {selection.repo !== AGENT_CONFIG_REPO && (
                <p className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-gray-700">
                  Saving here commits to this service&apos;s default branch, so the box rebuilds and redeploys it within
                  a few minutes.
                </p>
              )}

              {file.isPending ? (
                <Skeleton className="mt-4 h-96 w-full rounded" />
              ) : file.error ? (
                <p className="mt-4 text-sm text-gray-800">{problemMessage(file.error)}</p>
              ) : (
                <>
                  {file.data?.readOnlyReason && (
                    <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                      {file.data.readOnlyReason}
                    </p>
                  )}

                  <textarea
                    value={draft ?? ""}
                    readOnly={!file.data?.editable}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setSaved(false);
                    }}
                    spellCheck={false}
                    className={`mt-4 h-[60vh] w-full resize-y rounded-lg border border-gray-200 p-3 font-mono text-xs leading-relaxed text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                      file.data?.editable ? "bg-white" : "bg-gray-50"
                    }`}
                  />

                  {saveError && <p className="mt-3 text-xs text-red-600">{saveError}</p>}

                  {(dirty || saved) && (
                    <div className="mt-4 flex items-center justify-end gap-3">
                      {saved && !dirty && <span className="text-xs text-green-700">Committed</span>}
                      {dirty && (
                        <button
                          type="button"
                          disabled={save.isPending}
                          onClick={() => save.mutate()}
                          className={`rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                            save.isPending ? "cursor-wait" : "disabled:opacity-40"
                          }`}
                        >
                          {save.isPending ? "Committing..." : "Commit"}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
