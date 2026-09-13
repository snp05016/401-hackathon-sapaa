import SwiftUI

struct StaleApplicationSection: View {
    let applications: [JobApplication]

    @EnvironmentObject private var store: AppStore
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeading(
                title: "Gone quiet",
                subtitle: "Past the desktop’s stage-aware activity threshold. Never treated as rejection."
            )

            if applications.isEmpty {
                Label("No applications are past their quiet threshold", systemImage: "waveform")
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
                    .padding(.vertical, AppSpacing.sm)
            } else {
                ForEach(applications) { application in
                    NavigationLink(value: application) {
                        StaleApplicationRow(
                            application: application,
                            staleness: store.stalenessInfo(for: application.id)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
