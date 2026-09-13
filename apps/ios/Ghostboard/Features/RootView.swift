import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.colorScheme) private var colorScheme
    @State private var selection: AppTab = .home

    var body: some View {
        let palette = store.theme.palette(for: colorScheme)

        TabView(selection: $selection) {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }
                .tag(AppTab.home)

            PipelineView()
                .tabItem { Label("Pipeline", systemImage: "rectangle.split.3x1") }
                .tag(AppTab.pipeline)

            ApplicationsView()
                .tabItem { Label("Applications", systemImage: "square.grid.2x2") }
                .tag(AppTab.applications)

            InsightsView()
                .tabItem { Label("Insights", systemImage: "chart.xyaxis.line") }
                .tag(AppTab.insights)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(AppTab.settings)
        }
        .tint(palette.accent)
        .toolbarBackground(palette.surface.opacity(0.96), for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .environment(\.palette, palette)
        .preferredColorScheme(store.theme.preferredColorScheme)
    }
}
