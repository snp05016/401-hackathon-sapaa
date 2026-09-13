import SwiftUI

struct InsightsView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationStack {
            ScreenScaffold(
                title: "Insights",
                caption: "A clear read on the search, calculated by your desktop."
            ) {
                if store.needsSetup {
                    AppEmptyState(
                        title: "Connect your desktop",
                        message: "Pair this iPhone in Settings to bring your application history into view.",
                        symbol: "laptopcomputer.and.iphone"
                    )
                    .padding(.top, AppSpacing.xl)
                } else if !store.hasLoadedOnce {
                    LoadingState(message: "Reading your search history…")
                } else if store.applications.isEmpty {
                    AppEmptyState(
                        title: "Your first signal starts on desktop",
                        message: "Save or track an application on your Mac. Its progress will appear here after the next sync.",
                        symbol: "chart.xyaxis.line"
                    )
                    .padding(.top, AppSpacing.xl)
                } else {
                    InsightsHeadline(analytics: store.analytics)
                    InsightsWeekChart(counts: store.analytics.appliedLast7Days)
                    InsightsStageChart(counts: store.analytics.stageCounts)
                    InsightsConversion(analytics: store.analytics)
                    if !store.analytics.sourceCounts.isEmpty {
                        InsightsSources(counts: store.analytics.sourceCounts)
                    }
                }
            }
        }
    }
}
