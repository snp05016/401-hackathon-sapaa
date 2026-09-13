import SwiftUI

struct PipelineRunway: View {
    @Binding var selectedStage: ApplicationStage
    let counts: [ApplicationStage: Int]
    let totalCount: Int

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                HStack(spacing: AppSpacing.xs) {
                    ForEach(ApplicationStage.allCases) { stage in
                        PipelineStageButton(
                            stage: stage,
                            count: counts[stage, default: 0],
                            totalCount: totalCount,
                            isSelected: selectedStage == stage,
                            action: { select(stage, proxy: proxy) }
                        )
                        .id(stage)
                    }
                }
                .padding(.vertical, AppSpacing.xxs)
            }
            .scrollIndicators(.hidden)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Pipeline stage distribution")
    }

    private func select(_ stage: ApplicationStage, proxy: ScrollViewProxy) {
        selectedStage = stage
        if reduceMotion {
            proxy.scrollTo(stage, anchor: .center)
        } else {
            withAnimation(AppMotion.quick) {
                proxy.scrollTo(stage, anchor: .center)
            }
        }
    }
}
