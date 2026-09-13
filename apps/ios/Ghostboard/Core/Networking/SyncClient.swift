import Foundation
import Network

enum SyncConnectionState: Equatable, Sendable {
    case idle
    case connecting
    case synchronizing
    case connected
    case reconnecting(attempt: Int, reason: String?)
    /// Terminal for this configuration: retrying cannot fix it.
    case failed(reason: String)
}

enum SyncClientEvent: Sendable {
    case state(SyncConnectionState)
    case snapshot(SyncSnapshotMessage)
    case change(SyncChangeMessage)
    case decodeFailure
}

/// Owns the WebSocket lifecycle: handshake, heartbeat, backoff, and the
/// network-path changes that make a phone drop a LAN socket.
///
/// The client never sends a product-data mutation. Its entire outbound
/// vocabulary is `sync-hello`, `sync-pong`, and `sync-request-snapshot`.
actor SyncClient {
    private let clientId: String
    private let decoder = SyncCoding.makeDecoder()
    private let encoder = SyncCoding.makeEncoder()
    private let session: URLSession

    private var configuration: SyncConfiguration = .unconfigured
    private var task: URLSessionWebSocketTask?
    private var receiveLoop: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?
    private var handshakeTimeoutTask: Task<Void, Never>?
    private var pathMonitor: NWPathMonitor?
    private var isRunning = false
    private var attempt = 0
    private var continuation: AsyncStream<SyncClientEvent>.Continuation?

    /// A stable identifier so the desktop can tell repeat connections apart.
    init(clientId: String = SyncClient.persistentClientId()) {
        self.clientId = clientId
        let sessionConfiguration = URLSessionConfiguration.default
        sessionConfiguration.waitsForConnectivity = false
        sessionConfiguration.timeoutIntervalForRequest = 15
        session = URLSession(configuration: sessionConfiguration)
    }

    static func persistentClientId() -> String {
        let key = "ghostboard.sync.clientId"
        if let existing = UserDefaults.standard.string(forKey: key) { return existing }
        let generated = UUID().uuidString
        UserDefaults.standard.set(generated, forKey: key)
        return generated
    }

    func events() -> AsyncStream<SyncClientEvent> {
        let (stream, continuation) = AsyncStream<SyncClientEvent>.makeStream()
        self.continuation?.finish()
        self.continuation = continuation
        return stream
    }

    func start(configuration: SyncConfiguration) {
        self.configuration = configuration
        if let validationError = configuration.validationError() {
            fail(reason: validationError.localizedDescription)
            return
        }
        guard !isRunning else {
            // A configuration change mid-flight restarts from a clean socket.
            restart()
            return
        }
        isRunning = true
        attempt = 0
        startPathMonitor()
        connect()
    }

    func stop() {
        isRunning = false
        cancelReconnect()
        pathMonitor?.cancel()
        pathMonitor = nil
        closeSocket()
        emit(.state(.idle))
    }

    /// Called when the app returns to the foreground, or on pull-to-refresh.
    func refresh() {
        guard isRunning else { return }
        if task == nil {
            attempt = 0
            connect()
        } else {
            send(SyncSimpleClientMessage.requestSnapshot)
        }
    }

    /// iOS suspends sockets in the background; drop ours deliberately so the
    /// next foreground gets a clean handshake and a fresh authoritative snapshot.
    func suspendForBackground() {
        guard isRunning else { return }
        cancelReconnect()
        closeSocket()
        // The socket is gone, so the UI must stop claiming live data.
        emit(.state(.reconnecting(attempt: attempt, reason: "Sync paused while the app is in the background.")))
    }

    // MARK: - Connection

    private func restart() {
        attempt = 0
        connect()
    }

    private func connect() {
        guard isRunning else { return }
        guard let url = configuration.socketURL else {
            fail(reason: "The companion address is invalid. Re-enter the host and companion port shown in the desktop app.")
            return
        }
        // Every path into connect() tears down first. Without this a pending
        // backoff timer firing after a foreground refresh leaves two live
        // sockets, both authenticated on the desktop.
        closeSocket()
        cancelReconnect()
        let attemptNumber = attempt
        emit(.state(attemptNumber == 0 ? .connecting : .reconnecting(attempt: attemptNumber, reason: nil)))
        AppLog.sync.info("Connecting to companion channel (attempt \(attemptNumber, privacy: .public))")

        let socket = session.webSocketTask(with: url)
        task = socket
        socket.resume()

        send(SyncHelloMessage(protocolVersion: SyncProtocol.version, token: configuration.token, clientId: clientId))
        emit(.state(.synchronizing))
        startHandshakeTimeout(for: socket)

        receiveLoop = Task { [weak self] in
            await self?.runReceiveLoop(socket)
        }
    }

    private func runReceiveLoop(_ socket: URLSessionWebSocketTask) async {
        while !Task.isCancelled {
            do {
                let message = try await socket.receive()
                guard task === socket else { return }
                handle(message)
            } catch {
                guard task === socket, isRunning else { return }
                AppLog.sync.notice("Companion channel dropped: \(error.localizedDescription, privacy: .private)")
                closeSocket()
                scheduleReconnect(reason: connectionFailureReason)
                return
            }
        }
    }

    private func handle(_ message: URLSessionWebSocketTask.Message) {
        let data: Data
        switch message {
        case .string(let text): data = Data(text.utf8)
        case .data(let payload): data = payload
        @unknown default: return
        }

        let decoded: SyncServerMessage
        do {
            decoded = try decoder.decode(SyncServerMessage.self, from: data)
        } catch {
            AppLog.sync.error("Could not decode a server frame: \(String(describing: error), privacy: .public)")
            emit(.decodeFailure)
            return
        }

        switch decoded {
        case .welcome(let welcome):
            cancelHandshakeTimeout()
            guard welcome.protocolVersion == SyncProtocol.version else {
                fail(reason: "This app speaks sync protocol \(SyncProtocol.version); the desktop speaks \(welcome.protocolVersion). Update whichever is older.")
                return
            }
            attempt = 0
            emit(.state(.synchronizing))

        case .snapshot(let snapshot):
            cancelHandshakeTimeout()
            emit(.snapshot(snapshot))
            emit(.state(.connected))

        case .change(let change):
            emit(.change(change))
            emit(.state(.connected))

        case .error(let error):
            AppLog.sync.error("Server refused the connection: \(error.code, privacy: .public)")
            switch error.code {
            case "unauthorized":
                fail(reason: "The desktop rejected this pairing token.")
            case "protocol_version_mismatch":
                fail(reason: error.message)
            default:
                closeSocket()
                scheduleReconnect(reason: "The desktop ended pairing before sync completed. Check the companion host, port, and token.")
            }

        case .ping:
            send(SyncSimpleClientMessage.pong)

        case .unknown(let type):
            AppLog.sync.debug("Ignoring unknown frame type \(type, privacy: .public)")
        }
    }

    private func fail(reason: String) {
        isRunning = false
        cancelReconnect()
        pathMonitor?.cancel()
        pathMonitor = nil
        closeSocket()
        emit(.state(.failed(reason: reason)))
    }

    private func send(_ message: some Encodable) {
        guard let socket = task, let data = try? encoder.encode(message), let text = String(data: data, encoding: .utf8) else {
            return
        }
        socket.send(.string(text)) { error in
            guard let error else { return }
            AppLog.sync.notice("Could not send a frame: \(error.localizedDescription, privacy: .private)")
        }
    }

    private func closeSocket() {
        cancelHandshakeTimeout()
        receiveLoop?.cancel()
        receiveLoop = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func scheduleReconnect(reason: String? = nil) {
        guard isRunning, reconnectTask == nil else { return }
        attempt += 1
        let delay = Self.backoffDelay(attempt: attempt)
        emit(.state(.reconnecting(attempt: attempt, reason: reason)))
        reconnectTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            await self?.reconnectFired()
        }
    }

    private func reconnectFired() {
        reconnectTask = nil
        guard isRunning else { return }
        connect()
    }

    private func cancelReconnect() {
        reconnectTask?.cancel()
        reconnectTask = nil
    }

    private var connectionFailureReason: String {
        "Couldn't reach the desktop at \(configuration.host):\(configuration.port). Keep the desktop app open and make sure both devices are on the same Wi-Fi. Mobile uses the companion port (default 4175)."
    }

    private func startHandshakeTimeout(for socket: URLSessionWebSocketTask) {
        cancelHandshakeTimeout()
        handshakeTimeoutTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(10))
            guard !Task.isCancelled else { return }
            await self?.handshakeTimedOut(socket)
        }
    }

    private func handshakeTimedOut(_ socket: URLSessionWebSocketTask) {
        guard task === socket, isRunning else { return }
        closeSocket()
        scheduleReconnect(reason: "The desktop did not complete pairing within 10 seconds. Check the iPhone companion host, port, and token.")
    }

    private func cancelHandshakeTimeout() {
        handshakeTimeoutTask?.cancel()
        handshakeTimeoutTask = nil
    }

    /// Exponential backoff with jitter, capped so a sleeping Mac does not turn
    /// into a hot retry loop on the phone.
    static func backoffDelay(attempt: Int, maximum: Double = 30) -> Double {
        let base = min(maximum, pow(2, Double(max(0, attempt - 1))))
        let jitter = Double.random(in: 0...(base * 0.3))
        return min(maximum, base + jitter)
    }

    private func startPathMonitor() {
        guard pathMonitor == nil else { return }
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            let satisfied = path.status == .satisfied
            Task { await self?.pathChanged(satisfied: satisfied) }
        }
        monitor.start(queue: DispatchQueue(label: "com.ghostboard.companion.path"))
        pathMonitor = monitor
    }

    private func pathChanged(satisfied: Bool) {
        guard isRunning else { return }
        if satisfied {
            // Coming back onto a network invalidates any pending backoff.
            if task == nil {
                cancelReconnect()
                attempt = 0
                connect()
            }
        } else {
            closeSocket()
            emit(.state(.reconnecting(attempt: attempt, reason: "No network connection. Reconnect both devices to the same Wi-Fi.")))
        }
    }

    private func emit(_ event: SyncClientEvent) {
        continuation?.yield(event)
    }
}
