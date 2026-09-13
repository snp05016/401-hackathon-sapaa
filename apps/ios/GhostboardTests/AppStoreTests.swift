import XCTest
@testable import Ghostboard

final class AppStoreMergeTests: XCTestCase {
    private func application(id: String, updatedAt: String = "2026-03-02T12:00:00.000Z") -> JobApplication {
        JobApplication(
            id: id,
            company: "Acme",
            title: "Engineer",
            location: nil,
            jobUrl: "https://example.com/job",
            jobDescription: "",
            status: .applied,
            dateFound: Date(timeIntervalSince1970: 0),
            dateApplied: nil,
            deadline: nil,
            lastActivityAt: Date(timeIntervalSince1970: 0),
            followUpOn: false,
            followUpDismissedAt: nil,
            nextAction: nil,
            nextActionDate: nil,
            resumeId: nil,
            source: "extension",
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    func testMergeAppliesUpsertsAndDeletions() {
        let current = [application(id: "a"), application(id: "b")]
        let diff = SyncCollectionDiff(upserted: [application(id: "c")], deletedIds: ["a"])

        let merged = AppStore.merge(current, diff: diff)

        XCTAssertEqual(Set(merged.map(\.id)), ["b", "c"])
    }

    func testMergeReturnsAStableOrderSoRowsDoNotReshuffle() {
        let current = [application(id: "c"), application(id: "a"), application(id: "b")]
        let diff = SyncCollectionDiff(upserted: [application(id: "d")], deletedIds: [])

        let once = AppStore.merge(current, diff: diff)
        let twice = AppStore.merge(once, diff: diff)

        XCTAssertEqual(once.map(\.id), ["a", "b", "c", "d"])
        XCTAssertEqual(twice.map(\.id), once.map(\.id))
    }

    func testMergeIsIdempotentForARepeatedUpsert() {
        let current = [application(id: "a")]
        let diff = SyncCollectionDiff(upserted: [application(id: "a")], deletedIds: [])

        let once = AppStore.merge(current, diff: diff)
        let twice = AppStore.merge(once, diff: diff)

        XCTAssertEqual(once.count, 1)
        XCTAssertEqual(twice.count, 1)
    }

    func testDeletingAnAbsentRowIsHarmless() {
        let merged = AppStore.merge([application(id: "a")], diff: SyncCollectionDiff<JobApplication>(upserted: [], deletedIds: ["zzz"]))

        XCTAssertEqual(merged.map(\.id), ["a"])
    }
}

@MainActor
final class AppStoreSynchronizationTests: XCTestCase {
    private func makeStore() -> AppStore {
        AppStore(cache: SnapshotCache(fileName: "test-snapshot-\(UUID().uuidString).json"))
    }

    private func snapshot(revision: Int, sessionId: String = "session-1", applications: [JobApplication] = []) -> SyncSnapshotMessage {
        SyncSnapshotMessage(
            sessionId: sessionId,
            revision: revision,
            generatedAt: Date(),
            data: SyncSnapshotData(
                applications: applications,
                events: [],
                staleness: [],
                deadlines: [],
                today: .empty,
                followUps: [],
                duplicateGroups: [],
                recruiterSignals: [],
                analytics: .empty
            )
        )
    }

    func testSnapshotBecomesTheAuthoritativeState() {
        let store = makeStore()
        store.applyForTesting(snapshot: snapshot(revision: 5))

        XCTAssertTrue(store.hasLoadedOnce)
        XCTAssertFalse(store.isShowingCachedData)
    }

    func testStaleAndDuplicateChangesAreIgnored() {
        let store = makeStore()
        store.applyForTesting(snapshot: snapshot(revision: 5))

        let stale = change(revision: 4)
        store.applyForTesting(change: stale)
        XCTAssertEqual(store.revisionForTesting, 5)

        let next = change(revision: 6)
        store.applyForTesting(change: next)
        XCTAssertEqual(store.revisionForTesting, 6)

        store.applyForTesting(change: next)
        XCTAssertEqual(store.revisionForTesting, 6)
    }

    func testAGapInRevisionsDoesNotAdvanceState() {
        let store = makeStore()
        store.applyForTesting(snapshot: snapshot(revision: 1))

        store.applyForTesting(change: change(revision: 7))

        XCTAssertEqual(store.revisionForTesting, 1)
    }

    func testChangeFramesAreIgnoredWhileASnapshotIsPending() {
        let store = makeStore()
        store.applyForTesting(snapshot: snapshot(revision: 1))

        // A gap puts the store into "awaiting snapshot". Frames that arrive in
        // that window belong to a revision line we have abandoned.
        store.applyForTesting(change: change(revision: 7))
        XCTAssertEqual(store.revisionForTesting, 1)

        store.applyForTesting(change: change(revision: 8))
        XCTAssertEqual(store.revisionForTesting, 1)

        // The snapshot re-anchors us, and the next frame applies normally.
        store.applyForTesting(snapshot: snapshot(revision: 9))
        XCTAssertEqual(store.revisionForTesting, 9)

        store.applyForTesting(change: change(revision: 10))
        XCTAssertEqual(store.revisionForTesting, 10)
    }

    func testABurstOfSequentialChangesAllApply() {
        let store = makeStore()
        store.applyForTesting(snapshot: snapshot(revision: 0))

        for revision in 1...25 {
            store.applyForTesting(change: change(revision: revision))
        }

        XCTAssertEqual(store.revisionForTesting, 25)
    }

    func testSnapshotReplacesStateWholesaleRatherThanMerging() {
        let store = makeStore()
        store.applyForTesting(snapshot: snapshot(revision: 1, applications: [sample(id: "a"), sample(id: "b")]))
        XCTAssertEqual(store.applications.count, 2)

        // The desktop is authoritative: a snapshot listing one row means one row.
        store.applyForTesting(snapshot: snapshot(revision: 2, applications: [sample(id: "a")]))
        XCTAssertEqual(store.applications.map(\.id), ["a"])
    }

    func testDeletionsInAChangeFrameRemoveRows() {
        let store = makeStore()
        store.applyForTesting(snapshot: snapshot(revision: 1, applications: [sample(id: "a"), sample(id: "b")]))

        var frame = change(revision: 2)
        frame = SyncChangeMessage(
            sessionId: frame.sessionId,
            revision: frame.revision,
            changedAt: frame.changedAt,
            applications: SyncCollectionDiff(upserted: [], deletedIds: ["b"]),
            events: SyncCollectionDiff(upserted: [], deletedIds: []),
            staleness: [], deadlines: [], today: .empty, followUps: [],
            duplicateGroups: [], recruiterSignals: [], analytics: .empty
        )
        store.applyForTesting(change: frame)

        XCTAssertEqual(store.applications.map(\.id), ["a"])
    }

    private func sample(id: String) -> JobApplication {
        JobApplication(
            id: id, company: "Acme", title: "Engineer", location: nil,
            jobUrl: "https://example.com/job", jobDescription: "", status: .applied,
            dateFound: Date(timeIntervalSince1970: 0), dateApplied: nil, deadline: nil,
            lastActivityAt: Date(timeIntervalSince1970: 0), followUpOn: false,
            followUpDismissedAt: nil, nextAction: nil, nextActionDate: nil, resumeId: nil,
            source: "extension", createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
    }

    func testAChangeFromAnotherServerSessionIsRejected() {
        let store = makeStore()
        store.applyForTesting(snapshot: snapshot(revision: 1))

        store.applyForTesting(change: change(revision: 2, sessionId: "restarted"))

        XCTAssertEqual(store.revisionForTesting, 1)
    }

    private func change(revision: Int, sessionId: String = "session-1") -> SyncChangeMessage {
        SyncChangeMessage(
            sessionId: sessionId,
            revision: revision,
            changedAt: Date(),
            applications: SyncCollectionDiff(upserted: [], deletedIds: []),
            events: SyncCollectionDiff(upserted: [], deletedIds: []),
            staleness: [],
            deadlines: [],
            today: .empty,
            followUps: [],
            duplicateGroups: [],
            recruiterSignals: [],
            analytics: .empty
        )
    }
}
