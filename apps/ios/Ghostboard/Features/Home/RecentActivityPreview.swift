import SwiftUI

struct RecentActivityPreview: View {
    let events: [ApplicationEvent]

    @EnvironmentObject private var store: AppStore
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(title: "Recent movement", subtitle: "Meaningful changes from your desktop history.")

            if events.isEmpty {
                Label("No activity has been recorded yet", systemImage: "clock")
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
                    .padding(.vertical, AppSpacing.sm)
            } else {
                ForEach(events) { event in
                    if let application = store.application(withId: event.applicationId) {
                        NavigationLink(value: application) {
                            ActivityLedgerRow(event: event, application: application)
                        }
                        .buttonStyle(.plain)
                    } else {
                        ActivityLedgerRow(event: event, application: nil)
                    }
                }
            }
        }
    }
}
