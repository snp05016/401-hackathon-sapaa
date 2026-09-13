import SwiftUI

/// A read-only companion record. Consequential actions remain on the desktop
/// and in the browser where the user can inspect the page before submitting.
struct ApplicationDetailView: View {
    let applicationId: String

    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScrollView {
            if let application = store.application(withId: applicationId) {
                LazyVStack(alignment: .leading, spacing: AppSpacing.lg) {
                    ApplicationDetailHeader(application: application)

                    ApplicationActionBrief(
                        application: application,
                        staleness: store.stalenessInfo(for: application.id),
                        deadline: store.deadlineInfo(for: application.id)
                    )

                    ApplicationFacts(
                        application: application,
                        staleness: store.stalenessInfo(for: application.id),
                        deadline: store.deadlineInfo(for: application.id)
                    )

                    ApplicationResumeAndSource(application: application)
                    ApplicationWorkflowHandoff(application: application)
                    ApplicationTimeline(events: store.timeline(for: application.id))

                    if !application.jobDescription.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        ApplicationDescription(text: application.jobDescription)
                    }
                }
                .padding(.horizontal, AppSpacing.md)
                .padding(.bottom, AppSpacing.xxl)
            } else {
                AppEmptyState(
                    title: "No longer tracked",
                    message: "This application was removed on the desktop.",
                    symbol: "questionmark.folder"
                )
                .padding(.top, AppSpacing.xxl)
            }
        }
        .background(EditorialBackground())
        .navigationTitle(store.application(withId: applicationId)?.company ?? "Application")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let url = store.application(withId: applicationId)?.safeJobURL {
                ToolbarItem(placement: .topBarTrailing) {
                    Link(destination: url) {
                        Label("Open posting", systemImage: "safari")
                    }
                        .labelStyle(.iconOnly)
                }
            }
        }
    }
}
