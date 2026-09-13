import SwiftUI

struct ApplicationTimelineEntry: View {
    let event: ApplicationEvent
    let isLast: Bool

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            VStack(spacing: 0) {
                Image(systemName: event.type.symbolName)
                    .font(.body)
                    .foregroundStyle(palette.accent)
                    .frame(minWidth: 44, minHeight: 44)
                    .accessibilityHidden(true)
                if !isLast {
                    Rectangle()
                        .fill(palette.hairline)
                        .frame(width: 1)
                        .frame(maxHeight: .infinity)
                }
            }

            VStack(alignment: .leading, spacing: AppSpacing.xxs) {
                Text(event.title)
                    .appFont(AppFont.body(13, weight: .semibold))
                    .foregroundStyle(palette.textPrimary)
                if let description = event.description, !description.isEmpty {
                    Text(description)
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text(AppFormat.fullDate(event.occurredAt))
                    .appFont(AppFont.body(11))
                    .foregroundStyle(palette.textMuted)
            }
            .padding(.top, AppSpacing.xs)
            .padding(.bottom, AppSpacing.sm)

            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(event.title), \(AppFormat.fullDate(event.occurredAt))")
        .accessibilityValue(event.description ?? "")
    }
}
