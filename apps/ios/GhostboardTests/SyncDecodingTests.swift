import XCTest
@testable import Ghostboard

final class SyncDecodingTests: XCTestCase {
    private let decoder = SyncCoding.makeDecoder()

    func testDecodesASnapshotFrame() throws {
        let json = """
        {
          "type": "sync-snapshot",
          "sessionId": "session-1",
          "revision": 3,
          "generatedAt": "2026-03-20T12:00:00.000Z",
          "data": {
            "applications": [{
              "id": "app-1",
              "company": "Acme",
              "title": "Engineer",
              "location": null,
              "jobUrl": "https://example.com/job",
              "jobDescription": "",
              "status": "applied",
              "dateFound": "2026-03-01T12:00:00.000Z",
              "dateApplied": "2026-03-02T12:00:00.000Z",
              "deadline": "2026-03-25",
              "lastActivityAt": "2026-03-02T12:00:00.000Z",
              "followUpOn": false,
              "followUpDismissedAt": null,
              "nextAction": null,
              "nextActionDate": null,
              "resumeId": null,
              "source": "extension",
              "createdAt": "2026-03-01T12:00:00.000Z",
              "updatedAt": "2026-03-02T12:00:00.000Z"
            }],
            "events": [{
              "id": "event-1",
              "applicationId": "app-1",
              "type": "stage_changed",
              "title": "Moved to Applied",
              "description": null,
              "occurredAt": "2026-03-02T12:00:00.000Z",
              "metadata": null
            }],
            "staleness": [{
              "applicationId": "app-1",
              "isStale": true,
              "daysSinceLastActivity": 18,
              "suggestedAction": "FOLLOW_UP_APPLICATION"
            }],
            "deadlines": [{
              "applicationId": "app-1",
              "color": "green",
              "daysRemaining": 5,
              "label": "Due in 5 days"
            }],
            "today": {
              "total": 1, "applied": 1, "interviewing": 0,
              "dueToday": 0, "upcoming": 1, "overdue": 0, "noDeadline": 0, "followUpOn": 1
            },
            "followUps": [{
              "applicationId": "app-1",
              "company": "Acme",
              "title": "Engineer",
              "kind": "application",
              "kindLabel": "Following up on application",
              "messageTitle": "Follow up on your application",
              "messageDescription": "Two weeks have passed.",
              "messageBody": "Hi there"
            }],
            "duplicateGroups": [{
              "key": "acme|engineer",
              "company": "Acme",
              "title": "Engineer",
              "sources": ["extension", "manual"],
              "copies": [
                {"applicationId": "app-1", "source": "extension", "savedAt": "2026-03-01T12:00:00.000Z"}
              ]
            }],
            "recruiterSignals": [],
            "analytics": {
              "totalApplications": 1,
              "stageCounts": [{"stage": "applied", "count": 1}],
              "appliedThisWeek": 0,
              "appliedLast7Days": [0, 0, 0, 0, 0, 0, 0],
              "activeApplications": 1,
              "responseRate": 0,
              "interviewRate": 0,
              "offerRate": 0,
              "staleCount": 1,
              "averageDaysToFirstResponse": null,
              "sourceCounts": [{"source": "extension", "count": 1}]
            }
          }
        }
        """

        let message = try decoder.decode(SyncServerMessage.self, from: Data(json.utf8))
        guard case .snapshot(let snapshot) = message else {
            return XCTFail("Expected a snapshot frame")
        }

        XCTAssertEqual(snapshot.revision, 3)
        XCTAssertEqual(snapshot.data.applications.first?.status, .applied)
        XCTAssertEqual(snapshot.data.applications.first?.deadline, "2026-03-25")
        XCTAssertNil(snapshot.data.applications.first?.location)
        XCTAssertEqual(snapshot.data.events.first?.type, .stageChanged)
        XCTAssertEqual(snapshot.data.staleness.first?.suggestedActionLabel, "Follow up on the application")
        XCTAssertEqual(snapshot.data.today.total, 1)
        XCTAssertEqual(snapshot.data.today.followUpOn, 1)
        XCTAssertEqual(snapshot.data.followUps.first?.kind, "application")
        XCTAssertEqual(snapshot.data.duplicateGroups.first?.sources, ["extension", "manual"])
        XCTAssertNil(snapshot.data.analytics.averageDaysToFirstResponse)
    }

