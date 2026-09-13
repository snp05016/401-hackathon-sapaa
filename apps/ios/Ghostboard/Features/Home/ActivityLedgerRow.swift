import SwiftUI

struct ActivityLedgerRow: View {
    let event: ApplicationEvent
    let application: JobApplication?

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            Image(systemName: event.type.symbolName)
                .font(.footnote)
                .foregroundStyle(palette.textMuted)
                .frame(width: 20, height: 20)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                    .appFont(AppFont.body(13))
                    .foregroundStyle(palette.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                if let application {
                    Text("\(application.title) at \(application.company)")
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            Spacer(minLength: AppSpacing.xs)

            Text(AppFormat.shortDate(event.occurredAt))
                .appFont(AppFont.body(11))
                .foregroundStyle(palette.textMuted)
        }
        .padding(.vertical, AppSpacing.xs)
        .hairline(palette)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
