import SwiftUI

struct ApplicationDetailHeader: View {
    let application: JobApplication

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Label(application.status.label, systemImage: application.status.symbolName)
                .appFont(AppFont.body(12, weight: .semibold))
                .foregroundStyle(application.status.color(in: palette))

            Text(application.title)
                .appFont(AppFont.display(32))
                .foregroundStyle(palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            Text(application.company)
                .appFont(AppFont.body(15))
                .foregroundStyle(palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, AppSpacing.xs)
        .padding(.bottom, AppSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .hairline(palette)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}
