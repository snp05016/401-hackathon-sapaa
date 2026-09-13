import SwiftUI

struct ScreenHeading: View {
    let title: String
    let caption: String?
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(title)
                .appFont(AppFont.screenTitle)
                .foregroundStyle(palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            if let caption {
                Text(caption)
                    .appFont(AppFont.supporting)
                    .foregroundStyle(palette.textSecondary)
            }

            HStack(spacing: AppSpacing.xs) {
                Rectangle()
                    .fill(palette.accent)
                    .frame(width: 48, height: 3)
                Rectangle()
                    .fill(palette.success)
                    .frame(width: 12, height: 3)
            }
            .accessibilityHidden(true)
        }
    }
}
