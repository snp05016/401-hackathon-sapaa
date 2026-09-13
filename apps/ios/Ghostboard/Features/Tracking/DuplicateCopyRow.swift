import SwiftUI

struct DuplicateCopyRow: View {
    let copy: SyncDuplicateCopy
    let application: JobApplication?

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            Image(systemName: "bookmark")
                .font(.body)
                .foregroundStyle(palette.warning)
                .frame(width: 28, height: 44)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(copy.source)
                    .appFont(AppFont.body(13, weight: .semibold))
                    .foregroundStyle(palette.textPrimary)
                Text("Saved \(AppFormat.fullDate(copy.savedAt))")
                    .appFont(AppFont.body(12))
                    .foregroundStyle(palette.textSecondary)
                if let application {
                    Text(application.status.label)
                        .appFont(AppFont.body(12))
                        .foregroundStyle(application.status.color(in: palette))
                } else {
                    Text("No longer present in this snapshot")
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.textMuted)
                }
            }

            Spacer(minLength: AppSpacing.xs)

            if application != nil {
                Image(systemName: "chevron.right")
                    .font(.footnote)
                    .foregroundStyle(palette.textMuted)
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, AppSpacing.sm)
        .frame(minHeight: 64)
        .hairline(palette)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
