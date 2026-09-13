import SwiftUI

struct ApplicationsView: View {
    @EnvironmentObject private var store: AppStore

    @State private var query = ""
    @State private var stageFilter: ApplicationStage?
    @State private var sort = ApplicationSort.recent
    @State private var displayedApplications: [JobApplication] = []

    var body: some View {
        NavigationStack {
            ScreenScaffold(
                title: "Applications",
                caption: applicationCaption
            ) {
                if store.needsSetup {
                    AppEmptyState(
                        title: "Connect your desktop",
                        message: "Pair this iPhone in Settings to explore your applications here.",
                        symbol: "laptopcomputer.and.iphone"
                    )
                    .padding(.top, AppSpacing.xl)
                } else if !store.hasLoadedOnce {
                    LoadingState(message: "Loading your applications…")
                } else if store.applications.isEmpty {
                    AppEmptyState(
                        title: "Nothing tracked yet",
                        message: "Save a job from the desktop or browser extension and it will appear here.",
                        symbol: "tray"
                    )
                    .padding(.top, AppSpacing.xl)
                } else {
                    ApplicationFilterBar(
                        stageFilter: $stageFilter,
                        sort: $sort,
                        counts: stageCounts
                    )

                    if displayedApplications.isEmpty {
                        emptyResults
                    } else {
                        LazyVStack(spacing: AppSpacing.xs) {
                            ForEach(displayedApplications) { application in
                                NavigationLink(value: application) {
                                    ApplicationRow(application: application)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
            .searchable(text: $query, prompt: "Company, role, location, or source")
            .navigationDestination(for: JobApplication.self) { application in
                ApplicationDetailView(applicationId: application.id)
            }
            .onAppear(perform: rebuildResults)
            .onChange(of: store.applications) { _, _ in rebuildResults() }
            .onChange(of: stageFilter) { _, _ in rebuildResults() }
            .onChange(of: sort) { _, _ in rebuildResults() }
            .task(id: query) {
                if !query.isEmpty {
                    try? await Task.sleep(for: .milliseconds(120))
                }
                guard !Task.isCancelled else { return }
                rebuildResults()
            }
        }
    }

    @ViewBuilder
    private var emptyResults: some View {
        if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            AppEmptyState(
                title: "No applications in this stage",
                message: "Choose another stage or show every application.",
                symbol: "line.3.horizontal.decrease.circle"
            )
            .padding(.top, AppSpacing.lg)
        } else {
            ContentUnavailableView.search
                .padding(.top, AppSpacing.lg)
        }
    }

    private var stageCounts: [ApplicationStage: Int] {
        var counts = Dictionary(uniqueKeysWithValues: ApplicationStage.allCases.map { ($0, 0) })
        for application in store.applications {
            counts[application.status, default: 0] += 1
        }
        return counts
    }

    private var applicationCaption: String {
        let noun = store.applications.count == 1 ? "role" : "roles"
        return "\(store.applications.count) \(noun) in your search"
    }

    private func rebuildResults() {
        displayedApplications = ApplicationSearch.results(
            from: store.applicationsByRecency,
            query: query,
            stage: stageFilter,
            sort: sort,
            staleness: store.stalenessInfo(for:)
        )
    }
}
