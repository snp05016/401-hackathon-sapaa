import SwiftUI

struct RecruiterInboxGuidanceView: View {
    let count: Int

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text("\(count) \(count == 1 ? "signal" : "signals") waiting")
                .appFont(AppFont.display(26))
                .foregroundStyle(palette.textPrimary)
            Text("The desktop found possible meaning in recent email. These are pending suggestions until you verify the evidence there.")
                .appFont(AppFont.body(13))
                .foregroundStyle(palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.bottom, AppSpacing.sm)
        .hairline(palette)
        .accessibilityElement(children: .combine)
    }
}
