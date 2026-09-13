import SwiftUI

struct RecruiterCandidateListView: View {
    let applications: [JobApplication]

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeading(
                title: "Possible applications",
                subtitle: applications.isEmpty
                    ? "No application matched strongly enough."
                    : "Open a candidate to compare its history with the email."
            )

            if applications.isEmpty {
                Label("No confident match", systemImage: "link.badge.plus")
                    .appFont(AppFont.body(13))
                    .foregroundStyle(palette.warning)
                    .padding(.vertical, AppSpacing.sm)
            } else {
                ForEach(applications) { application in
                    NavigationLink(value: application) {
                        HStack(spacing: AppSpacing.sm) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(application.title)
                                    .appFont(AppFont.body(13, weight: .semibold))
                                    .foregroundStyle(palette.textPrimary)
                                    .fixedSize(horizontal: false, vertical: true)
                                Text(application.company)
                                    .appFont(AppFont.body(12))
                                    .foregroundStyle(palette.textSecondary)
                            }
                            Spacer(minLength: AppSpacing.xs)
                            StageBadge(stage: application.status)
                            Image(systemName: "chevron.right")
                                .font(.footnote)
                                .foregroundStyle(palette.textMuted)
                                .accessibilityHidden(true)
                        }
                        .frame(minHeight: 56)
                        .padding(.vertical, AppSpacing.xs)
                        .hairline(palette)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Opens the application history")
                }
            }
        }
    }
}
