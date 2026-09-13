import Foundation
import SwiftUI

/// The single synchronised application state. Screens derive what they render
/// from this; nothing else consumes raw WebSocket frames.
@MainActor
final class AppStore: ObservableObject {
    @Published private(set) var applications: [JobApplication] = []
    @Published private(set) var events: [ApplicationEvent] = []
    @Published private(set) var staleness: [String: SyncStaleness] = [:]
    @Published private(set) var deadlines: [String: SyncDeadline] = [:]
    @Published private(set) var today: SyncTodaySummary = .empty
    @Published private(set) var followUps: [SyncFollowUp] = []
    @Published private(set) var duplicateGroups: [SyncDuplicateGroup] = []
    /// Applications the desktop flags as saved from more than one website.
    private(set) var duplicateApplicationIds: Set<String> = []
    @Published private(set) var recruiterSignals: [SyncRecruiterSignal] = []
    @Published private(set) var analytics: SyncAnalytics = .empty

    @Published private(set) var connectionState: SyncConnectionState = .idle
    @Published private(set) var lastSyncedAt: Date?
    /// True while the screen is showing cache rather than a live snapshot.
    @Published private(set) var isShowingCachedData = false
    @Published private(set) var hasLoadedOnce = false

    /// True when there is no desktop to load from, so the UI offers setup
    /// rather than an indefinite spinner.
    var needsSetup: Bool { !configuration.isConfigured && !hasLoadedOnce }

    @Published var configuration: SyncConfiguration = .unconfigured
    @Published var theme: AppTheme = .system {
        didSet { UserDefaults.standard.set(theme.rawValue, forKey: Self.themeKey) }
    }

    private static let themeKey = "ghostboard.theme"

    private let client: SyncClient
    private let cache: SnapshotCache
    private var eventPump: Task<Void, Never>?
    fileprivate var sessionId: String?
    fileprivate var revision = 0
    /// Set while a fresh snapshot has been requested. Change frames that arrive
    /// in the meantime are for a revision line we have already abandoned, so
    /// applying them would either be rejected as a gap or, worse, accepted on
    /// top of state the snapshot is about to replace.
    private var isAwaitingSnapshot = false
    private var lastPersistedAt: Date?

    /// Events keyed by application, newest first — recomputed only when the
    /// event list actually changes, never inside a view body.
    private(set) var eventsByApplication: [String: [ApplicationEvent]] = [:]

    init(client: SyncClient = SyncClient(), cache: SnapshotCache = SnapshotCache()) {
        self.client = client
        self.cache = cache
        configuration = SyncConfigurationStore.load()
        if let stored = UserDefaults.standard.string(forKey: Self.themeKey), let restored = AppTheme(rawValue: stored) {
            theme = restored
        }
    }

    // MARK: - Lifecycle

    func start() async {
        if eventPump == nil {
            let stream = await client.events()
            eventPump = Task { [weak self] in
                for await event in stream {
                    self?.handle(event)
                }
            }
        }
        await loadCacheIfNeeded()
        if let validationError = configuration.validationError() {
            connectionState = .failed(reason: validationError.localizedDescription)
            return
        }
        await client.start(configuration: configuration)
    }

    func updateConfiguration(_ newConfiguration: SyncConfiguration) async {
        configuration = newConfiguration
        SyncConfigurationStore.save(newConfiguration)
        await client.start(configuration: newConfiguration)
    }

    func forgetDesktop() async {
        await client.stop()
        SyncConfigurationStore.clear()
        await cache.clear()
        configuration = .unconfigured
        applications = []
        events = []
        eventsByApplication = [:]
        staleness = [:]
        deadlines = [:]
        today = .empty
        followUps = []
        duplicateGroups = []
        duplicateApplicationIds = []
        recruiterSignals = []
        analytics = .empty
        lastSyncedAt = nil
        hasLoadedOnce = false
        isShowingCachedData = false
        connectionState = .idle
    }

    /// Pull-to-refresh asks the desktop for a fresh authoritative snapshot.
    func refresh() async {
        await client.refresh()
    }

