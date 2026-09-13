import SwiftUI

struct RecruiterInboxView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScreenScaffold(
            title: "Recruiter inbox",
            caption: "Email clues awaiting verification"
        ) {
            if !store.hasLoadedOnce {
                LoadingState(message: "Loading recruiter signals…")
            } else if store.recruiterSignals.isEmpty {
                AppEmptyState(
                    title: "No pending signals",
                    message: "There are no email suggestions to verify. A quiet inbox does not change any application’s stage.",
                    symbol: "envelope.open"
                )
                .padding(.top, AppSpacing.xl)
            } else {
                RecruiterInboxGuidanceView(count: store.recruiterSignals.count)

                LazyVStack(spacing: 0) {
                    ForEach(store.recruiterSignals) { signal in
                        NavigationLink(value: signal) {
                            RecruiterSignalRow(signal: signal)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .navigationTitle("Recruiter inbox")
        .navigationBarTitleDisplayMode(.inline)
    }
}
