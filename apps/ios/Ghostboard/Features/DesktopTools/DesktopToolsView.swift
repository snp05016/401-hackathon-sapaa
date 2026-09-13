import SwiftUI

struct DesktopToolsView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScreenScaffold(
            title: "Desktop tools",
            caption: "A read-only ledger of the work that begins on your Mac."
        ) {
            if store.needsSetup {
                AppEmptyState(
                    title: "Pair before reading outcomes",
                    message: "Return to Settings and connect this iPhone to your desktop companion.",
                    symbol: "laptopcomputer.and.iphone"
                )
                .padding(.top, AppSpacing.xl)
            } else if !store.hasLoadedOnce {
                LoadingState(message: "Reading desktop outcomes…")
            } else if store.applications.isEmpty && store.recruiterSignals.isEmpty {
                AppEmptyState(
                    title: "No desktop outcomes yet",
                    message: "Save a role, attach a resume, or review a recruiter signal on your Mac. This ledger updates on the next sync.",
                    symbol: "square.stack.3d.up"
                )
                .padding(.top, AppSpacing.lg)
                DesktopWorkflowBoundary()
            } else {
                DesktopToolLedger(
                    summary: DesktopToolsSummary(
                        applications: store.applications,
                        recruiterSignals: store.recruiterSignals
                    )
                )
                DesktopWorkflowBoundary()
            }
        }
        .navigationTitle("Desktop tools")
    }
}
