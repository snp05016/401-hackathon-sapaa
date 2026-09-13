import SwiftUI

struct DuplicateGroupDetailView: View {
    let group: SyncDuplicateGroup

    @EnvironmentObject private var store: AppStore
    @Environment(\.palette) private var palette

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(group.title)
                        .appFont(AppFont.display(30))
                        .foregroundStyle(palette.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(group.company)
                        .appFont(AppFont.body(13))
                        .foregroundStyle(palette.textSecondary)
                    Text("Review the original sources before deciding whether these records describe the same opportunity.")
                        .appFont(AppFont.body(13))
                        .foregroundStyle(palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.bottom, AppSpacing.sm)
                .hairline(palette)

                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    SectionHeading(title: "Reported sources")
                    ForEach(group.sources, id: \.self) { source in
                        Label(source, systemImage: "globe")
                            .appFont(AppFont.body(13))
                            .foregroundStyle(palette.textPrimary)
                            .frame(minHeight: 44, alignment: .leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .hairline(palette)
                    }
                }

                VStack(alignment: .leading, spacing: 0) {
                    SectionHeading(title: "Saved copies", subtitle: "Each copy remains a separate desktop record.")
                    ForEach(group.copies) { copy in
                        if let application = store.application(withId: copy.applicationId) {
                            NavigationLink(value: application) {
                                DuplicateCopyRow(copy: copy, application: application)
                            }
                            .buttonStyle(.plain)
                        } else {
                            DuplicateCopyRow(copy: copy, application: nil)
                        }
                    }
                }
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.bottom, AppSpacing.xxl)
        }
        .background(EditorialBackground())
        .navigationTitle("Duplicate sources")
        .navigationBarTitleDisplayMode(.inline)
    }
}
