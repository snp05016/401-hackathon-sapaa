import SwiftUI

/// The common dossier ground: editorial heading, live status, and pull-to-refresh.
struct ScreenScaffold<Content: View>: View {
    let title: String
    var caption: String?
    @ViewBuilder var content: Content

    @EnvironmentObject private var store: AppStore
    @Environment(\.palette) private var palette

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.section) {
                ScreenHeading(title: title, caption: caption)

                if !store.needsSetup {
                    StaleDataNotice(
                        state: store.connectionState,
                        lastSyncedAt: store.lastSyncedAt,
                        hasData: !store.applications.isEmpty
                    )
                }

                content
            }
            .padding(.horizontal, AppSpacing.lg)
            .padding(.top, AppSpacing.md)
            .padding(.bottom, AppSpacing.section)
        }
        .background(EditorialBackground())
        .refreshable { await store.refresh() }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(palette.background.opacity(0.94), for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ConnectionPill(state: store.connectionState, lastSyncedAt: store.lastSyncedAt)
            }
        }
    }
}
