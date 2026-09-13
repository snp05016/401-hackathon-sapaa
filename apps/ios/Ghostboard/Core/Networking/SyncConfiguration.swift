import Foundation
import Security

/// Where the desktop lives and the token that proves we may read it.
struct SyncConfiguration: Equatable, Sendable {
    var host: String
    var port: Int
    var token: String

    var isConfigured: Bool { !host.isEmpty && !token.isEmpty && (1...65_535).contains(port) }

    var socketURL: URL? {
        var components = URLComponents()
        components.scheme = "ws"
        components.host = host
        components.port = port
        components.path = SyncProtocol.path
        return components.url
    }

    static let unconfigured = SyncConfiguration(host: "", port: SyncProtocol.defaultPort, token: "")

    enum ValidationError: LocalizedError, Equatable {
        case missingHost
        case invalidHost
        case missingToken
        case invalidPort
        case loopbackHost
        case extensionBridgePort

        var errorDescription: String? {
            switch self {
            case .missingHost:
                return "Enter the Mac's LAN host shown under Profile → iPhone companion."
            case .invalidHost:
                return "Enter a valid Mac host, such as 192.168.1.20, macbook.local, or ws://192.168.1.20:4175/sync."
            case .missingToken:
                return "Enter the pairing token shown under Profile → iPhone companion in the desktop app."
            case .invalidPort:
                return "Enter a companion port from 1 to 65535. The default is 4175."
            case .loopbackHost:
                return "localhost and 127.0.0.1 point back to this iPhone. Use the Mac's LAN host shown under Profile → iPhone companion."
            case .extensionBridgePort:
                return "Port 4173 is the browser extension bridge. Use the iPhone companion port shown in the desktop app (default 4175)."
            }
        }
    }

    /// Accepts the common forms people copy from the desktop while persisting
    /// only the endpoint's host and port. The sync path and WebSocket scheme are
    /// supplied by `socketURL` so they cannot accidentally be duplicated.
    static func normalized(
        hostInput: String,
        portInput: String,
        tokenInput: String,
        allowLoopback: Bool = allowsLoopbackForCurrentBuild
    ) throws -> SyncConfiguration {
        let rawHost = hostInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawHost.isEmpty else { throw ValidationError.missingHost }

        let candidate = rawHost.contains("://") ? rawHost : "ws://\(rawHost)"
        guard let components = URLComponents(string: candidate),
              let scheme = components.scheme?.lowercased(),
              ["ws", "http"].contains(scheme),
              components.user == nil,
              components.password == nil,
              components.query == nil,
              components.fragment == nil,
              let componentHost = components.host?.trimmingCharacters(in: .whitespacesAndNewlines),
              !componentHost.isEmpty,
              ["", "/", SyncProtocol.path].contains(components.path),
              components.url != nil else {
            throw ValidationError.invalidHost
        }

        // Foundation may retain IPv6 URL brackets in `host`. URLComponents adds
        // them when rebuilding `socketURL`, so persist the address itself only.
        let parsedHost = componentHost.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        guard !parsedHost.isEmpty else { throw ValidationError.invalidHost }

        let parsedPort: Int
        if let embeddedPort = components.port {
            parsedPort = embeddedPort
        } else {
            let rawPort = portInput.trimmingCharacters(in: .whitespacesAndNewlines)
            guard let separatePort = Int(rawPort) else { throw ValidationError.invalidPort }
            parsedPort = separatePort
        }

        let normalizedToken = tokenInput.trimmingCharacters(in: .whitespacesAndNewlines)
        let configuration = SyncConfiguration(host: parsedHost, port: parsedPort, token: normalizedToken)
        if let error = configuration.validationError(allowLoopback: allowLoopback) { throw error }
        return configuration
    }

    func validationError(allowLoopback: Bool = allowsLoopbackForCurrentBuild) -> ValidationError? {
        let normalizedHost = host.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalizedHost.isEmpty { return .missingHost }
        if token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return .missingToken }
        if !(1...65_535).contains(port) { return .invalidPort }
        if port == 4_173 { return .extensionBridgePort }
        if !allowLoopback && Self.isLoopback(normalizedHost) { return .loopbackHost }
        return nil
    }

    static var allowsLoopbackForCurrentBuild: Bool {
#if targetEnvironment(simulator)
        true
#else
        false
#endif
    }

    private static func isLoopback(_ host: String) -> Bool {
        host == "localhost" || host == "::1" || host == "[::1]" || host.hasPrefix("127.")
    }
}

/// Host and port are preferences; the pairing token is a secret and lives in
/// the keychain, never in UserDefaults and never in a log line.
enum SyncConfigurationStore {
    private static let hostKey = "ghostboard.sync.host"
    private static let portKey = "ghostboard.sync.port"
    private static let keychainAccount = "sync-token"
    private static let keychainService = "com.ghostboard.companion"

    static func load() -> SyncConfiguration {
        let defaults = UserDefaults.standard
        let host = defaults.string(forKey: hostKey) ?? ""
        let storedPort = defaults.integer(forKey: portKey)
        return SyncConfiguration(
            host: host,
            port: storedPort > 0 ? storedPort : SyncProtocol.defaultPort,
            token: readToken() ?? ""
        )
    }

    static func save(_ configuration: SyncConfiguration) {
        let defaults = UserDefaults.standard
        defaults.set(configuration.host, forKey: hostKey)
        defaults.set(configuration.port, forKey: portKey)
        writeToken(configuration.token)
    }

    static func clear() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: hostKey)
        defaults.removeObject(forKey: portKey)
        deleteToken()
    }

    private static func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
        ]
    }

    private static func readToken() -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private static func writeToken(_ token: String) {
        guard !token.isEmpty else {
            deleteToken()
            return
        }
        let data = Data(token.utf8)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemUpdate(baseQuery() as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insert = baseQuery()
            insert.merge(attributes) { current, _ in current }
            SecItemAdd(insert as CFDictionary, nil)
        }
    }

    private static func deleteToken() {
        SecItemDelete(baseQuery() as CFDictionary)
    }
}