    func testDecodesTimestampsWithAndWithoutFractionalSeconds() throws {
        let json = """
        {"type":"sync-change","sessionId":"s","revision":1,"changedAt":"2026-03-20T12:00:00Z",
         "applications":{"upserted":[],"deletedIds":[]},
         "events":{"upserted":[],"deletedIds":[]},
         "staleness":[],"deadlines":[],
         "today":{"total":0,"applied":0,"interviewing":0,"dueToday":0,"upcoming":0,"overdue":0,"noDeadline":0,"followUpOn":0},
         "followUps":[],"duplicateGroups":[],"recruiterSignals":[],
         "analytics":{"totalApplications":0,"stageCounts":[],"appliedThisWeek":0,"appliedLast7Days":[0,0,0,0,0,0,0],
           "activeApplications":0,"responseRate":0,"interviewRate":0,"offerRate":0,"staleCount":0,
           "averageDaysToFirstResponse":null,"sourceCounts":[]}}
        """

        let message = try decoder.decode(SyncServerMessage.self, from: Data(json.utf8))
        guard case .change(let change) = message else {
            return XCTFail("Expected a change frame")
        }
        XCTAssertEqual(change.revision, 1)
    }

    func testDecodesDateOnlyAndSQLiteTimestamps() throws {
        let json = """
        {
          "type": "sync-snapshot",
          "sessionId": "s-1",
          "revision": 1,
          "generatedAt": "2026-09-12 12:00:00",
          "data": {
            "applications": [{
              "id": "app-date-only",
              "company": "Beta Corp",
              "title": "Backend Lead",
              "jobUrl": "https://example.com/lead",
              "status": "applied",
              "dateFound": "2026-09-01",
              "dateApplied": "2026-09-02",
              "lastActivityAt": "2026-09-02 15:30:00",
              "createdAt": "2026-09-01",
              "updatedAt": "2026-09-02 15:30:00"
            }],
            "events": [{
              "id": "ev-1",
              "applicationId": "app-date-only",
              "type": "stage_changed",
              "title": "Applied",
              "occurredAt": "2026-09-02 15:30:00"
            }],
            "staleness": [],
            "deadlines": [],
            "today": {"total": 1, "applied": 1, "interviewing": 0, "dueToday": 0, "upcoming": 0, "overdue": 0, "noDeadline": 1, "followUpOn": 0},
            "followUps": [],
            "duplicateGroups": [],
            "recruiterSignals": [],
            "analytics": {
              "totalApplications": 1, "stageCounts": [], "appliedThisWeek": 0,
              "appliedLast7Days": [0, 0, 0, 0, 0, 0, 0], "activeApplications": 1,
              "responseRate": 0, "interviewRate": 0, "offerRate": 0, "staleCount": 0,
              "averageDaysToFirstResponse": null, "sourceCounts": []
            }
          }
        }
        """

        let message = try decoder.decode(SyncServerMessage.self, from: Data(json.utf8))
        guard case .snapshot(let snapshot) = message else {
            return XCTFail("Expected a snapshot frame")
        }
        XCTAssertEqual(snapshot.data.applications.count, 1)
        let app = snapshot.data.applications[0]
        XCTAssertEqual(app.id, "app-date-only")
        XCTAssertEqual(app.followUpOn, false)
        XCTAssertEqual(app.source, "manual")
        XCTAssertEqual(app.jobDescription, "")
        XCTAssertNotNil(app.dateFound)
        XCTAssertNotNil(app.dateApplied)
    }

    func testUnknownFrameTypesDecodeRatherThanThrow() throws {
        let json = #"{"type":"sync-something-new","payload":{"a":1}}"#
        let message = try decoder.decode(SyncServerMessage.self, from: Data(json.utf8))
        guard case .unknown(let type) = message else {
            return XCTFail("Expected an unknown frame")
        }
        XCTAssertEqual(type, "sync-something-new")
    }

    func testErrorFrameDecodes() throws {
        let json = #"{"type":"sync-error","code":"unauthorized","message":"Invalid pairing token"}"#
        let message = try decoder.decode(SyncServerMessage.self, from: Data(json.utf8))
        guard case .error(let error) = message else {
            return XCTFail("Expected an error frame")
        }
        XCTAssertEqual(error.code, "unauthorized")
    }

    func testBackoffGrowsAndStaysCapped() {
        XCTAssertLessThanOrEqual(SyncClient.backoffDelay(attempt: 1, maximum: 30), 1.3)
        XCTAssertLessThanOrEqual(SyncClient.backoffDelay(attempt: 20, maximum: 30), 30)
        XCTAssertGreaterThan(SyncClient.backoffDelay(attempt: 4, maximum: 30), 1)
    }

