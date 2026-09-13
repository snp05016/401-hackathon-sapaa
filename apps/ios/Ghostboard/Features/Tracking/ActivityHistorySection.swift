import SwiftUI

struct ActivityHistorySection: View {
    let events: [ApplicationEvent]

    @EnvironmentObject private var store: AppStore
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(title: "Recent history", subtitle: "Newest meaningful desktop events first.")

            if events.isEmpty {
                Label("No activity has been recorded", systemImage: "clock")
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
                    .padding(.vertical, AppSpacing.sm)
            } else {
                LazyVStack(spacing: 0) {
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
}
