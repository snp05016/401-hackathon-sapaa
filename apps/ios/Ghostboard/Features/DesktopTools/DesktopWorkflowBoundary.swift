import SwiftUI

struct DesktopWorkflowBoundary: View {
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            SectionHeading(
                title: "Finish on your Mac",
                subtitle: "The phone is a live companion, not a remote control."
            )

            Label {
                Text("Run searches and open fresh roles in Discover.")
            } icon: {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(palette.accent)
            }

            Label {
                Text("Edit, generate, review, and export resumes.")
            } icon: {
                Image(systemName: "doc.badge.gearshape")
                    .foregroundStyle(palette.accent)
            }

            Label {
                Text("Maintain your private applicant profile.")
            } icon: {
                Image(systemName: "person.text.rectangle")
                    .foregroundStyle(palette.accent)
            }

            Label {
                Text("Trigger browser autofill, review every field, and submit manually.")
            } icon: {
                Image(systemName: "rectangle.and.hand.point.up.left")
                    .foregroundStyle(palette.accent)
            }

            Text("Autofill activity is not included in phone sync. Browser capture counts show saved job pages, not forms filled or submitted.")
                .appFont(AppFont.body(12))
                .foregroundStyle(palette.textSecondary)
                .padding(.top, AppSpacing.xs)
        }
        .appFont(AppFont.body(13))
    }
}
