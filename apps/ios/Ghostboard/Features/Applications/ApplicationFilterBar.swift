import SwiftUI

struct ApplicationFilterBar: View {
    @Binding var stageFilter: ApplicationStage?
    @Binding var sort: ApplicationSort
    let counts: [ApplicationStage: Int]

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            ScrollView(.horizontal) {
                HStack(spacing: AppSpacing.xs) {
                    ApplicationFilterChip(
                        title: "All",
                        symbol: "square.stack.3d.up",
                        isSelected: stageFilter == nil,
                        action: showAll
                    )

                    ForEach(ApplicationStage.allCases) { stage in
                        ApplicationFilterChip(
                            title: "\(stage.label) \(counts[stage, default: 0])",
                            symbol: stage.symbolName,
                            isSelected: stageFilter == stage,
                            tint: stage.color(in: palette),
                            action: { toggle(stage) }
                        )
                    }
                }
                .padding(.vertical, AppSpacing.xxs)
            }
            .scrollIndicators(.hidden)

            Menu("Sort applications", systemImage: "arrow.up.arrow.down") {
                Picker("Sort applications", selection: $sort) {
                    ForEach(ApplicationSort.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
            }
            .appFont(AppFont.body(12))
            .foregroundStyle(palette.textSecondary)
            .frame(minHeight: 44)
            .accessibilityValue(sort.label)
        }
    }

    private func showAll() {
        stageFilter = nil
    }

    private func toggle(_ stage: ApplicationStage) {
        stageFilter = stageFilter == stage ? nil : stage
    }
}
