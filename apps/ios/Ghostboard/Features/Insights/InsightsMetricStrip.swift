import SwiftUI

struct InsightsMetricStrip: View {
    let metrics: [InsightMetric]

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: AppSpacing.sm) {
                ForEach(metrics) { metric in
                    StatFigure(value: metric.value, label: metric.label, tint: metric.tint)
                }
            }

            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                ForEach(metrics) { metric in
                    StatFigure(value: metric.value, label: metric.label, tint: metric.tint)
                }
            }
        }
    }
}
