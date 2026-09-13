import SwiftUI

struct ApplicationTimeline: View {
    let events: [ApplicationEvent]

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(title: "Timeline", subtitle: "The evidence behind this application’s status.")

            if events.isEmpty {
                ContentUnavailableView {
                    Label("No activity yet", systemImage: "clock.arrow.circlepath")
                } description: {
                    Text("Activity recorded on the desktop will build this history.")
                }
            } else {
                ForEach(events) { event in
                    ApplicationTimelineEntry(event: event, isLast: event.id == events.last?.id)
                }
            }
        }
    }
}
