import SwiftUI

struct InsightsSources: View {
    let counts: [SyncSourceCount]
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionHeading(
                title: "Origins",
                subtitle: "The source recorded when each role entered your pipeline."
            )

            ForEach(counts) { entry in
                LabeledContent {
                    Text(entry.count, format: .number)
                        .monospacedDigit()
                        .foregroundStyle(palette.textSecondary)
                } label: {
                    Text(sourceLabel(entry.source))
                        .foregroundStyle(palette.textPrimary)
                }
                .appFont(AppFont.body(13))
                .padding(.vertical, AppSpacing.xs)
                .hairline(palette)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("\(sourceLabel(entry.source)): \(entry.count) applications")
            }
        }
    }

    private func sourceLabel(_ source: String) -> String {
        if source.lowercased().hasPrefix("jobspy:") {
            let provider = String(source.dropFirst("jobspy:".count))
            return "Discover: \(provider.capitalized)"
        }
        return source.replacing("_", with: " ").capitalized
    }
}
