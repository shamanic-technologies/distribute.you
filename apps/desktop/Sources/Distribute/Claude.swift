import Foundation

/// Runs the user's OWN Claude Code CLI (their subscription, their login). The app never
/// sees or stores a Claude credential: it launches `claude -p` the way a terminal would.
enum ClaudeCLI {
    struct Located { let binary: String; let path: String }

    /// A Mac app inherits a bare PATH, while `claude` usually sits behind nvm/homebrew in
    /// the user's shell profile. Ask the user's own login shell once.
    static func locate() -> Located? {
        let shell = ProcessInfo.processInfo.environment["SHELL"] ?? "/bin/zsh"
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: shell)
        proc.arguments = ["-ilc", "printf '__P__%s\\n__C__%s\\n' \"$PATH\" \"$(command -v claude)\""]
        let out = Pipe()
        proc.standardOutput = out
        proc.standardError = FileHandle.nullDevice
        proc.standardInput = FileHandle.nullDevice
        do { try proc.run() } catch {
            NSLog("[desktop] could not start \(shell): \(error)")
            return nil
        }
        proc.waitUntilExit()
        let text = String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        var path = "", binary = ""
        for line in text.split(separator: "\n") {
            if line.hasPrefix("__P__") { path = String(line.dropFirst(5)) }
            if line.hasPrefix("__C__") { binary = String(line.dropFirst(5)) }
        }
        guard !binary.isEmpty, FileManager.default.isExecutableFile(atPath: binary) else { return nil }
        return Located(binary: binary, path: path)
    }
}

enum ChatItem: Identifiable {
    case user(id: UUID, text: String)
    case assistant(id: UUID, text: String)
    case tool(id: UUID, label: String)
    case error(id: UUID, text: String)

    var id: UUID {
        switch self {
        case .user(let id, _), .assistant(let id, _), .tool(let id, _), .error(let id, _): return id
        }
    }
}

/// One `claude -p` process per turn; `--resume` keeps the conversation.
final class ClaudeSession {
    private var process: Process?
    private var buffer = Data()
    private(set) var sessionId: String?

    var isRunning: Bool { process?.isRunning ?? false }

    func send(
        _ text: String,
        cli: ClaudeCLI.Located,
        context: SessionContext,
        onItem: @escaping (ChatItem) -> Void,
        onDelta: @escaping (String) -> Void,
        onText: @escaping (String) -> Void,
        onDone: @escaping () -> Void
    ) {
        let dir = Self.workDir()
        let mcpPath = dir.appendingPathComponent("mcp.json")
        let mcp: [String: Any] = ["mcpServers": ["distribute": [
            "type": "http",
            "url": "https://mcp.distribute.you/mcp",
            "headers": ["Authorization": "Bearer \(context.apiKey)"],
        ]]]
        do {
            try JSONSerialization.data(withJSONObject: mcp).write(to: mcpPath, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: mcpPath.path)
        } catch {
            onItem(.error(id: UUID(), text: "Could not write the MCP config: \(error.localizedDescription)"))
            onDone()
            return
        }

        var args = [
            "-p", text,
            "--output-format", "stream-json", "--verbose", "--include-partial-messages",
            "--strict-mcp-config", "--mcp-config", mcpPath.path,
            // The user's own ~/.claude (CLAUDE.md, hooks, plugins) must not steer the app's
            // operator: only the app's prompt does. The login lives outside settings, so it still works.
            "--setting-sources", "project",
            "--allowedTools", "mcp__distribute,Bash(curl:*),Bash(jq:*)",
            "--append-system-prompt", systemPrompt(context),
        ]
        if let sessionId { args += ["--resume", sessionId] }

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: cli.binary)
        proc.arguments = args
        proc.currentDirectoryURL = dir
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = cli.path
        env["DISTRIBUTE_API_KEY"] = context.apiKey
        env["DISTRIBUTE_ORG_ID"] = context.orgId
        env["DISTRIBUTE_BRAND_ID"] = context.brandId
        proc.environment = env

