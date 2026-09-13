import SwiftUI
import UIKit

struct FollowUpDetailView: View {
    let followUp: SyncFollowUp

    @EnvironmentObject private var store: AppStore
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isCopied = false
    @State private var resetTask: Task<Void, Never>?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(followUp.kindLabel)
                        .appFont(AppFont.body(12))
                        .foregroundStyle(palette.warning)
                    Text(followUp.messageTitle)
                        .appFont(AppFont.display(32))
                        .foregroundStyle(palette.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(followUp.title) at \(followUp.company)")
                        .appFont(AppFont.body(13))
                        .foregroundStyle(palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.bottom, AppSpacing.sm)
                .hairline(palette)

                Text(followUp.messageDescription)
                    .appFont(AppFont.body(13))
                    .foregroundStyle(palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                Text(followUp.messageBody)
                    .appFont(AppFont.body(14))
                    .foregroundStyle(palette.textPrimary)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, AppSpacing.md)
                    .padding(.horizontal, AppSpacing.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: AppRadius.card)
                            .strokeBorder(palette.hairline, lineWidth: 1)
                    )

                Button(
                    isCopied ? "Message copied" : "Copy message",
                    systemImage: isCopied ? "checkmark" : "doc.on.doc",
                    action: copyMessage
                )
                .buttonStyle(.borderedProminent)
                .tint(palette.accent)
                .frame(minHeight: 44)
                .accessibilityHint("Copies the draft so you can edit and send it in another app")

                if let application = store.application(withId: followUp.applicationId) {
                    NavigationLink(value: application) {
                        Label("Open application history", systemImage: "clock.arrow.circlepath")
                            .appFont(AppFont.body(13))
                            .foregroundStyle(palette.accent)
                            .frame(minHeight: 44)
                    }
                    .accessibilityHint("Shows the job and its recorded activity")
                }

                Label(
                    "This is a draft only. Review it before you send anything.",
                    systemImage: "person.crop.circle.badge.checkmark"
                )
                .appFont(AppFont.body(12))
                .foregroundStyle(palette.textSecondary)
            }
            .padding(.horizontal, AppSpacing.md)
            .padding(.bottom, AppSpacing.xxl)
        }
        .background(EditorialBackground())
        .navigationTitle("Draft")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear(perform: cancelReset)
    }

    private func copyMessage() {
        UIPasteboard.general.string = followUp.messageBody
        resetTask?.cancel()

        if reduceMotion {
            isCopied = true
        } else {
            withAnimation(AppMotion.quick) { isCopied = true }
        }

        resetTask = Task { @MainActor in
            do {
                try await Task.sleep(for: .seconds(2))
            } catch {
                return
            }
            if reduceMotion {
                isCopied = false
            } else {
                withAnimation(AppMotion.quick) { isCopied = false }
            }
        }
    }

    private func cancelReset() {
        resetTask?.cancel()
        resetTask = nil
    }
}
