import Foundation

struct APIError: LocalizedError {
    let message: String
    /// The producer's refusal `code` from the error body, when it states one.
    var code: String? = nil
    var status: Int = 0
    var errorDescription: String? { message }
}

/// The few calls the app itself makes (everything else is the web dashboard's own traffic).
struct DistributeAPI {
    let apiKey: String

    /// JSON in, JSON out. `orgId` names the organization the call acts on.
    func call(_ method: String, _ path: String, orgId: String? = nil, body: Data? = nil, timeout: TimeInterval = 30) async throws -> Data {
        var request = URLRequest(url: apiBaseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.timeoutInterval = timeout
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        if let orgId { request.setValue(orgId, forHTTPHeaderField: "x-org-id") }
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            let message = json?["message"] as? String ?? json?["error"] as? String ?? "HTTP \(status)"
            throw APIError(message: message, code: json?["code"] as? String, status: status)
        }
        return data
    }

    func json(_ method: String, _ path: String, orgId: String? = nil, body: [String: Any]? = nil, timeout: TimeInterval = 30) async throws -> [String: Any] {
        let payload = try body.map { try JSONSerialization.data(withJSONObject: $0) }
        let data = try await call(method, path, orgId: orgId, body: payload, timeout: timeout)
        guard let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            throw APIError(message: "\(method) \(path) answered something that is not a JSON object.")
        }
        return object
    }
}

/// Runs an organization's LLM calls on the user's own Claude Code (owner 2026-11-16: « le
/// user dépense $0, car tout depuis sa subscription Claude Code »). chat-service turns every
/// LLM call of an org that declared it into a work item; this takes the items
/// (`POST /v1/local-llm/work/claim`, long poll), runs each with `claude -p` exactly as its
/// `claude` field says, and sends the answer back (`.../work/{id}/result`). It is dumb on
/// purpose: every translation lives in chat-service.
final class LocalRunner: ObservableObject {
    struct Org: Identifiable, Equatable {
        let id: String
        let name: String
        var declared: Bool
    }

    /// Above this many organizations (staff reach every org) the menu lists only the ones
    /// that declared it: a switch per org of the whole fleet is not a menu.
    static let menuLimit = 25

    @Published private(set) var orgs: [Org] = []
    @Published private(set) var tooManyOrgs = false
    @Published private(set) var cliMissing = false
    @Published private(set) var problem: String?
    @Published private(set) var answered = 0
    @Published private(set) var busy = 0

    private var api: DistributeAPI?
    private var cli: ClaudeCLI.Located?
    private var refreshTask: Task<Void, Never>?
    private var loops: [String: Task<Void, Never>] = [:]

    var headline: String {
        if cliMissing { return "Claude Code not found on this Mac" }
        let on = orgs.filter { $0.declared }.count
        if on == 0 { return "AI runs on distribute (not on this Mac)" }
        if busy > 0 { return "Claude Code is answering (\(answered) done)" }
        return "AI runs on my Claude Code (\(answered) answered)"
    }

    // MARK: Lifecycle (main thread)

    func start(apiKey: String) {
        stop()
        let api = DistributeAPI(apiKey: apiKey)
        self.api = api
        refreshTask = Task { [weak self] in
            let located = await Task.detached { ClaudeCLI.locate() }.value
            await MainActor.run {
                self?.cli = located
                self?.cliMissing = located == nil
            }
            while !Task.isCancelled {
                await self?.refresh(api)
                try? await Task.sleep(nanoseconds: 30_000_000_000)
            }
        }
    }

    func stop() {
        refreshTask?.cancel()
        refreshTask = nil
        for task in loops.values { task.cancel() }
        loops = [:]
        api = nil
        orgs = []
        problem = nil
        ClaudeCLI.stopAll()
    }

    /// The menu's switch: declare (or stop) for one organization.
    func setDeclared(orgId: String, _ on: Bool) {
        guard let api else { return }
        Task { [weak self] in
            do {
                _ = try await api.json("PUT", "local-llm", orgId: orgId, body: ["enabled": on])
                await MainActor.run { self?.problem = nil }
                await self?.refresh(api)
            } catch {
                await MainActor.run { self?.problem = "Could not change it: \(error.localizedDescription)" }
            }
        }
    }

    // MARK: Which organizations to serve

