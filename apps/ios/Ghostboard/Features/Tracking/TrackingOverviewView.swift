import SwiftUI

struct TrackingOverviewView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScreenScaffold(
            title: "Tracking review",
            caption: "Dates, quiet periods, duplicate sources, and history"
        ) {
            if !store.hasLoadedOnce {
                LoadingState(message: "Loading tracking context…")
            } else if store.applications.isEmpty {
                AppEmptyState(
                    title: "Nothing to review yet",
                    message: "Save a job from the desktop extension to begin a truthful application history.",
                    symbol: "scope"
                )
                .padding(.top, AppSpacing.xl)
            } else {
                TrackingSummaryView(
                    deadlineCount: deadlineApplications.count,
                    staleCount: store.staleApplications.count,
                    duplicateCount: store.duplicateGroups.count
                )

                DeadlineReviewSection(applications: deadlineApplications)
                StaleApplicationSection(applications: store.staleApplications)
                DuplicateReviewSection(groups: store.duplicateGroups)
                ActivityHistorySection(events: store.recentEvents)
            }
        }
        .navigationTitle("Tracking review")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var deadlineApplications: [JobApplication] {
        store.applications
            .filter { store.deadlineInfo(for: $0.id)?.hasDeadline == true }
            .sorted {
                (store.deadlineInfo(for: $0.id)?.daysRemaining ?? Int.max)
                    < (store.deadlineInfo(for: $1.id)?.daysRemaining ?? Int.max)
            }
    }
}
