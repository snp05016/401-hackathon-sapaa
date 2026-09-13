import SwiftUI

struct ApplicationRow: View {
    let application: JobApplication

    @EnvironmentObject private var store: AppStore
    @Environment(\.palette) private var palette

    var body: some View {
        AppCard {
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                HStack(alignment: .top, spacing: AppSpacing.sm) {
                    VStack(alignment: .leading, spacing: AppSpacing.xxs) {
                        Text(application.company)
                            .appFont(AppFont.body(13, weight: .semibold))
                            .foregroundStyle(palette.textPrimary)
                            .lineLimit(2)
                        Text(application.title)
                            .appFont(AppFont.body(13))
                            .foregroundStyle(palette.textSecondary)
                            .lineLimit(3)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    StageBadge(stage: application.status)
                }

                if let nextAction = nonempty(application.nextAction) {
                    Label("Next: \(nextAction)", systemImage: "arrow.turn.down.right")
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.textPrimary)
                        .lineLimit(2)
                }

                HStack(spacing: AppSpacing.sm) {
                    if let deadline = store.deadlineInfo(for: application.id), deadline.hasDeadline {
                        Label(deadline.label, systemImage: "calendar")
                            .foregroundStyle(deadline.color.color(in: palette))
                    } else if let staleness = store.stalenessInfo(for: application.id) {
                        Label(AppFormat.quiet(staleness.daysSinceLastActivity), systemImage: "clock")
                            .foregroundStyle(staleness.isStale ? palette.accent : palette.textMuted)
                    } else {
                        Label(AppFormat.relative(application.lastActivityAt), systemImage: "clock")
                    }

                    Spacer(minLength: 0)

                    if let location = nonempty(application.location) {
                        Label(location, systemImage: "mappin")
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                }
                .appFont(AppFont.body(11))
                .foregroundStyle(palette.textMuted)

                if store.duplicateApplicationIds.contains(application.id) {
                    Label("Saved from multiple sites", systemImage: "square.on.square")
                        .appFont(AppFont.body(11))
                        .foregroundStyle(palette.warning)
                }
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(application.title) at \(application.company)")
        .accessibilityValue(accessibilityValue)
        .accessibilityHint("Opens application details")
        .contextMenu {
            if let url = application.safeJobURL {
                Link("Open the posting", destination: url)
            }
        }
    }

    private var accessibilityValue: String {
        var parts = ["Stage: \(application.status.label)"]
        if let nextAction = nonempty(application.nextAction) {
            parts.append("Next action: \(nextAction)")
        }
        if let staleness = store.stalenessInfo(for: application.id) {
            parts.append("\(AppFormat.days(staleness.daysSinceLastActivity)) since last activity")
        }
        if let deadline = store.deadlineInfo(for: application.id), deadline.hasDeadline {
            parts.append(deadline.label)
        }
        return parts.joined(separator: ". ")
    }

    private func nonempty(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }
}