    /// `GET /v1/local-llm/orgs` answers in ONE call which organizations the user is a member
    /// of have declared it, wherever the declaration was made (this menu, the dashboard, the
    /// MCP). Membership, not staff reach: a staff Mac never runs a customer's calls on the
    /// staff member's own subscription (the gateway decides, api-service LOCAL-CLAUDE-ORGS-1116).
    private func refresh(_ api: DistributeAPI) async {
        do {
            let declared = try await api.json("GET", "local-llm/orgs")
            let ids = (declared["orgs"] as? [[String: Any]] ?? []).compactMap { $0["orgId"] as? String }
            let me = try await api.json("GET", "me")
            let all = (me["organizations"] as? [[String: Any]] ?? []).compactMap { org -> (String, String)? in
                guard let id = org["id"] as? String else { return nil }
                return (id, org["name"] as? String ?? id)
            }
            let names = Dictionary(all, uniquingKeysWith: { first, _ in first })
            let many = all.count > Self.menuLimit
            var next = ids.map { Org(id: $0, name: names[$0] ?? $0, declared: true) }
            if !many {
                next += all.filter { !ids.contains($0.0) }.map { Org(id: $0.0, name: $0.1, declared: false) }
            }
            let found = next
            await MainActor.run {
                self.orgs = found
                self.tooManyOrgs = many
                self.syncLoops(api)
            }
        } catch {
            await MainActor.run { self.problem = "Could not read your organizations: \(error.localizedDescription)" }
        }
    }

    /// One claim loop per declaring organization. Main thread.
    private func syncLoops(_ api: DistributeAPI) {
        guard let cli else { return }
        let wanted = Set(orgs.filter { $0.declared }.map { $0.id })
        for (id, task) in loops where !wanted.contains(id) {
            task.cancel()
            loops[id] = nil
        }
        for id in wanted where loops[id] == nil {
            loops[id] = Task { [weak self] in await self?.work(orgId: id, api: api, cli: cli) }
        }
    }

    // MARK: The loop

    private func work(orgId: String, api: DistributeAPI, cli: ClaudeCLI.Located) async {
        while !Task.isCancelled {
            do {
                let claim: [String: Any] = [
                    "waitMs": 20_000,
                    "max": 1,
                    "runner": ["name": "distribute for Mac", "version": appVersion],
                ]
                // The server holds the request up to 20 s: give it room.
                let answer = try await api.json("POST", "local-llm/work/claim", orgId: orgId, body: claim, timeout: 40)
                let items = answer["items"] as? [[String: Any]] ?? []
                for item in items {
                    guard let id = item["id"] as? String,
                          let itemJSON = try? JSONSerialization.data(withJSONObject: item) else { continue }
                    await MainActor.run { self.busy += 1 }
                    let result = await Task.detached { ClaudeCLI.runItem(itemJSON, cli: cli) }.value
                    await MainActor.run { self.busy -= 1 }
                    await send(result, itemId: id, orgId: orgId, api: api)
                }
            } catch let error as APIError where error.code == "local_llm_not_declared" {
                // Turned off elsewhere: the next refresh drops this loop.
                await MainActor.run {
                    if let i = self.orgs.firstIndex(where: { $0.id == orgId }) { self.orgs[i].declared = false }
                    self.loops[orgId] = nil
                }
                return
            } catch is CancellationError {
                return
            } catch {
                if Task.isCancelled { return }
                await MainActor.run { self.problem = "Waiting for distribute: \(error.localizedDescription)" }
                try? await Task.sleep(nanoseconds: 5_000_000_000)
            }
        }
    }

    private func send(_ result: Data, itemId: String, orgId: String, api: DistributeAPI) async {
        let ok = ((try? JSONSerialization.jsonObject(with: result)) as? [String: Any])?["ok"] as? Bool ?? false
        let failure = ((try? JSONSerialization.jsonObject(with: result)) as? [String: Any])?["error"] as? String
        do {
            _ = try await api.call("POST", "local-llm/work/\(itemId)/result", orgId: orgId, body: result)
            await MainActor.run {
                if ok { self.answered += 1; self.problem = nil } else { self.problem = failure }
            }
        } catch let error as APIError where [404, 409, 410].contains(error.status) {
            // The caller stopped waiting, or another claim answered: nothing to do.
            NSLog("[desktop] local LLM answer for \(itemId) dropped: \(error.message)")
        } catch {
            NSLog("[desktop] local LLM answer for \(itemId) not delivered: \(error.localizedDescription)")
            await MainActor.run { self.problem = "An answer could not be sent: \(error.localizedDescription)" }
        }
    }
}