        let out = Pipe(), err = Pipe()
        proc.standardOutput = out
        proc.standardError = err
        proc.standardInput = FileHandle.nullDevice
        buffer = Data()
        var sawResult = false

        out.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let chunk = handle.availableData
            guard let self, !chunk.isEmpty else { return }
            DispatchQueue.main.async {
                self.buffer.append(chunk)
                while let nl = self.buffer.firstIndex(of: 0x0A) {
                    let line = self.buffer[self.buffer.startIndex..<nl]
                    self.buffer.removeSubrange(self.buffer.startIndex...nl)
                    if let event = try? JSONSerialization.jsonObject(with: line) as? [String: Any] {
                        if event["type"] as? String == "result" { sawResult = true }
                        self.handle(event, onItem: onItem, onDelta: onDelta, onText: onText)
                    }
                }
            }
        }
        proc.terminationHandler = { p in
            out.fileHandleForReading.readabilityHandler = nil
            let stderr = String(data: err.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            DispatchQueue.main.async {
                if p.terminationStatus != 0 && !sawResult && p.terminationReason != .uncaughtSignal {
                    let detail = stderr.trimmingCharacters(in: .whitespacesAndNewlines)
                    onItem(.error(id: UUID(), text: "Claude Code exited (\(p.terminationStatus)). \(detail.isEmpty ? "Run `claude` once in a terminal to log in." : detail)"))
                }
                onDone()
            }
        }
        do {
            try proc.run()
            process = proc
        } catch {
            onItem(.error(id: UUID(), text: "Could not start Claude Code: \(error.localizedDescription)"))
            onDone()
        }
    }

    func stop() { process?.terminate() }

    func reset() {
        stop()
        sessionId = nil
    }

    private func handle(_ event: [String: Any], onItem: (ChatItem) -> Void, onDelta: (String) -> Void, onText: (String) -> Void) {
        if let sid = event["session_id"] as? String { sessionId = sid }
        switch event["type"] as? String {
        case "stream_event":
            // Text as it is written (`--include-partial-messages`); the full message follows.
            if let ev = event["event"] as? [String: Any], ev["type"] as? String == "content_block_delta",
               let delta = ev["delta"] as? [String: Any], delta["type"] as? String == "text_delta",
               let t = delta["text"] as? String {
                onDelta(t)
            }
        case "assistant":
            let content = (event["message"] as? [String: Any])?["content"] as? [[String: Any]] ?? []
            for block in content {
                switch block["type"] as? String {
                case "text":
                    if let t = block["text"] as? String, !t.isEmpty { onText(t) }
                case "tool_use":
                    onItem(.tool(id: UUID(), label: Self.toolLabel(block)))
                default: break
                }
            }
        case "result":
            if (event["is_error"] as? Bool) == true {
                onItem(.error(id: UUID(), text: event["result"] as? String ?? "Claude Code reported an error."))
            }
        default: break
        }
    }

    private static func toolLabel(_ block: [String: Any]) -> String {
        let name = block["name"] as? String ?? "tool"
        let input = block["input"] as? [String: Any] ?? [:]
        if name == "Bash", let cmd = input["command"] as? String {
            let firstLine = cmd.split(separator: "\n").first.map(String.init) ?? cmd
            return "Ran: \(firstLine.replacingOccurrences(of: "$DISTRIBUTE_API_KEY", with: "•••").prefix(120))"
        }
        return "Used " + name.replacingOccurrences(of: "mcp__distribute__", with: "")
    }

    static func workDir() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Distribute", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
}

struct SessionContext {
    let apiKey: String
    let orgId: String
    let brandId: String
    let brandName: String
    let offerId: String?
    let offerName: String?
    /// The panel open beside the chat, so "this one" has a referent.
    let looking: String?
}

private func offerLine(_ c: SessionContext) -> String {
    guard let name = c.offerName, let id = c.offerId else { return "none yet" }
    return "\(name) (id \(id))"
}

