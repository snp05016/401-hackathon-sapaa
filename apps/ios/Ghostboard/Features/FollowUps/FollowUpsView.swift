import SwiftUI

struct FollowUpsView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScreenScaffold(
            title: "Follow-ups",
            caption: "Drafts from your desktop, ready for a human pass"
        ) {
            if !store.hasLoadedOnce {
                LoadingState(message: "Loading follow-up drafts…")
            } else if store.followUps.isEmpty {
                AppEmptyState(
                    title: "No follow-ups waiting",
                    message: "Nothing has crossed its follow-up threshold. Silence does not change an application’s stage.",
                    symbol: "paperplane"
                )
                .padding(.top, AppSpacing.xl)
            } else {
                FollowUpGuidanceView(count: store.followUps.count)

                LazyVStack(spacing: 0) {
                    ForEach(store.followUps) { followUp in
                        NavigationLink(value: followUp) {
                            FollowUpRow(followUp: followUp)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .navigationTitle("Follow-ups")
        .navigationBarTitleDisplayMode(.inline)
    }
}
