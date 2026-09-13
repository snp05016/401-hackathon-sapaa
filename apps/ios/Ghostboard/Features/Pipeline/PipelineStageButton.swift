import SwiftUI

struct PipelineStageButton: View {
    let stage: ApplicationStage
    let count: Int
    let totalCount: Int
    let isSelected: Bool
    let action: () -> Void

    @Environment(\.palette) private var palette

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Label(stage.label, systemImage: stage.symbolName)
                    .appFont(AppFont.body(12, weight: isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? palette.textPrimary : palette.textSecondary)

                HStack(alignment: .firstTextBaseline, spacing: AppSpacing.xxs) {
                    Text(count, format: .number)
                        .appFont(AppFont.display(24))
                        .monospacedDigit()
                    Text("of \(totalCount)")
                        .appFont(AppFont.body(11))
                        .foregroundStyle(palette.textMuted)
                }

                ProgressView(value: fraction)
                    .tint(stage.color(in: palette))
            }
            .foregroundStyle(palette.textPrimary)
            .padding(AppSpacing.sm)
            .frame(minWidth: 150, minHeight: 92, alignment: .leading)
            .background(isSelected ? palette.surface : palette.background)
            .overlay {
                RoundedRectangle(cornerRadius: AppRadius.card)
                    .strokeBorder(isSelected ? palette.textPrimary : palette.hairline, lineWidth: 1)
            }
            .clipShape(.rect(cornerRadius: AppRadius.card))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(stage.label)
        .accessibilityValue("\(count) of \(totalCount) applications")
        .accessibilityHint("Shows applications in this stage")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private var fraction: Double {
        guard totalCount > 0 else { return 0 }
        return Double(count) / Double(totalCount)
    }
}
