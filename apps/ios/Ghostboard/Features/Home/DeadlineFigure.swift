import SwiftUI

struct DeadlineFigure: View {
    let value: Int
    let label: String
    let color: Color

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xxs) {
            Text(value, format: .number)
                .appFont(AppFont.display(32))
                .monospacedDigit()
                .foregroundStyle(value > 0 ? color : palette.textMuted)
            Text(label)
                .appFont(AppFont.body(12))
                .foregroundStyle(palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
        .accessibilityValue("\(value)")
    }
}
