import Charts
import SwiftUI

struct InsightsStageChart: View {
    let counts: [SyncStageCount]
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(
                title: "Pipeline shape",
                subtitle: "Where every tracked application stands now."
            )

            Chart(counts) { entry in
                BarMark(
                    x: .value("Applications", entry.count),
                    y: .value("Stage", entry.stage.label)
                )
                .foregroundStyle(entry.stage.color(in: palette))
                .accessibilityLabel(entry.stage.label)
                .accessibilityValue("\(entry.count) \(entry.count == 1 ? "application" : "applications")")
            }
            .chartXAxis {
                AxisMarks { _ in
                    AxisGridLine().foregroundStyle(palette.hairline)
                    AxisValueLabel().foregroundStyle(palette.textSecondary)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { _ in
                    AxisValueLabel().foregroundStyle(palette.textSecondary)
                }
            }
            .frame(height: 210)
            .accessibilityLabel("Current applications grouped by pipeline stage")
        }
    }
}