    func enterBackground() async {
        // Last chance to write the cache before the process may be suspended.
        persistCache(force: true)
        await client.suspendForBackground()
    }

    func enterForeground() async {
        guard configuration.isConfigured else { return }
        await client.refresh()
    }

    // MARK: - Event handling

    private func handle(_ event: SyncClientEvent) {
        switch event {
        case .state(let state):
            connectionState = state
            if case .connected = state {} else if hasLoadedOnce {
                isShowingCachedData = true
            }

        case .snapshot(let message):
            apply(snapshot: message)

        case .change(let message):
            apply(change: message)

        case .decodeFailure:
            // A frame we cannot read means our view may be incomplete; ask for
            // the authoritative state rather than silently diverging.
            requestSnapshot(reason: "a frame could not be decoded")
        }
    }

    /// Requests an authoritative snapshot at most once until it arrives.
    private func requestSnapshot(reason: String) {
        guard !isAwaitingSnapshot else { return }
        isAwaitingSnapshot = true
        AppLog.store.notice("Requesting a fresh snapshot: \(reason, privacy: .public)")
        Task { [client] in await client.refresh() }
    }

    fileprivate func apply(snapshot message: SyncSnapshotMessage) {
        isAwaitingSnapshot = false
        sessionId = message.sessionId
        revision = message.revision
        applications = message.data.applications
        events = message.data.events
        applyDerived(
            staleness: message.data.staleness,
            deadlines: message.data.deadlines,
            today: message.data.today,
            followUps: message.data.followUps,
            duplicateGroups: message.data.duplicateGroups,
            recruiterSignals: message.data.recruiterSignals,
            analytics: message.data.analytics
        )
        rebuildEventIndex()
        markSynced(at: message.generatedAt)
        persistCache(force: true)
    }

    fileprivate func apply(change message: SyncChangeMessage) {
        // Anything that arrives while a snapshot is in flight belongs to a
        // revision line we have already abandoned.
        guard !isAwaitingSnapshot else { return }
        // A different server session, or a revision that went backwards or
        // skipped, means our incremental view cannot be trusted.
        guard message.sessionId == sessionId else {
            requestSnapshot(reason: "the desktop restarted")
            return
        }
        guard message.revision > revision else {
            AppLog.store.debug("Ignoring a stale or duplicate change frame")
            return
        }
        guard message.revision == revision + 1 else {
            requestSnapshot(reason: "a revision was missed")
            return
        }
        revision = message.revision

        applications = Self.merge(applications, diff: message.applications)
        events = Self.merge(events, diff: message.events)
        applyDerived(
            staleness: message.staleness,
            deadlines: message.deadlines,
            today: message.today,
            followUps: message.followUps,
            duplicateGroups: message.duplicateGroups,
            recruiterSignals: message.recruiterSignals,
            analytics: message.analytics
        )
        rebuildEventIndex()
        markSynced(at: message.changedAt)
        persistCache()
    }

    private func applyDerived(
        staleness newStaleness: [SyncStaleness],
        deadlines newDeadlines: [SyncDeadline],
        today newToday: SyncTodaySummary,
        followUps newFollowUps: [SyncFollowUp],
        duplicateGroups newDuplicateGroups: [SyncDuplicateGroup],
        recruiterSignals newSignals: [SyncRecruiterSignal],
        analytics newAnalytics: SyncAnalytics
    ) {
        staleness = Dictionary(newStaleness.map { ($0.applicationId, $0) }, uniquingKeysWith: { _, last in last })
        deadlines = Dictionary(newDeadlines.map { ($0.applicationId, $0) }, uniquingKeysWith: { _, last in last })
        today = newToday
        followUps = newFollowUps
        duplicateGroups = newDuplicateGroups
        duplicateApplicationIds = Set(newDuplicateGroups.flatMap { $0.copies.map(\.applicationId) })
        recruiterSignals = newSignals
        analytics = newAnalytics
    }

