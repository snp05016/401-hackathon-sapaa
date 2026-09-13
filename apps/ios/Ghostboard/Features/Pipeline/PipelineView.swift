import SwiftUI

/// A read-only phone interpretation of the desktop pipeline. Stages are a
/// distribution and drill-down control; changing product state stays on Mac.
struct PipelineView: View {
    @EnvironmentObject private var store: AppStore
    @State private var selectedStage: ApplicationStage = .found

    var body: some View {
        NavigationStack {
            ScreenScaffold(
                title: "Pipeline",
                caption: pipelineCaption
            ) {
                if store.needsSetup {
                    AppEmptyState(
                        title: "Connect your desktop",
                        message: "Pair this iPhone in Settings to bring your application pipeline with you.",
                        symbol: "laptopcomputer.and.iphone"
                    )
                    .padding(.top, AppSpacing.xl)
                } else if !store.hasLoadedOnce {
                    LoadingState(message: "Loading your pipeline…")
                } else if store.applications.isEmpty {
                    AppEmptyState(
                        title: "Your pipeline is ready",
                        message: "Jobs saved from the desktop and browser extension will appear here.",
                        symbol: "rectangle.split.3x1"
                    )
                    .padding(.top, AppSpacing.xl)
                } else {
                    PipelineRunway(
                        selectedStage: $selectedStage,
                        counts: stageCounts,
                        totalCount: store.applications.count
                    )

                    PipelineStageList(
                        stage: selectedStage,
                        applications: store.applications(in: selectedStage)
                    )
                }
            }
            .navigationDestination(for: JobApplication.self) { application in
                ApplicationDetailView(applicationId: application.id)
            }
        }
    }

    private var pipelineCaption: String {
        let applicationNoun = store.applications.count == 1 ? "application" : "applications"
        let stageNoun = activeStageCount == 1 ? "stage" : "stages"
        return "\(store.applications.count) \(applicationNoun) across \(activeStageCount) active \(stageNoun)"
    }

    private var stageCounts: [ApplicationStage: Int] {
        var counts = Dictionary(uniqueKeysWithValues: ApplicationStage.allCases.map { ($0, 0) })
        for count in store.analytics.stageCounts {
            counts[count.stage] = count.count
        }
        if store.analytics.stageCounts.isEmpty {
            for application in store.applications {
                counts[application.status, default: 0] += 1
            }
        }
        return counts
    }

    private var activeStageCount: Int {
        stageCounts.values.count(where: { $0 > 0 })
    }
}
