import SwiftUI

extension SyncConnectionState {
    var shortLabel: String {
        switch self {
        case .idle: return "Not connected"
        case .connecting: return "Connecting"
        case .synchronizing: return "Syncing"
        case .connected: return "Connected"
        case .reconnecting: return "Reconnecting"
        case .failed: return "Unavailable"
        }
    }

    var isLive: Bool {
        if case .connected = self { return true }
        return false
    }

    func tint(in palette: AppPalette) -> Color {
        switch self {
        case .connected: return palette.success
        case .connecting, .synchronizing, .reconnecting: return palette.warning
        case .failed: return palette.accent
        case .idle: return palette.textMuted
        }
    }
}

/// A small, unobtrusive status treatment: a dot and a word in the nav bar.
struct ConnectionPill: View {
    let state: SyncConnectionState
    let lastSyncedAt: Date?
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Label {
            Text(state.shortLabel)
                .appFont(AppFont.metadata)
        } icon: {
            Image(systemName: state.symbolName)
                .font(.caption)
                .symbolEffect(.pulse, options: .repeating, isActive: pulsing && !reduceMotion)
        }
        .foregroundStyle(state.tint(in: palette))
        .padding(.horizontal, AppSpacing.sm)
        .frame(minHeight: 44)
        .background(palette.surface.opacity(0.92))
        .clipShape(.capsule)
        .overlay {
            Capsule().strokeBorder(palette.hairline)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Sync status")
        .accessibilityValue(accessibilityValue)
    }

    private var pulsing: Bool {
        switch state {
        case .connecting, .synchronizing, .reconnecting: return true
        default: return false
        }
    }

    private var accessibilityValue: String {
        guard let lastSyncedAt else { return state.shortLabel }
        return "\(state.shortLabel). Last synced \(AppFormat.relative(lastSyncedAt))."
    }
}

private extension SyncConnectionState {
    var symbolName: String {
        switch self {
        case .connected: return "checkmark.circle.fill"
        case .connecting, .synchronizing: return "arrow.triangle.2.circlepath"
        case .reconnecting: return "wifi.exclamationmark"
        case .failed: return "exclamationmark.triangle.fill"
        case .idle: return "wifi.slash"
        }
    }
}
