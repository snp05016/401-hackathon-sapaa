import Charts
import SwiftUI

struct InsightsWeekChart: View {
    let counts: [Int]
    @Environment(\.palette) private var palette

    var body: some View {
        let entries = weekEntries
        let total = entries.reduce(0) { $0 + $1.count }

        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(
                title: "Seven-day rhythm",
                subtitle: "\(total) \(total == 1 ? "application" : "applications") sent in the last seven days."
            )

            Chart(entries) { entry in
                BarMark(
                    x: .value("Day", entry.date, unit: .day),
                    y: .value("Applications", entry.count)
                )
                .foregroundStyle(palette.accent)
                .accessibilityLabel(entry.date.formatted(.dateTime.weekday(.wide)))
                .accessibilityValue("\(entry.count) \(entry.count == 1 ? "application" : "applications")")
            }
            .chartYAxis {
                AxisMarks(position: .leading) { _ in
                    AxisGridLine().foregroundStyle(palette.hairline)
                    AxisValueLabel().foregroundStyle(palette.textSecondary)
                }
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .day)) { _ in
                    AxisValueLabel(format: .dateTime.weekday(.narrow))
                        .foregroundStyle(palette.textSecondary)
                }
            }
            .frame(height: 156)
            .accessibilityLabel("Applications sent each day over the last seven days")

            Text(peakSummary(entries))
                .appFont(AppFont.body(12))
                .foregroundStyle(palette.textSecondary)
        }
    }

    private var weekEntries: [InsightWeekEntry] {
        let recentCounts = counts.suffix(7)
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        return recentCounts.enumerated().map { index, count in
            let offset = recentCounts.count - index - 1
            let date = calendar.date(byAdding: .day, value: -offset, to: today) ?? today
            return InsightWeekEntry(date: date, count: count)
        }
    }

    private func peakSummary(_ entries: [InsightWeekEntry]) -> String {
        guard let peak = entries.max(by: { $0.count < $1.count }), peak.count > 0 else {
            return "No applications were sent during this window."
        }
        return "Busiest day: \(peak.date.formatted(.dateTime.weekday(.wide))), with \(peak.count) sent."
    }
}
