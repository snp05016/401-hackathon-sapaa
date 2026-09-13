import SwiftUI

struct StaleApplicationRow: View {
    let application: JobApplication
    let staleness: SyncStaleness?

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            Image(systemName: "waveform")
                .font(.body)
                .foregroundStyle(palette.accent)
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
                if let suggestion = staleness?.suggestedActionLabel {
                    Text(suggestion)
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: AppSpacing.xs)

            if let staleness {
                Text(AppFormat.quiet(staleness.daysSinceLastActivity))
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.accent)
                    .fixedSize()
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
        .accessibilityHint("Opens the application history and suggested next action")
    }
}
