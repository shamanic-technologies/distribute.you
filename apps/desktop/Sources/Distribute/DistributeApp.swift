import SwiftUI

@main
struct DistributeApp: App {
    @NSApplicationDelegateAdaptor private var delegate: AppDelegate
    @StateObject private var state = AppState()

    init() {
        Snapshot.runIfAsked()
        // Logos and avatars are tiny: keep a small RAM cache, the rest on disk.
        URLCache.shared = URLCache(memoryCapacity: 8 << 20, diskCapacity: 64 << 20)
    }

    var body: some Scene {
        WindowGroup("distribute") {
            RootView().environmentObject(state)
        }
        .windowToolbarStyle(.unified(showsTitle: false))
    }
}

/// A `claude` turn still running when the app quits must not outlive it.
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationWillTerminate(_ notification: Notification) {
        ClaudeSession.stopAll()
    }
}
