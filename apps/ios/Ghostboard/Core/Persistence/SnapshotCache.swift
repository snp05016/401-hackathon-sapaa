import Foundation

/// The last authoritative snapshot, written to disk so a cold launch shows the
/// pipeline immediately instead of an empty screen. It is a cache, never a
/// second source of truth: the desktop's next snapshot replaces it wholesale.
struct CachedSnapshot: Codable, Sendable {
    let data: SyncSnapshotData
    let syncedAt: Date
}

actor SnapshotCache {
    private let fileURL: URL
    private let encoder = SyncCoding.makeEncoder()
    private let decoder = SyncCoding.makeDecoder()

    init(fileName: String = "last-snapshot.json") {
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Ghostboard", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent(fileName)
    }

    func load() -> CachedSnapshot? {
        guard let contents = try? Data(contentsOf: fileURL) else { return nil }
        do {
            return try decoder.decode(CachedSnapshot.self, from: contents)
        } catch {
            // A cache written by an older build is discarded rather than fatal.
            AppLog.store.notice("Discarding an unreadable snapshot cache")
            try? FileManager.default.removeItem(at: fileURL)
            return nil
        }
    }

    func save(_ snapshot: CachedSnapshot) {
        do {
            let encoded = try encoder.encode(snapshot)
            try encoded.write(to: fileURL, options: .atomic)
        } catch {
            AppLog.store.notice("Could not write the snapshot cache")
        }
    }

    func clear() {
        try? FileManager.default.removeItem(at: fileURL)
    }
}
