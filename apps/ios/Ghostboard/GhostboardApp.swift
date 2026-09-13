import SwiftUI

@main
struct GhostboardApp: App {
    @StateObject private var store = AppStore()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .task { await store.start() }
                .onChange(of: scenePhase) { _, phase in
                    Task {
                        switch phase {
                        case .background: await store.enterBackground()
                        case .active: await store.enterForeground()
                        default: break
                        }
                    }
                }
        }
    }
}