/// Explains the GAME so the model adapts, rather than scripting replies per case.
private func systemPrompt(_ c: SessionContext) -> String {
    """
    You are the revenue operator inside the distribute.you desktop app. distribute.you is a cold email agency: \
    it finds leads, writes and sends cold emails from its own inboxes, and reports what each dollar bought. \
    The user's goal is more revenue for their brand "\(c.brandName)". Cold email is the only channel running today.

    Context for this conversation:
    - Brand id: \(c.brandId) (env DISTRIBUTE_BRAND_ID). Organization id: \(c.orgId) (env DISTRIBUTE_ORG_ID).
    - Selected offer: \(offerLine(c)). Every brand page reads this offer; send `offerId` on reads that take it.
    - The user is looking at: \(c.looking ?? "the chat only"). "This", "these", "here" refer to it.
    - The account is PREPAID: campaigns spend credits, the user tops up from the app sidebar. Never suggest a subscription.

    How to read: use the distribute MCP tools first (brands, campaigns, campaign stats, status, ICP suggestion).

    How to act: the MCP is read-only. To change something, call the distribute API with curl:
      curl -sS -X <METHOD> "https://api.distribute.you/v1/<path>?brandId=$DISTRIBUTE_BRAND_ID" \\
        -H "Authorization: Bearer $DISTRIBUTE_API_KEY" -H "x-org-id: $DISTRIBUTE_ORG_ID" -H "Content-Type: application/json" -d '<json>'
    Always reference the key as $DISTRIBUTE_API_KEY, never print it. Useful routes:
    - GET  /campaigns?brandId=...                       list campaigns
    - GET  /features/sales-cold-email-outreach/revenue?brandId=...&groupBy=campaignId&pricing=net   per-campaign results
    - GET  /campaigns/{id}/emails                       emails a campaign sent
    - PATCH /brands/{brandId}/pause  {"paused": true|false}           pause or resume all sending for the brand
    - PATCH /brands/{brandId}/campaigns/daily-budget {"dailyBudgetCents": <int>}   daily budget for every campaign
    - POST /campaigns/{id}/stop                          stop one campaign
    - GET  /billing/accounts/balance?orgId=...           prepaid credit left
    - PUT  /brands/{brandId}/sales-budget {"dailyBudgetCents": <int>}   the brand's daily budget (whole dollars x 100)
    - PATCH /brands/{brandId} {"name": "..."}                rename the brand
    - PUT  /brands/{brandId}/sales-rep {"salesRepEmail","salesRepPhone","salesRepFirstName","salesRepRole"}   who takes the call
    - PUT  /brands/{brandId}/offers/{offerId}/economics {"bookingUrl": "..."}   where interested people book a call
    - PUT  /brands/{brandId}/offers/{offerId}/user-fields {"fields": {"dreamOutcome": "...", ...}}   the offer's selling points
    - POST /orgs/audiences/split then /orgs/audiences/split/confirm   new audiences (an audience is never edited: make a new one, archive the old)
    - GET  /leads/{leadRowId}/history?brandId=...&scope=campaign   everything that happened with one person, with email bodies
    - GET  /offers/{offerId}/revenue?brandId=...&pricing=net&windowDays=all   pipeline, companies, sends/replies/spend since inception (never quote a 7 or 30 day window)
    - GET  /leads?brandId=...&offerId=...&view=basic&bucket=positive_reply&sort=activity   people by step
    - GET  /leads/standing-counts?brandId=...&offerId=...    deals board totals
    - GET  /orgs/audiences?brandId=...&offerId=...&status=active   targeting (audiences)
    The full reference is https://api.distribute.you/openapi.json if you need another route.

    Rules: never write without the user's approval. Before ANY write (pause, budget, stop, create, rename, audience), \
    end your message with ONE line exactly `ACTION: <what will change, in plain words>` and stop there: the app shows it \
    as a card with Approve and Cancel. Run the write only after the user approves, then say in one line what changed. \
    Answer short and plain, figures first. Say "positive reply", never "lead" for a reply. Never show open rates. \
    Never invent numbers: quote what the API returned.
    """
}
