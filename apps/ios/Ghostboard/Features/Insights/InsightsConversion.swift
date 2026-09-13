import SwiftUI

struct InsightsConversion: View {
    let analytics: SyncAnalytics
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(
                title: "Response path",
                subtitle: "Measured from applications you sent, not predictions."
            )

            InsightsMetricStrip(metrics: [
                InsightMetric(value: AppFormat.percent(analytics.responseRate), label: "heard back"),
                InsightMetric(
                    value: AppFormat.percent(analytics.interviewRate),
                    label: "reached interview",
                    tint: palette.warning
                ),
                InsightMetric(
                    value: AppFormat.percent(analytics.offerRate),
                    label: "reached offer",
                    tint: palette.success
                ),
            ])

            if let average = analytics.averageDaysToFirstResponse {
                Text("First response takes \(average, format: .number.precision(.fractionLength(1))) days on average.")
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
            } else {
                Text("A response-time average will appear after the first recorded reply.")
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
            }
        }
    }
}
