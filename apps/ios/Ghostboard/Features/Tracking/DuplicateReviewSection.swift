import SwiftUI

struct DuplicateReviewSection: View {
    let groups: [SyncDuplicateGroup]

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeading(
                title: "Duplicate sources",
                subtitle: "The same role appears to have been saved from more than one website."
            )

            if groups.isEmpty {
                Label("No duplicate sources detected", systemImage: "square.on.square")
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
                    .padding(.vertical, AppSpacing.sm)
            } else {
                ForEach(groups) { group in
                    NavigationLink(value: group) {
                        DuplicateGroupRow(group: group)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
