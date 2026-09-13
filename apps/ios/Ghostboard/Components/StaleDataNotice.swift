import SwiftUI

/// Appears only when the dossier is not live, preserving useful cached data and context.
struct StaleDataNotice: View {
    let state: SyncConnectionState
    let lastSyncedAt: Date?
    let hasData: Bool
    @Environment(\.palette) private var palette

    var body: some View {
        if let message {
            HStack(alignment: .top, spacing: AppSpacing.sm) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .foregroundStyle(state.tint(in: palette))
                    .accessibilityHidden(true)
                Text(message)
                    .appFont(AppFont.supporting)
                    .foregroundStyle(palette.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(AppSpacing.sm)
            .background(palette.surface)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(state.tint(in: palette))
                    .frame(width: 3)
            }
            .clipShape(.rect(cornerRadius: AppRadius.compact))
            .accessibilityLabel(message)
        }
    }

    private var message: String? {
        switch state {
        case .connected:
            return nil
        case .failed(let reason):
            return hasData
                ? "The desktop app isn't reachable. \(syncedLine)"
                : "The desktop app isn't reachable. \(reason)"
        case .idle:
            return hasData ? "Not connected. \(syncedLine)" : nil
        case .connecting, .synchronizing:
            return hasData ? nil : "Connecting to your desktop…"
        case .reconnecting(_, let reason):
            return hasData ? "Reconnecting. \(syncedLine)" : reason ?? "Reconnecting to your desktop…"
        }
    }

    private var syncedLine: String {
        guard let lastSyncedAt else { return "No data synced yet." }
        return "Showing data synced \(AppFormat.relative(lastSyncedAt))."
    }
}
