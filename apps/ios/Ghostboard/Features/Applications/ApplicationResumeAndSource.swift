import SwiftUI

struct ApplicationResumeAndSource: View {
    let application: JobApplication

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(title: "Materials")

            AppCard {
                VStack(alignment: .leading, spacing: AppSpacing.sm) {
                    Label(application.source, systemImage: "link")
                        .appFont(AppFont.body(13))
                        .foregroundStyle(palette.textPrimary)
                        .accessibilityLabel("Source: \(application.source)")

                    Label(resumeLabel, systemImage: resumeSymbol)
                        .appFont(AppFont.body(13))
                        .foregroundStyle(hasResume ? palette.success : palette.textSecondary)
                }
            }
        }
    }

    private var resumeLabel: String {
        hasResume ? "Resume attached" : "No resume attached"
    }

    private var resumeSymbol: String {
        hasResume ? "doc.badge.checkmark" : "doc"
    }

    private var hasResume: Bool {
        guard let resumeId = application.resumeId else { return false }
        return !resumeId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
