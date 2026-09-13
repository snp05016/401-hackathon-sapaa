import SwiftUI

struct DesktopToolOutcomeRow: View {
    let title: String
    let value: Int
    let detail: String
    let symbol: String
    var showsDivider = true

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: AppSpacing.sm) {
            Image(systemName: symbol)
                .foregroundStyle(palette.accent)
                .frame(width: 22)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: AppSpacing.xxs) {
                Text(title)
                    .appFont(AppFont.display(20))
                    .foregroundStyle(palette.textPrimary)
                Text(detail)
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
            }

            Spacer(minLength: AppSpacing.xs)

            Text(value, format: .number)
                .appFont(AppFont.display(30))
                .monospacedDigit()
                .foregroundStyle(palette.textPrimary)
        }
        .padding(.vertical, AppSpacing.md)
        .overlay(alignment: .bottom) {
            if showsDivider {
                Rectangle()
                    .fill(palette.hairline)
                    .frame(height: 1)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value), \(detail)")
    }
}
