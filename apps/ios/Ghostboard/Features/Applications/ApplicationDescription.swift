import SwiftUI

struct ApplicationDescription: View {
    let text: String

    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(title: "Job description")

            Text(text)
                .appFont(AppFont.body(13))
                .foregroundStyle(palette.textSecondary)
                .lineLimit(isExpanded ? nil : 10)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)

            if text.count > 500 {
                Button(isExpanded ? "Show less" : "Read full description", action: toggleExpanded)
                    .appFont(AppFont.body(12, weight: .semibold))
                    .foregroundStyle(palette.accent)
                    .frame(minHeight: 44)
                    .accessibilityValue(isExpanded ? "Expanded" : "Collapsed")
            }
        }
    }

    private func toggleExpanded() {
        if reduceMotion {
            isExpanded.toggle()
        } else {
            withAnimation(AppMotion.quick) {
                isExpanded.toggle()
            }
        }
    }
}
