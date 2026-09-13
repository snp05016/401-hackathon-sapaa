import SwiftUI

struct DesktopToolLedger: View {
    let summary: DesktopToolsSummary
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            DesktopToolOutcomeRow(
                title: "Discover",
                value: summary.discoverSavedCount,
                detail: "roles saved from JobSpy searches",
                symbol: "safari"
            )
            DesktopToolOutcomeRow(
                title: "Browser capture",
                value: summary.browserSavedCount,
                detail: "roles saved from supported job pages",
                symbol: "puzzlepiece.extension"
            )
            DesktopToolOutcomeRow(
                title: "Resume coverage",
                value: summary.resumeLinkedCount,
                detail: "applications linked to a resume",
                symbol: "doc.text"
            )
            DesktopToolOutcomeRow(
                title: "Recruiter signals",
                value: summary.recruiterSignalCount,
                detail: "signals received from the desktop",
                symbol: "waveform.badge.magnifyingglass",
                showsDivider: false
            )
        }
        .padding(.horizontal, AppSpacing.sm)
        .background(palette.surface)
        .overlay {
            RoundedRectangle(cornerRadius: AppRadius.card)
                .strokeBorder(palette.hairline)
        }
        .clipShape(.rect(cornerRadius: AppRadius.card))
    }
}
