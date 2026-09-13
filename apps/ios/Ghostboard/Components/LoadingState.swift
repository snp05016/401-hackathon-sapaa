import SwiftUI

struct LoadingState: View {
    var message: String
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            ProgressView()
                .tint(palette.accent)
            Text(message)
                .appFont(AppFont.supporting)
                .foregroundStyle(palette.textSecondary)
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
        .padding(.horizontal, AppSpacing.md)
        .background(palette.surface)
        .clipShape(.rect(cornerRadius: AppRadius.card))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message)
    }
}
