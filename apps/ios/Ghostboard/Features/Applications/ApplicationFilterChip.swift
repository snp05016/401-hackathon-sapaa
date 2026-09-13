import SwiftUI

struct ApplicationFilterChip: View {
    let title: String
    let symbol: String
    let isSelected: Bool
    var tint: Color?
    let action: () -> Void

    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: symbol)
                .appFont(AppFont.body(12))
                .lineLimit(1)
                .foregroundStyle(isSelected ? palette.background : palette.textSecondary)
                .padding(.horizontal, AppSpacing.sm)
                .frame(minHeight: 44)
                .background(isSelected ? palette.textPrimary : Color.clear)
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(isSelected ? (tint ?? palette.accent) : Color.clear)
                        .frame(height: 2)
                }
                .overlay {
                    RoundedRectangle(cornerRadius: AppRadius.badge)
                        .strokeBorder(isSelected ? Color.clear : palette.hairline, lineWidth: 1)
                }
                .clipShape(.rect(cornerRadius: AppRadius.badge))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
