import SwiftUI

struct StatFigure: View {
    let value: String
    let label: String
    var tint: Color?
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xxs) {
            Text(value)
                .appFont(AppFont.display(36))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.65)
                .foregroundStyle(tint ?? palette.textPrimary)
            Text(label)
                .appFont(AppFont.metadata)
                .foregroundStyle(palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(value)
    }
}
