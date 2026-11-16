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
        let text = String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        proc.waitUntilExit()
        var path = "", binary = ""
        for line in text.split(separator: "\n") {
            if line.hasPrefix("__P__") { path = String(line.dropFirst(5)) }
            if line.hasPrefix("__C__") { binary = String(line.dropFirst(5)) }
        }
        guard !binary.isEmpty, FileManager.default.isExecutableFile(atPath: binary) else { return nil }
        return Located(binary: binary, path: path)
    }

    // MARK: - One work item of the org's LLM (chat-service `LocalLlmWorkItem`)

    private static let lock = NSLock()
    private static var running: [Process] = []

    static func stopAll() {
        lock.lock()
        let procs = running
        lock.unlock()
        for p in procs where p.isRunning { p.terminate() }
    }

    /// An empty directory: with `--setting-sources project` the user's own CLAUDE.md, hooks
    /// and MCP servers do not steer the call. Only the work item does.
    private static func workDir() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let dir = base.appendingPathComponent("Distribute/local-llm", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// Runs one claimed item and returns the JSON body for `.../work/{id}/result`.
    /// Blocking: call it off the main thread. Data in, Data out (both JSON).
    static func runItem(_ itemJSON: Data, cli: Located) -> Data {
        let item = (try? JSONSerialization.jsonObject(with: itemJSON)) as? [String: Any] ?? [:]
        let spec = item["claude"] as? [String: Any] ?? [:]
        var body: [String: Any] = ["leaseId": item["leaseId"] as? String ?? ""]

        func fail(_ message: String) -> Data {
            body["ok"] = false
            body["error"] = String(message.prefix(3900))
            return (try? JSONSerialization.data(withJSONObject: body)) ?? Data()
        }

        guard let prompt = spec["prompt"] as? String, let model = spec["model"] as? String else {
            return fail("The work item has no prompt or no model.")
        }
        let systemPrompt = spec["systemPrompt"] as? String ?? ""
        let tools = spec["tools"] as? [String] ?? []
        let schema = spec["jsonSchema"] as? [String: Any]

        // The prompt goes on stdin: a long chat transcript does not fit an argument.
        var args = [
            "-p", "--output-format", "stream-json", "--verbose",
            "--setting-sources", "project", "--strict-mcp-config",
            "--model", model,
        ]
        if !systemPrompt.isEmpty { args += ["--system-prompt", systemPrompt] }
        if tools.isEmpty {
            args += ["--tools", ""]
        } else {
            args += ["--tools", tools.joined(separator: ","), "--allowedTools", tools.joined(separator: ",")]
        }
        if let schema {
            guard let data = try? JSONSerialization.data(withJSONObject: schema),
                  let text = String(data: data, encoding: .utf8) else {
                return fail("The work item's JSON schema could not be encoded.")
            }
            args += ["--json-schema", text]
        }

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: cli.binary)
        proc.arguments = args
        proc.currentDirectoryURL = workDir()
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = cli.path
        // The whole point is the user's SUBSCRIPTION: a key or another provider in the
        // environment would bill API usage instead.
        for name in ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL",
                     "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX"] {
            env.removeValue(forKey: name)
        }
        // The Mac shares its RAM with everything else the user runs: cap the CLI's heap.
        env["NODE_OPTIONS"] = [env["NODE_OPTIONS"], "--max-old-space-size=512"].compactMap { $0 }.joined(separator: " ")
        proc.environment = env

        let stdin = Pipe(), stdout = Pipe()
        let errURL = workDir().appendingPathComponent("stderr-\(UUID().uuidString).log")
        FileManager.default.createFile(atPath: errURL.path, contents: nil)
        let errHandle = FileHandle(forWritingAtPath: errURL.path)
        defer {
            try? errHandle?.close()
            try? FileManager.default.removeItem(at: errURL)
        }
        proc.standardInput = stdin
        proc.standardOutput = stdout
        proc.standardError = errHandle ?? FileHandle.nullDevice

        let started = Date()
        do { try proc.run() } catch {
            return fail("Claude Code could not start: \(error.localizedDescription)")
        }
        lock.lock(); running.append(proc); lock.unlock()
        defer {
            lock.lock(); running.removeAll { $0 === proc }; lock.unlock()
        }

        // After `answerBy` the caller has stopped waiting: stop spending the user's quota.
        let timedOut = Flag()
        if let answerBy = item["answerBy"] as? String, let deadline = parseDate(answerBy) {
            let wait = max(1, deadline.timeIntervalSinceNow)
            DispatchQueue.global().asyncAfter(deadline: .now() + wait) {
                if proc.isRunning { timedOut.on = true; proc.terminate() }
            }
        }

        DispatchQueue.global().async {
            stdin.fileHandleForWriting.write(Data(prompt.utf8))
            try? stdin.fileHandleForWriting.close()
        }

        var ranModel: String?
        var keySource: String?
        var result: [String: Any]?
        var buffer = Data()
        let reader = stdout.fileHandleForReading
        var refused = false
        while true {
            let chunk = reader.availableData
            if chunk.isEmpty { break }
            buffer.append(chunk)
            while let nl = buffer.firstIndex(of: 0x0A) {
                let line = buffer[buffer.startIndex..<nl]
                buffer.removeSubrange(buffer.startIndex...nl)
                guard let event = (try? JSONSerialization.jsonObject(with: line)) as? [String: Any] else { continue }
                let type = event["type"] as? String
                if type == "system", event["subtype"] as? String == "init" {
                    ranModel = event["model"] as? String
                    keySource = event["apiKeySource"] as? String
                    // The init line comes before any model call: stop here if this run
                    // would be billed to an API key.
                    if let keySource, keySource != "none" {
                        refused = true
                        proc.terminate()
                    }
                }
                if type == "result" { result = event }
            }
        }
        proc.waitUntilExit()

        if refused {
            return fail("Claude Code on this Mac is signed in with an API key (\(keySource ?? "unknown")), which is billed per use. Run `claude` in a terminal, type /login and choose your Claude subscription.")
        }
        if timedOut.on { return fail("Claude Code did not answer in time on this Mac.") }
        guard let result else {
            let stderr = (try? String(contentsOf: errURL, encoding: .utf8))?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return fail("Claude Code exited (\(proc.terminationStatus)) with no answer. \(stderr.isEmpty ? "Run `claude` once in a terminal to log in." : stderr)")
        }
        if result["is_error"] as? Bool == true {
            return fail("Claude Code reported: \(result["result"] as? String ?? result["subtype"] as? String ?? "an error")")
        }
        guard let ranModel else { return fail("Claude Code did not say which model ran.") }

        body["ok"] = true
        body["model"] = ranModel
        if schema != nil {
            guard let structured = result["structured_output"], !(structured is NSNull) else {
                return fail("Claude Code returned no structured answer for the requested schema.")
            }
            body["structured"] = structured
        } else {
            body["text"] = result["result"] as? String ?? ""
        }
        if let usage = result["usage"] as? [String: Any] {
            var out: [String: Any] = [:]
            if let v = usage["input_tokens"] as? Int { out["inputTokens"] = v }
            if let v = usage["output_tokens"] as? Int { out["outputTokens"] = v }
            if let v = usage["cache_read_input_tokens"] as? Int { out["cacheReadTokens"] = v }
            if let v = usage["cache_creation_input_tokens"] as? Int { out["cacheWriteTokens"] = v }
            body["usage"] = out
        }
        if let cost = result["total_cost_usd"] as? Double { body["notionalCostUsd"] = cost }
        body["durationMs"] = Int(Date().timeIntervalSince(started) * 1000)
        return (try? JSONSerialization.data(withJSONObject: body)) ?? Data()
    }

    /// A flag two threads share (the deadline timer and the reader).
    private final class Flag { var on = false }

    private static func parseDate(_ text: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: text) { return d }
        return ISO8601DateFormatter().date(from: text)
    }
}