    func testRawLANAddressUsesTheSeparatePortField() throws {
        let configuration = try SyncConfiguration.normalized(
            hostInput: "192.168.1.20",
            portInput: "4175",
            tokenInput: "pairing-token",
            allowLoopback: false
        )

        XCTAssertEqual(configuration.host, "192.168.1.20")
        XCTAssertEqual(configuration.port, 4_175)
        XCTAssertEqual(configuration.socketURL?.absoluteString, "ws://192.168.1.20:4175/sync")
    }

    func testWebSocketURLIsReducedToHostAndEmbeddedPort() throws {
        let configuration = try SyncConfiguration.normalized(
            hostInput: " ws://macbook.local:5210/sync ",
            portInput: "4175",
            tokenInput: " token ",
            allowLoopback: false
        )

        XCTAssertEqual(configuration, SyncConfiguration(host: "macbook.local", port: 5_210, token: "token"))
    }

    func testHTTPURLAndOptionalTrailingSlashNormalize() throws {
        let configuration = try SyncConfiguration.normalized(
            hostInput: "http://192.168.1.30/",
            portInput: "4175",
            tokenInput: "token",
            allowLoopback: false
        )

        XCTAssertEqual(configuration.host, "192.168.1.30")
        XCTAssertEqual(configuration.port, 4_175)
    }

    func testRawHostAndPortOverrideTheSeparatePortField() throws {
        let configuration = try SyncConfiguration.normalized(
            hostInput: "macbook.local:6000/sync",
            portInput: "4175",
            tokenInput: "token",
            allowLoopback: false
        )

        XCTAssertEqual(configuration.host, "macbook.local")
        XCTAssertEqual(configuration.port, 6_000)
    }

    func testInvalidPathIsRejected() {
        assertConfigurationError(.invalidHost) {
            try SyncConfiguration.normalized(
                hostInput: "ws://macbook.local:4175/not-sync",
                portInput: "4175",
                tokenInput: "token",
                allowLoopback: false
            )
        }
    }

    func testMissingAndOutOfRangePortsAreRejected() {
        for port in ["", "0", "65536", "not-a-port"] {
            assertConfigurationError(.invalidPort) {
                try SyncConfiguration.normalized(
                    hostInput: "macbook.local",
                    portInput: port,
                    tokenInput: "token",
                    allowLoopback: false
                )
            }
        }
    }

    func testLoopbackIsRejectedForAPhysicalPhone() {
        for host in ["localhost", "127.0.0.1", "127.1.2.3", "[::1]"] {
            assertConfigurationError(.loopbackHost) {
                try SyncConfiguration.normalized(
                    hostInput: host,
                    portInput: "4175",
                    tokenInput: "token",
                    allowLoopback: false
                )
            }
        }
    }

    func testLoopbackRemainsAvailableForSimulatorDevelopment() throws {
        let configuration = try SyncConfiguration.normalized(
            hostInput: "127.0.0.1",
            portInput: "4175",
            tokenInput: "token",
            allowLoopback: true
        )

        XCTAssertEqual(configuration.host, "127.0.0.1")
    }

    func testExtensionBridgePortHasAnActionableError() {
        assertConfigurationError(.extensionBridgePort) {
            try SyncConfiguration.normalized(
                hostInput: "192.168.1.20:4173",
                portInput: "4175",
                tokenInput: "token",
                allowLoopback: false
            )
        }

        XCTAssertEqual(
            SyncConfiguration.ValidationError.extensionBridgePort.errorDescription,
            "Port 4173 is the browser extension bridge. Use the iPhone companion port shown in the desktop app (default 4175)."
        )
    }

    func testMissingHostAndTokenAreRejected() {
        assertConfigurationError(.missingHost) {
            try SyncConfiguration.normalized(
                hostInput: " ",
                portInput: "4175",
                tokenInput: "token",
                allowLoopback: false
            )
        }
        assertConfigurationError(.missingToken) {
            try SyncConfiguration.normalized(
                hostInput: "192.168.1.20",
                portInput: "4175",
                tokenInput: " ",
                allowLoopback: false
            )
        }
    }

    private func assertConfigurationError(
        _ expected: SyncConfiguration.ValidationError,
        operation: () throws -> SyncConfiguration
    ) {
        XCTAssertThrowsError(try operation()) { error in
            XCTAssertEqual(error as? SyncConfiguration.ValidationError, expected)
        }
    }
}
