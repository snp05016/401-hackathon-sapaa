import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            ScreenScaffold(title: "Today", caption: AppFormat.fullDate(Date())) {
                if store.needsSetup {
                    AppEmptyState(
                        title: "Connect your desktop",
                        message: "Open the desktop app, go to Profile → iPhone companion, then enter the host, port, and token in Settings.",
                        symbol: "laptopcomputer.and.iphone"
                    )
                    .padding(.top, AppSpacing.xl)
                } else if !store.hasLoadedOnce {
                    LoadingState(message: "Preparing today’s briefing…")
                } else if store.applications.isEmpty {
                    AppEmptyState(
                        title: "Your search starts here",
                        message: "Save a job with the browser extension. Its deadline, history, and next action will appear here.",
                        symbol: "bookmark"
                    )
                    .padding(.top, AppSpacing.xl)
                } else {
                    TodayBriefingView()
                }
            }
            .navigationDestination(for: HomeDestination.self) { destination in
                switch destination {
                case .followUps:
                    FollowUpsView()
                case .recruiterInbox:
                    RecruiterInboxView()
                case .tracking:
                    TrackingOverviewView()
                case .desktopTools:
                    DesktopToolsView()
                }
            }
            .navigationDestination(for: JobApplication.self) { application in
                ApplicationDetailView(applicationId: application.id)
            }
            .navigationDestination(for: SyncFollowUp.self) { followUp in
                FollowUpDetailView(followUp: followUp)
            }
            .navigationDestination(for: SyncRecruiterSignal.self) { signal in
                RecruiterSignalDetailView(signal: signal)
            }
            .navigationDestination(for: SyncDuplicateGroup.self) { group in
                DuplicateGroupDetailView(group: group)
            }
        }
    }
}
