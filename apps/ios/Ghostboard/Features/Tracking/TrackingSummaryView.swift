import SwiftUI

struct TrackingSummaryView: View {
    let deadlineCount: Int
    let staleCount: Int
    let duplicateCount: Int

    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(summaryTitle)
                .appFont(AppFont.display(28))
                .foregroundStyle(palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Text("A quiet spell is context, not a verdict. Deadlines and duplicate sources are shown exactly as reported by the desktop.")
                .appFont(AppFont.body(13))
                .foregroundStyle(palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.bottom, AppSpacing.sm)
        .hairline(palette)
        .accessibilityElement(children: .combine)
    }

    private var summaryTitle: String {
        let attentionCount = staleCount + duplicateCount
        if attentionCount == 0 && deadlineCount == 0 { return "The ledger is clear" }
        if attentionCount == 0 { return "\(deadlineCount) \(deadlineCount == 1 ? "deadline" : "deadlines") on record" }
        return "\(attentionCount) \(attentionCount == 1 ? "item" : "items") deserve context"
    }
}
