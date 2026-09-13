import SwiftUI

struct PipelineStageList: View {
    let stage: ApplicationStage
    let applications: [JobApplication]

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            VStack(alignment: .leading, spacing: AppSpacing.xxs) {
                HStack(alignment: .firstTextBaseline) {
                    Text(stage.label)
                        .appFont(AppFont.display(26))
                        .foregroundStyle(palette.textPrimary)
                    Spacer()
                    Text(applications.count, format: .number)
                        .appFont(AppFont.body(12))
                        .monospacedDigit()
                        .foregroundStyle(palette.textMuted)
                }
                Text(stage.subtitle)
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)

            if applications.isEmpty {
                ContentUnavailableView {
                    Label("No \(stage.label.lowercased()) applications", systemImage: stage.symbolName)
                } description: {
                    Text(stage.emptyCopy)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, AppSpacing.lg)
            } else {
                LazyVStack(spacing: AppSpacing.xs) {
                    ForEach(applications) { application in
                        NavigationLink(value: application) {
                            ApplicationRow(application: application)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}
