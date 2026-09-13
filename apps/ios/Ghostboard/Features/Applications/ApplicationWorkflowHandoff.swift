import SwiftUI

struct ApplicationWorkflowHandoff: View {
    let application: JobApplication

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(
                title: "Continue on Mac",
                subtitle: "Autofill and application submission stay in your browser."
            )

            Text("Use the desktop extension to review detected fields and fill known details. You stay in control of the final submission.")
                .appFont(AppFont.body(13))
                .foregroundStyle(palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            if let url = application.safeJobURL {
                Link(destination: url) {
                    Label("Open posting", systemImage: "safari")
                }
                    .appFont(AppFont.body(13, weight: .semibold))
                    .foregroundStyle(palette.accent)
                    .frame(minHeight: 44)
                    .accessibilityHint("Opens the original job posting in your browser")
            }
        }
    }
}
