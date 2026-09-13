import SwiftUI

struct FollowUpRow: View {
    let followUp: SyncFollowUp

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.md) {
            Image(systemName: "paperplane")
                .font(.body)
                .foregroundStyle(palette.warning)
                .frame(width: 28, height: 44)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: AppSpacing.xxs) {
                Text(followUp.kindLabel)
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.warning)
                Text(followUp.messageTitle)
                    .appFont(AppFont.body(14, weight: .semibold))
                    .foregroundStyle(palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(followUp.title) at \(followUp.company)")
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(followUp.messageDescription)
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textMuted)
                    .lineLimit(2)
            }

            Spacer(minLength: AppSpacing.xs)

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
        .accessibilityHint("Opens the draft message")
    }
}
