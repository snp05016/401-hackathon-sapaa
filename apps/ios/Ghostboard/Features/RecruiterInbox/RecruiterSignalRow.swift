import SwiftUI

struct RecruiterSignalRow: View {
    let signal: SyncRecruiterSignal

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.md) {
            Image(systemName: "envelope.badge")
                .font(.body)
                .foregroundStyle(palette.warning)
                .frame(width: 28, height: 44)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: AppSpacing.xxs) {
                HStack(alignment: .firstTextBaseline) {
                    Text(signal.sender)
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.textSecondary)
                        .lineLimit(1)
                    Spacer(minLength: AppSpacing.xs)
                    Text(AppFormat.relative(signal.receivedAt))
                        .appFont(AppFont.body(11))
                        .foregroundStyle(palette.textMuted)
                }

                Text(signal.subject)
                    .appFont(AppFont.body(14, weight: .semibold))
                    .foregroundStyle(palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                if let status = signal.newStatus {
                    Label("Possible \(status.label.lowercased()) signal", systemImage: "sparkle.magnifyingglass")
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.warning)
                } else {
                    Label("Meaning remains uncertain", systemImage: "questionmark.circle")
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.textSecondary)
                }
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
        .accessibilityHint("Opens the evidence and possible application matches")
    }
}
