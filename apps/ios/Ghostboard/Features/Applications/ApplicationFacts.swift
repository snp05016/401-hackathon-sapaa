import SwiftUI

struct ApplicationFacts: View {
    let application: JobApplication
    let staleness: SyncStaleness?
    let deadline: SyncDeadline?

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeading(title: "At a glance")

            if let location = cleaned(application.location) {
                ApplicationDetailRow(label: "Location", value: location, symbol: "mappin.and.ellipse")
            }
            ApplicationDetailRow(
                label: "Saved",
                value: AppFormat.fullDate(application.dateFound),
                symbol: "bookmark"
            )
            if let dateApplied = application.dateApplied {
                ApplicationDetailRow(
                    label: "Applied",
                    value: AppFormat.fullDate(dateApplied),
                    symbol: "paperplane"
                )
            }
            ApplicationDetailRow(
                label: "Last activity",
                value: AppFormat.relative(application.lastActivityAt),
                symbol: "clock"
            )
            if let staleness {
                ApplicationDetailRow(
                    label: staleness.isStale ? "Needs attention" : "Activity age",
                    value: AppFormat.days(staleness.daysSinceLastActivity),
                    symbol: staleness.isStale ? "exclamationmark.circle" : "clock.arrow.circlepath",
                    tint: staleness.isStale ? palette.accent : nil
                )
            }
            if let deadline, deadline.hasDeadline {
                ApplicationDetailRow(
                    label: "Deadline",
                    value: deadline.label,
                    symbol: "calendar",
                    tint: deadline.color.color(in: palette)
                )
            } else if let rawDeadline = cleaned(application.deadline) {
                ApplicationDetailRow(
                    label: "Deadline",
                    value: AppFormat.calendarDay(rawDeadline),
                    symbol: "calendar"
                )
            }
        }
    }

    private func cleaned(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }
}
