import SwiftUI

struct DeadlineReviewSection: View {
    let applications: [JobApplication]

    @EnvironmentObject private var store: AppStore
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeading(
                title: "Deadlines",
                subtitle: applications.isEmpty
                    ? "No recorded application deadlines."
                    : "Ordered by the soonest date from the desktop snapshot."
            )

            if applications.isEmpty {
                Label("No dates are pressing right now", systemImage: "calendar")
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
                    .padding(.vertical, AppSpacing.sm)
            } else {
                ForEach(applications) { application in
                    NavigationLink(value: application) {
                        DeadlineApplicationRow(
                            application: application,
                            deadline: store.deadlineInfo(for: application.id)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
