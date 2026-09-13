import SwiftUI

struct InsightsHeadline: View {
    let analytics: SyncAnalytics
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text(summary)
                .appFont(AppFont.display(26))
                .foregroundStyle(palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)

            InsightsMetricStrip(metrics: [
                InsightMetric(value: "\(analytics.totalApplications)", label: "tracked"),
                InsightMetric(value: "\(analytics.activeApplications)", label: "still open"),
                InsightMetric(
                    value: "\(analytics.staleCount)",
                    label: "need attention",
                    tint: analytics.staleCount > 0 ? palette.accent : nil
                ),
            ])
        }
    }

    private var summary: String {
        if analytics.staleCount > 0 {
            "Your search is moving, with \(analytics.staleCount) worth another look."
        } else if analytics.activeApplications > 0 {
            "Your active pipeline is moving without loose ends."
        } else {
            "Your application record is taking shape."
        }
    }
}
