import SwiftUI

struct TodayBriefingView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xl) {
            TodayLeadActionView(
                overdueCount: store.today.overdue,
                followUpCount: store.followUps.count,
                recruiterSignalCount: store.recruiterSignals.count,
                staleCount: store.staleApplications.count
            )

            DeadlinePulseView(summary: store.today)

            VStack(alignment: .leading, spacing: 0) {
                SectionHeading(
                    title: "Focus",
                    subtitle: "Open a workspace when you’re ready to act or inspect the evidence."
                )

                NavigationLink(value: HomeDestination.followUps) {
                    FocusNavigationRow(
                        title: "Follow-ups",
                        detail: store.followUps.isEmpty
                            ? "No draft messages waiting"
                            : "\(store.followUps.count) draft \(store.followUps.count == 1 ? "message" : "messages") ready to review",
                        count: store.followUps.count,
                        symbol: "paperplane"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink(value: HomeDestination.recruiterInbox) {
                    FocusNavigationRow(
                        title: "Recruiter inbox",
                        detail: store.recruiterSignals.isEmpty
                            ? "No pending email suggestions"
                            : "\(store.recruiterSignals.count) \(store.recruiterSignals.count == 1 ? "signal needs" : "signals need") verification",
                        count: store.recruiterSignals.count,
                        symbol: "envelope.badge"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink(value: HomeDestination.tracking) {
                    FocusNavigationRow(
                        title: "Tracking review",
                        detail: trackingDetail,
                        count: store.today.overdue + store.staleApplications.count + store.duplicateGroups.count,
                        symbol: "scope"
                    )
                }
                .buttonStyle(.plain)

                NavigationLink(value: HomeDestination.desktopTools) {
                    FocusNavigationRow(
                        title: "Desktop tools",
                        detail: "Discover, resume, profile, and autofill outcomes",
                        count: store.applications.count + store.recruiterSignals.count,
                        symbol: "laptopcomputer"
                    )
                }
                .buttonStyle(.plain)
            }

            RecentActivityPreview(events: Array(store.recentEvents.prefix(5)))
        }
    }

    private var trackingDetail: String {
        let attentionCount = store.today.overdue + store.staleApplications.count + store.duplicateGroups.count
        return attentionCount == 0
            ? "Deadlines, quiet applications, and duplicate sources"
            : "\(attentionCount) \(attentionCount == 1 ? "item" : "items") worth a closer look"
    }
}
