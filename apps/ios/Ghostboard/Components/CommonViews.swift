import SwiftUI

struct StageBadge: View {
    let stage: ApplicationStage
    @Environment(\.palette) private var palette

    var body: some View {
        Label(stage.label, systemImage: stage.symbolName)
            .labelStyle(.titleAndIcon)
            .appFont(AppFont.metadata)
            .foregroundStyle(stage.color(in: palette))
            .lineLimit(1)
            .padding(.horizontal, AppSpacing.xs)
            .padding(.vertical, 5)
            .background(stage.color(in: palette).opacity(palette.isDark ? 0.14 : 0.08))
            .overlay {
                RoundedRectangle(cornerRadius: AppRadius.badge)
                    .strokeBorder(stage.color(in: palette).opacity(0.34), style: strokeStyle)
            }
            .clipShape(.rect(cornerRadius: AppRadius.badge))
            .accessibilityLabel("Stage: \(stage.label)")
    }

    private var strokeStyle: StrokeStyle {
        stage == .ghosted
            ? StrokeStyle(lineWidth: 1, dash: [3, 2])
            : StrokeStyle(lineWidth: 1)
    }
}

extension ApplicationStage {
    func color(in palette: AppPalette) -> Color {
        switch self {
        case .found: return palette.textSecondary
        case .applied: return palette.textPrimary
        case .interviewing: return palette.warning
        case .offer: return palette.success
        case .rejected: return palette.accent
        case .ghosted: return palette.textSecondary
        }
    }
}

extension SyncDeadline.Color {
    func color(in palette: AppPalette) -> Color {
        switch self {
        case .green: return palette.success
        case .yellow: return palette.warning
        case .red: return palette.accent
        case .none: return palette.textMuted
        }
    }
}
