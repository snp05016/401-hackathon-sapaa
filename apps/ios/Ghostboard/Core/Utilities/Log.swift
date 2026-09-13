import Foundation
import OSLog

/// Connection diagnostics only. Application content — descriptions, subjects,
/// senders, tokens — is never logged.
enum AppLog {
    static let sync = Logger(subsystem: "com.ghostboard.companion", category: "sync")
    static let store = Logger(subsystem: "com.ghostboard.companion", category: "store")
}
