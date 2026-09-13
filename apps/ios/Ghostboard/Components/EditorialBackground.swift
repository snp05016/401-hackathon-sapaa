import SwiftUI

struct EditorialBackground: View {
    @Environment(\.palette) private var palette

    var body: some View {
        palette.background
            .overlay(alignment: .topLeading) {
                LinearGradient(
                    colors: [palette.wash.opacity(palette.washAlpha), .clear],
                    startPoint: .topLeading,
                    endPoint: .center
                )
            }
            .overlay(alignment: .bottomTrailing) {
                RadialGradient(
                    colors: [palette.accent.opacity(palette.isDark ? 0.09 : 0.045), .clear],
                    center: .bottomTrailing,
                    startRadius: 0,
                    endRadius: 460
                )
            }
            .ignoresSafeArea()
            .accessibilityHidden(true)
    }
}
