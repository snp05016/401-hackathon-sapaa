import SwiftUI

/// Shared anatomy for applications, follow-ups, recruiter signals, and duplicate notices.
/// The symbol and continuous leading rail communicate state without relying on colour.
struct DossierRecord<Content: View>: View {
    let symbol: String
    let tint: Color
    @ViewBuilder var content: Content
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            VStack(spacing: 0) {
                Image(systemName: symbol)
                    .font(.footnote)
                    .bold()
                    .foregroundStyle(tint)
                    .frame(width: 32, height: 32)
                    .background(tint.opacity(palette.isDark ? 0.18 : 0.09))
                    .clipShape(.circle)
                Rectangle()
                    .fill(tint.opacity(0.32))
                    .frame(width: 2)
            }
            .accessibilityHidden(true)

            content
                .padding(.vertical, AppSpacing.xxs)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(AppSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.surface)
        .overlay {
            RoundedRectangle(cornerRadius: AppRadius.card)
                .strokeBorder(palette.hairline)
        }
        .clipShape(.rect(cornerRadius: AppRadius.card))
    }
}
