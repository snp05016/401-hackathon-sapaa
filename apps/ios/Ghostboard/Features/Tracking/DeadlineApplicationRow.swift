import SwiftUI

struct DeadlineApplicationRow: View {
    let application: JobApplication
    let deadline: SyncDeadline?

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            Image(systemName: "calendar")
                .font(.body)
                .foregroundStyle(deadline?.color.color(in: palette) ?? palette.textMuted)
                .frame(width: 28, height: 44)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(application.title)
                    .appFont(AppFont.body(13, weight: .semibold))
                    .foregroundStyle(palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(application.company)
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
                if let recordedDate = application.deadline, !recordedDate.isEmpty {
                    Text(AppFormat.calendarDay(recordedDate))
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.textMuted)
                }
            }

            Spacer(minLength: AppSpacing.xs)

            if let deadline {
                Text(deadline.label)
                    .appFont(AppFont.body(12))
                    .foregroundStyle(deadline.color.color(in: palette))
                    .multilineTextAlignment(.trailing)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Image(systemName: "chevron.right")
                .font(.footnote)
                .foregroundStyle(palette.textMuted)
                .accessibilityHidden(true)
        }
        .padding(.vertical, AppSpacing.sm)
        .frame(minHeight: 64)
        .hairline(palette)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens the application and its timeline")
    }
}
