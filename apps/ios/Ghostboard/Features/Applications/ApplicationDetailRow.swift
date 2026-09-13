import SwiftUI

struct ApplicationDetailRow: View {
    let label: String
    let value: String
    let symbol: String
    var tint: Color?

    @Environment(\.palette) private var palette

    var body: some View {
        LabeledContent {
            Text(value)
                .multilineTextAlignment(.trailing)
                .foregroundStyle(tint ?? palette.textPrimary)
        } label: {
            Label(label, systemImage: symbol)
                .foregroundStyle(palette.textSecondary)
        }
        .appFont(AppFont.body(12))
        .padding(.vertical, AppSpacing.xs)
        .hairline(palette)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(label)
        .accessibilityValue(value)
    }
}
