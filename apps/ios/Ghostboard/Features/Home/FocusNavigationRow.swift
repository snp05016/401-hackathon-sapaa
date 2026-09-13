import SwiftUI

struct FocusNavigationRow: View {
    let title: String
    let detail: String
    let count: Int
    let symbol: String

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: symbol)
                .font(.body)
                .foregroundStyle(count > 0 ? palette.accent : palette.textSecondary)
                .frame(width: 28, height: 44)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .appFont(AppFont.body(14, weight: .semibold))
                    .foregroundStyle(palette.textPrimary)
                Text(detail)
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: AppSpacing.xs)

            if count > 0 {
                Text(count, format: .number)
                    .appFont(AppFont.body(12))
                    .monospacedDigit()
                    .foregroundStyle(palette.accent)
                    .accessibilityLabel("\(count) items")
            }

            Image(systemName: "chevron.right")
                .font(.footnote)
                .foregroundStyle(palette.textMuted)
                .accessibilityHidden(true)
        }
        .padding(.vertical, AppSpacing.xs)
        .frame(minHeight: 56)
        .hairline(palette)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens \(title)")
    }
}
