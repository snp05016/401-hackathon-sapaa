import SwiftUI

struct DeadlinePulseView: View {
    let summary: SyncTodaySummary

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(title: "Deadline pulse", subtitle: deadlineContext)

            HStack(alignment: .top, spacing: AppSpacing.sm) {
                DeadlineFigure(value: summary.dueToday, label: "due today", color: palette.warning)
                DeadlineFigure(value: summary.upcoming, label: "next 7 days", color: palette.textPrimary)
                DeadlineFigure(value: summary.overdue, label: "overdue", color: palette.accent)
            }

            if summary.noDeadline > 0 {
                Label(
                    summary.noDeadline == 1
                        ? "1 saved job has no recorded deadline"
                        : "\(summary.noDeadline) saved jobs have no recorded deadline",
                    systemImage: "calendar.badge.questionmark"
                )
                .appFont(AppFont.body(12))
                .foregroundStyle(palette.textSecondary)
            }
        }
    }

    private var deadlineContext: String {
        summary.dueToday + summary.upcoming + summary.overdue == 0
            ? "No recorded deadlines need attention."
            : "Dates come from the desktop snapshot; verify them against the posting."
    }
}
