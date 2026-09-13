import SwiftUI

struct DuplicateGroupRow: View {
    let group: SyncDuplicateGroup

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            Image(systemName: "square.on.square")
                .font(.body)
                .foregroundStyle(palette.warning)
                .frame(width: 28, height: 44)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(group.title)
                    .appFont(AppFont.body(13, weight: .semibold))
                    .foregroundStyle(palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(group.company)
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
                Text(group.sources.joined(separator: ", "))
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.warning)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: AppSpacing.xs)

            Text(group.copies.count, format: .number)
                .appFont(AppFont.body(12))
                .foregroundStyle(palette.warning)
                .accessibilityLabel("\(group.copies.count) saved copies")

            Image(systemName: "chevron.right")
                .font(.footnote)
                .foregroundStyle(palette.textMuted)
                .accessibilityHidden(true)
        }
        .padding(.vertical, AppSpacing.sm)
        .frame(minHeight: 64)
        .hairline(palette)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Shows every source and saved copy")
    }
}
