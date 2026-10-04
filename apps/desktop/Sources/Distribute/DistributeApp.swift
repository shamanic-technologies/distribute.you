import SwiftUI

@main
struct DistributeApp: App {
    @StateObject private var state = AppState()

    var body: some Scene {
        WindowGroup("distribute") {
            RootView().environmentObject(state)
        }
        .windowToolbarStyle(.unified(showsTitle: false))
    }
}
