import SwiftUI

struct ApplicationActionBrief: View {
    let application: JobApplication
    let staleness: SyncStaleness?
    let deadline: SyncDeadline?

    @Environment(\.palette) private var palette

    var body: some View {
        AppCard {
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Label("Next move", systemImage: actionSymbol)
                    .appFont(AppFont.body(12, weight: .semibold))
                    .foregroundStyle(actionTint)

                Text(actionTitle)
                    .appFont(AppFont.display(22))
                    .foregroundStyle(palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                if let supportingCopy {
                    Text(supportingCopy)
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var actionTitle: String {
        if let nextAction = cleaned(application.nextAction) { return nextAction }
        if let suggestion = staleness?.suggestedActionLabel { return suggestion }
        switch application.status {
        case .found: return "Review the role on your desktop"
        case .applied: return "Keep an eye on the response"
        case .interviewing: return "Prepare for the next conversation"
        case .offer: return "Review the offer and its deadline"
        case .rejected: return "Keep the record for context"
        case .ghosted: return "Decide whether to follow up"
        }
    }

    private var supportingCopy: String? {
        if let nextActionDate = cleaned(application.nextActionDate) {
            return "Planned for \(AppFormat.calendarDay(nextActionDate))."
        }
        if let deadline, deadline.hasDeadline {
            return deadline.label
        }
        if let staleness, staleness.isStale {
            return "No activity for \(AppFormat.days(staleness.daysSinceLastActivity))."
        }
        return nil
    }

    private var actionSymbol: String {
        if deadline?.color == .red { return "calendar.badge.exclamationmark" }
        if staleness?.isStale == true { return "clock.badge.exclamationmark" }
        return "arrow.up.right"
    }

    private var actionTint: Color {
        if let deadline, deadline.hasDeadline { return deadline.color.color(in: palette) }
        if staleness?.isStale == true { return palette.accent }
        return palette.warning
    }

    private func cleaned(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }
}
