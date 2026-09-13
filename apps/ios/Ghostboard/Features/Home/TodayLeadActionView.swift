import SwiftUI

struct TodayLeadActionView: View {
    let overdueCount: Int
    let followUpCount: Int
    let recruiterSignalCount: Int
    let staleCount: Int

    @Environment(\.palette) private var palette

    var body: some View {
        NavigationLink(value: destination) {
            HStack(alignment: .top, spacing: AppSpacing.md) {
                Rectangle()
                    .fill(accentColor)
                    .frame(width: 3)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(title)
                        .appFont(AppFont.display(28))
                        .foregroundStyle(palette.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(message)
                        .appFont(AppFont.body(13))
                        .foregroundStyle(palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Label(actionTitle, systemImage: "arrow.right")
                        .appFont(AppFont.body(12))
                        .foregroundStyle(accentColor)
                        .frame(minHeight: 44, alignment: .leading)
                }

                Spacer(minLength: 0)
            }
            .padding(.vertical, AppSpacing.sm)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens \(actionTitle.lowercased())")
    }

    private var destination: HomeDestination {
        if overdueCount > 0 || staleCount > 0 { return .tracking }
        if followUpCount > 0 { return .followUps }
        if recruiterSignalCount > 0 { return .recruiterInbox }
        return .tracking
    }

    private var title: String {
        if overdueCount > 0 { return "Start with the deadline" }
        if followUpCount > 0 { return "A thoughtful nudge is ready" }
        if recruiterSignalCount > 0 { return "New evidence needs your eye" }
        if staleCount > 0 { return "A quiet application deserves context" }
        return "Everything is accounted for"
    }

    private var message: String {
        if overdueCount > 0 {
            return "\(overdueCount) \(overdueCount == 1 ? "application is" : "applications are") past the recorded deadline. Review the source before acting."
        }
        if followUpCount > 0 {
            return "The desktop prepared \(followUpCount) \(followUpCount == 1 ? "message" : "messages"). Read, edit, and send on your terms."
        }
        if recruiterSignalCount > 0 {
            return "Email signals are suggestions, not status changes. Inspect the evidence before deciding what they mean."
        }
        if staleCount > 0 {
            return "Silence is only elapsed time. It never changes an application to rejected."
        }
        return "Review your timeline or keep moving. New desktop activity will appear here automatically."
    }

    private var actionTitle: String {
        switch destination {
        case .followUps: return "Review follow-ups"
        case .recruiterInbox: return "Inspect signals"
        case .tracking: return "Open tracking review"
        case .desktopTools: return "Open desktop tools"
        }
    }

    private var accentColor: Color {
        overdueCount > 0 || staleCount > 0 ? palette.accent : palette.warning
    }
}
