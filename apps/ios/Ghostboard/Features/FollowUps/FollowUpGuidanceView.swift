import SwiftUI

struct FollowUpGuidanceView: View {
    let count: Int

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text("\(count) \(count == 1 ? "message" : "messages") ready for review")
                .appFont(AppFont.display(26))
                .foregroundStyle(palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text("Open a draft, copy it, and make it sound like you before sending. Nothing is sent from this app.")
                .appFont(AppFont.body(13))
                .foregroundStyle(palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.bottom, AppSpacing.sm)
        .hairline(palette)
        .accessibilityElement(children: .combine)
    }
}
