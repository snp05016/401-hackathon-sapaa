import SwiftUI

struct RecruiterSignalDetailView: View {
    let signal: SyncRecruiterSignal

    @EnvironmentObject private var store: AppStore
    @Environment(\.palette) private var palette

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(signal.sender)
                        .appFont(AppFont.body(13))
                        .foregroundStyle(palette.textSecondary)
                    Text(signal.subject)
                        .appFont(AppFont.display(30))
                        .foregroundStyle(palette.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(signal.receivedAt, format: .dateTime.day().month(.wide).year().hour().minute())
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.textMuted)
                }
                .padding(.bottom, AppSpacing.sm)
                .hairline(palette)

                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    SectionHeading(title: "Suggested meaning")
                    if let status = signal.newStatus {
                        HStack(spacing: AppSpacing.xs) {
                            StageBadge(stage: status)
                            Text("\(AppFormat.percent(signal.confidence)) confidence")
                                .appFont(AppFont.body(12))
                                .foregroundStyle(palette.textSecondary)
                        }
                    } else {
                        Label("No status was suggested", systemImage: "questionmark.circle")
                            .appFont(AppFont.body(13))
                            .foregroundStyle(palette.textSecondary)
                    }
                    Text("Pending only. This signal has not changed the application on your desktop.")
                        .appFont(AppFont.body(13))
                        .foregroundStyle(palette.warning)
                        .fixedSize(horizontal: false, vertical: true)
                }

                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    SectionHeading(title: "Evidence", subtitle: "The phrase that triggered the suggestion.")
                    if signal.evidence.isEmpty {
                        Text("No evidence excerpt was included. Treat this signal as unverified.")
                            .appFont(AppFont.body(13))
                            .foregroundStyle(palette.textSecondary)
                    } else {
                        Text(signal.evidence)
                            .appFont(AppFont.body(14))
                            .foregroundStyle(palette.textPrimary)
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.vertical, AppSpacing.md)
                            .padding(.horizontal, AppSpacing.sm)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(palette.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: AppRadius.card)
                                    .strokeBorder(palette.hairline, lineWidth: 1)
                            )
                    }
                }

                RecruiterCandidateListView(
                    applications: signal.candidateApplicationIds.compactMap(store.application(withId:))
                )

                Label(
                    "Confirm or dismiss this suggestion on the desktop after reading the original email.",
                    systemImage: "desktopcomputer"
                )
                .appFont(AppFont.body(12))
                .foregroundStyle(palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.bottom, AppSpacing.xxl)
        }
        .background(EditorialBackground())
        .navigationTitle("Signal")
        .navigationBarTitleDisplayMode(.inline)
    }
}
