import SwiftUI

struct AppEmptyState: View {
    let title: String
    let message: String
    var symbol: String = "tray"
    @Environment(\.palette) private var palette

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: symbol)
                .appFont(AppFont.sectionTitle)
                .foregroundStyle(palette.textPrimary)
        } description: {
            Text(message)
                .appFont(AppFont.supporting)
                .foregroundStyle(palette.textSecondary)
        }
        .frame(maxWidth: .infinity, minHeight: 220)
        .background(palette.surface)
        .overlay {
            RoundedRectangle(cornerRadius: AppRadius.card)
                .strokeBorder(palette.hairline)
        }
        .clipShape(.rect(cornerRadius: AppRadius.card))
    }
}
