import SwiftUI

struct AppCard<Content: View>: View {
    @Environment(\.palette) private var palette
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(AppSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.surface)
            .overlay {
                RoundedRectangle(cornerRadius: AppRadius.card)
                    .strokeBorder(palette.hairline, lineWidth: 1)
            }
            .clipShape(.rect(cornerRadius: AppRadius.card))
            .shadow(color: palette.cardShadow, radius: 12, y: 5)
    }
}