    private func markSynced(at date: Date) {
        lastSyncedAt = date
        hasLoadedOnce = true
        isShowingCachedData = false
    }

    private func rebuildEventIndex() {
        var index: [String: [ApplicationEvent]] = [:]
        for event in events {
            index[event.applicationId, default: []].append(event)
        }
        for key in index.keys {
            index[key]?.sort { $0.occurredAt > $1.occurredAt }
        }
        eventsByApplication = index
    }

    private func persistCache(force: Bool = false) {
        let now = Date()
        if !force, let lastPersistedAt, now.timeIntervalSince(lastPersistedAt) < 5 { return }
        lastPersistedAt = now
        let payload = CachedSnapshot(
            data: SyncSnapshotData(
                applications: applications,
                events: events,
                staleness: Array(staleness.values),
                deadlines: Array(deadlines.values),
                today: today,
                followUps: followUps,
                duplicateGroups: duplicateGroups,
                recruiterSignals: recruiterSignals,
                analytics: analytics
            ),
            syncedAt: lastSyncedAt ?? Date()
        )
        Task { [cache] in await cache.save(payload) }
    }

    private func loadCacheIfNeeded() async {
        guard !hasLoadedOnce, let cached = await cache.load() else { return }
        guard !hasLoadedOnce else { return }
        applications = cached.data.applications
        events = cached.data.events
        applyDerived(
            staleness: cached.data.staleness,
            deadlines: cached.data.deadlines,
            today: cached.data.today,
            followUps: cached.data.followUps,
            duplicateGroups: cached.data.duplicateGroups,
            recruiterSignals: cached.data.recruiterSignals,
            analytics: cached.data.analytics
        )
        rebuildEventIndex()
        lastSyncedAt = cached.syncedAt
        hasLoadedOnce = true
        isShowingCachedData = true
    }

    /// Applies an incremental diff to an id-keyed collection.
    nonisolated static func merge<Element: Identifiable & Codable & Sendable>(
        _ current: [Element],
        diff: SyncCollectionDiff<Element>
    ) -> [Element] where Element.ID == String {
        var byId = Dictionary(current.map { ($0.id, $0) }, uniquingKeysWith: { _, last in last })
        for item in diff.upserted { byId[item.id] = item }
        for id in diff.deletedIds { byId.removeValue(forKey: id) }
        // Dictionary order is not stable across mutations; without this, rows
        // would jump on every change frame.
        return byId.values.sorted { $0.id < $1.id }
    }

    // MARK: - Derived reads

    func stalenessInfo(for applicationId: String) -> SyncStaleness? { staleness[applicationId] }

    func deadlineInfo(for applicationId: String) -> SyncDeadline? { deadlines[applicationId] }

    func timeline(for applicationId: String) -> [ApplicationEvent] { eventsByApplication[applicationId] ?? [] }

    func application(withId id: String) -> JobApplication? {
        applications.first { $0.id == id }
    }

    var applicationsByRecency: [JobApplication] {
        applications.sorted { $0.lastActivityAt > $1.lastActivityAt }
    }

    var staleApplications: [JobApplication] {
        applications
            .filter { staleness[$0.id]?.isStale == true }
            .sorted { (staleness[$0.id]?.daysSinceLastActivity ?? 0) > (staleness[$1.id]?.daysSinceLastActivity ?? 0) }
    }

    var recentEvents: [ApplicationEvent] {
        events.sorted { $0.occurredAt > $1.occurredAt }
    }

    func applications(in stage: ApplicationStage) -> [JobApplication] {
        applications
            .filter { $0.status == stage }
            .sorted { $0.lastActivityAt > $1.lastActivityAt }
    }
}

// MARK: - Test seams

extension AppStore {
    /// Exposes snapshot/change application without a live socket. Test-only;
    /// nothing in the shipping UI calls these.
    func applyForTesting(snapshot message: SyncSnapshotMessage) {
        apply(snapshot: message)
    }

    func applyForTesting(change message: SyncChangeMessage) {
        apply(change: message)
    }

    var revisionForTesting: Int { revision }
}
