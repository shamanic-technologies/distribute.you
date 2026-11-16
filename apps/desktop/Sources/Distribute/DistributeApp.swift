import SwiftUI

let apiBaseURL = URL(string: "https://api.distribute.you/v1")!
let dashboardURL = URL(string: "https://dashboard.distribute.you")!
let appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "dev"

/// distribute for Mac = the web dashboard, strictly (owner 2026-11-16), plus ONE thing the
/// web cannot do: run the org's LLM calls on the user's own Claude Code (`LocalRunner`).
@main
struct DistributeApp: App {
    @NSApplicationDelegateAdaptor private var delegate: AppDelegate
    @StateObject private var session = Session.shared

    init() {
        // Logos and avatars are tiny: keep a small RAM cache, the rest on disk.
        URLCache.shared = URLCache(memoryCapacity: 8 << 20, diskCapacity: 64 << 20)
    }

    var body: some Scene {
        Window("distribute", id: "main") {
            WebShell(session: session)
                .frame(minWidth: 1080, minHeight: 640)
        }
        // The runner keeps working with the window closed: its state lives in the menu bar.
        MenuBarExtra("distribute", systemImage: "paperplane") {
            RunnerMenu(session: session, runner: session.runner)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    /// Closing the window must not stop the org's LLM calls.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    /// A `claude` call still running when the app quits must not outlive it.
    func applicationWillTerminate(_ notification: Notification) {
        ClaudeCLI.stopAll()
    }
}

/// The signed-in user: one distribute key in the Keychain, and the runner it feeds.
/// Touched from the main thread only (the views and the web view delegate).
final class Session: ObservableObject {
    static let shared = Session()

    @Published private(set) var apiKey: String?
    /// Bumped to make the web view start over (after sign-out).
    @Published var reloadTick = 0
    let runner = LocalRunner()

    private init() {
        apiKey = Keychain.read()
        if let apiKey { runner.start(apiKey: apiKey) }
    }

    func setKey(_ key: String) {
        Keychain.save(key)
        apiKey = key
        runner.start(apiKey: key)
    }

    func signOut() {
        runner.stop()
        Keychain.delete()
        apiKey = nil
        reloadTick += 1
    }
}

struct RunnerMenu: View {
    @ObservedObject var session: Session
    @ObservedObject var runner: LocalRunner
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Button("Open distribute") {
            openWindow(id: "main")
            NSApp.activate(ignoringOtherApps: true)
        }
        Divider()
        if session.apiKey == nil {
            Text("Sign in from the distribute window")
        } else {
            Text(runner.headline)
            if let problem = runner.problem { Text(problem) }
            if !runner.orgs.isEmpty {
                Divider()
                Text("Run AI on my Claude Code")
                ForEach(runner.orgs) { org in
                    Toggle(org.name, isOn: Binding(
                        get: { org.declared },
                        set: { on in runner.setDeclared(orgId: org.id, on) }
                    ))
                }
            }
            if runner.tooManyOrgs {
                Text("More organizations: turn one on from your AI (PUT /v1/local-llm)")
            }
            Divider()
            Button("Sign out") { session.signOut() }
        }
        Button("Quit distribute") { NSApp.terminate(nil) }
    }
}
