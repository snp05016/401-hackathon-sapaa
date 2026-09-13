import Foundation

/// Mirrors `packages/shared/src/bridge/syncProtocol.ts`. Field names match the
/// wire format exactly, so no CodingKeys are required.
enum SyncProtocol {
    static let version = 1
    static let path = "/sync"
    static let defaultPort = 4175
}

enum ApplicationStage: String, Codable, CaseIterable, Identifiable, Sendable {
    case found
    case applied
    case interviewing
    case offer
    case rejected
    case ghosted

    var id: String { rawValue }

    /// STAGE_LABELS in packages/shared/src/constants.ts.
    var label: String {
        switch self {
        case .found: return "Found"
        case .applied: return "Applied"
        case .interviewing: return "Interviewing"
        case .offer: return "Offer"
        case .rejected: return "Rejected"
        case .ghosted: return "Ghosted"
        }
    }

    /// STAGE_SUBTITLES — the desktop's dry secondary copy, preserved verbatim.
    var subtitle: String {
        switch self {
        case .found: return "saved in a moment of optimism"
        case .applied: return "sent into the machine"
        case .interviewing: return "talking to actual humans"
        case .offer: return "the rare one"
        case .rejected: return "the corporate void claims another one"
        case .ghosted: return "radio silence since forever"
        }
    }

    /// STAGE_EMPTY, falling back to a neutral line where the desktop has none.
    var emptyCopy: String {
        switch self {
        case .offer: return "reserved for good news"
        case .ghosted: return "nobody's ignoring you yet"
        case .found: return "nothing saved yet"
        case .applied: return "nothing sent yet"
        case .interviewing: return "no conversations yet"
        case .rejected: return "no rejections yet"
        }
    }

    var symbolName: String {
        switch self {
        case .found: return "bookmark"
        case .applied: return "paperplane"
        case .interviewing: return "bubble.left.and.bubble.right"
        case .offer: return "seal"
        case .rejected: return "xmark.circle"
        case .ghosted: return "moon.zzz"
        }
    }
}

enum ApplicationEventType: String, Codable, Sendable {
    case created
    case stageChanged = "stage_changed"
    case emailReceived = "email_received"
    case noteAdded = "note_added"
    case reminderSet = "reminder_set"
    case resumeAttached = "resume_attached"
    case unknown

    var symbolName: String {
        switch self {
        case .created: return "plus.circle"
        case .stageChanged: return "arrow.triangle.branch"
        case .emailReceived: return "envelope"
        case .noteAdded: return "text.quote"
        case .reminderSet: return "bell"
        case .resumeAttached: return "doc.text"
        case .unknown: return "questionmark.circle"
        }
    }
}

struct JobApplication: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let company: String
    let title: String
    let location: String?
    let jobUrl: String
    let jobDescription: String
    let status: ApplicationStage
    let dateFound: Date
    let dateApplied: Date?
    /// A bare YYYY-MM-DD calendar date, not a timestamp.
    let deadline: String?
    let lastActivityAt: Date
    let followUpOn: Bool
    let followUpDismissedAt: Date?
    let nextAction: String?
    /// Also a bare YYYY-MM-DD calendar date.
    let nextActionDate: String?
    let resumeId: String?
    let source: String
    let createdAt: Date
    let updatedAt: Date

    var jobURL: URL? { URL(string: jobUrl) }
}

struct ApplicationEvent: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let applicationId: String
    let type: ApplicationEventType
    let title: String
    let description: String?
    let occurredAt: Date
}

struct SyncStaleness: Codable, Hashable, Sendable {
    let applicationId: String
    let isStale: Bool
    let daysSinceLastActivity: Int
    let suggestedAction: String?

    /// The desktop's SuggestedAction constants, rendered for a human.
    var suggestedActionLabel: String? {
        guard let suggestedAction else { return nil }
        switch suggestedAction {
        case "FOLLOW_UP_APPLICATION": return "Follow up on the application"
        case "CHECK_IN_RECRUITER": return "Check in with the recruiter"
        case "SEND_THANK_YOU_OR_CHECK_IN": return "Send a thank-you or check in"
        case "REVIEW_OFFER_DEADLINE": return "Review the offer deadline"
        case "CHECK_IN": return "Check in"
        default: return suggestedAction
        }
    }
}

struct SyncDeadline: Codable, Hashable, Sendable {
    enum Color: String, Codable, Sendable {
        case green, yellow, red, none
    }

    let applicationId: String
    let color: Color
    let daysRemaining: Int?
    let label: String

    var hasDeadline: Bool { color != .none }
}

struct SyncTodaySummary: Codable, Hashable, Sendable {
    let total: Int
    let applied: Int
    let interviewing: Int
    let dueToday: Int
    let upcoming: Int
    let overdue: Int
    let noDeadline: Int
    let followUpOn: Int

    static let empty = SyncTodaySummary(
        total: 0, applied: 0, interviewing: 0, dueToday: 0, upcoming: 0, overdue: 0, noDeadline: 0, followUpOn: 0
    )
}

struct SyncFollowUp: Codable, Hashable, Identifiable, Sendable {
    let applicationId: String
    let company: String
    let title: String
    let kind: String
    let kindLabel: String
    let messageTitle: String
    let messageDescription: String
    let messageBody: String

    var id: String { "\(applicationId)-\(kind)" }
}

struct SyncDuplicateCopy: Codable, Hashable, Identifiable, Sendable {
    let applicationId: String
    let source: String
    let savedAt: Date

    var id: String { applicationId }
}

/// A job saved from more than one website, grouped by the desktop.
struct SyncDuplicateGroup: Codable, Hashable, Identifiable, Sendable {
    let key: String
    let company: String
    let title: String
    let sources: [String]
    let copies: [SyncDuplicateCopy]

    var id: String { key }
}

struct SyncRecruiterSignal: Codable, Hashable, Identifiable, Sendable {
    let id: String
    let subject: String
    let sender: String
    let receivedAt: Date
    let newStatus: ApplicationStage?
    let confidence: Double
    let evidence: String
    let candidateApplicationIds: [String]
}

struct SyncStageCount: Codable, Hashable, Identifiable, Sendable {
    let stage: ApplicationStage
    let count: Int

    var id: String { stage.rawValue }
}

struct SyncSourceCount: Codable, Hashable, Identifiable, Sendable {
    let source: String
    let count: Int

    var id: String { source }
}

struct SyncAnalytics: Codable, Hashable, Sendable {
    let totalApplications: Int
    let stageCounts: [SyncStageCount]
    let appliedThisWeek: Int
    let appliedLast7Days: [Int]
    let activeApplications: Int
    let responseRate: Double
    let interviewRate: Double
    let offerRate: Double
    let staleCount: Int
    let averageDaysToFirstResponse: Double?
    let sourceCounts: [SyncSourceCount]

    static let empty = SyncAnalytics(
        totalApplications: 0,
        stageCounts: [],
        appliedThisWeek: 0,
        appliedLast7Days: Array(repeating: 0, count: 7),
        activeApplications: 0,
        responseRate: 0,
        interviewRate: 0,
        offerRate: 0,
        staleCount: 0,
        averageDaysToFirstResponse: nil,
        sourceCounts: []
    )
}

struct SyncSnapshotData: Codable, Hashable, Sendable {
    let applications: [JobApplication]
    let events: [ApplicationEvent]
    let staleness: [SyncStaleness]
    let deadlines: [SyncDeadline]
    let today: SyncTodaySummary
    let followUps: [SyncFollowUp]
    let duplicateGroups: [SyncDuplicateGroup]
    let recruiterSignals: [SyncRecruiterSignal]
    let analytics: SyncAnalytics

    static let empty = SyncSnapshotData(
        applications: [],
        events: [],
        staleness: [],
        deadlines: [],
        today: .empty,
        followUps: [],
        duplicateGroups: [],
        recruiterSignals: [],
        analytics: .empty
    )
}

struct SyncCollectionDiff<Element: Codable & Sendable>: Codable, Sendable {
    let upserted: [Element]
    let deletedIds: [String]
}

// MARK: - Wire messages

struct SyncWelcome: Codable, Sendable {
    let protocolVersion: Int
    let serverVersion: String
    let sessionId: String
    let revision: Int
}

struct SyncSnapshotMessage: Codable, Sendable {
    let sessionId: String
    let revision: Int
    let generatedAt: Date
    let data: SyncSnapshotData
}

struct SyncChangeMessage: Codable, Sendable {
    let sessionId: String
    let revision: Int
    let changedAt: Date
    let applications: SyncCollectionDiff<JobApplication>
    let events: SyncCollectionDiff<ApplicationEvent>
    let staleness: [SyncStaleness]
    let deadlines: [SyncDeadline]
    let today: SyncTodaySummary
    let followUps: [SyncFollowUp]
    let duplicateGroups: [SyncDuplicateGroup]
    let recruiterSignals: [SyncRecruiterSignal]
    let analytics: SyncAnalytics
}

struct SyncErrorMessage: Codable, Sendable {
    let code: String
    let message: String
}

/// A server frame. Unknown `type` values decode to `.unknown` rather than
/// throwing, so a newer desktop can add messages without breaking this client.
enum SyncServerMessage: Sendable {
    case welcome(SyncWelcome)
    case snapshot(SyncSnapshotMessage)
    case change(SyncChangeMessage)
    case error(SyncErrorMessage)
    case ping
    case unknown(String)
}

extension SyncServerMessage: Decodable {
    private enum TypeKey: String, CodingKey {
        case type
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: TypeKey.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "sync-welcome": self = .welcome(try SyncWelcome(from: decoder))
        case "sync-snapshot": self = .snapshot(try SyncSnapshotMessage(from: decoder))
        case "sync-change": self = .change(try SyncChangeMessage(from: decoder))
        case "sync-error": self = .error(try SyncErrorMessage(from: decoder))
        case "sync-ping": self = .ping
        default: self = .unknown(type)
        }
    }
}

struct SyncHelloMessage: Encodable, Sendable {
    let type = "sync-hello"
    let protocolVersion: Int
    let token: String
    let clientId: String
}

struct SyncSimpleClientMessage: Encodable, Sendable {
    let type: String

    static let pong = SyncSimpleClientMessage(type: "sync-pong")
    static let requestSnapshot = SyncSimpleClientMessage(type: "sync-request-snapshot")
}

// MARK: - Coding

enum SyncCoding {
    /// The desktop serialises every timestamp with `Date#toISOString()`, i.e.
    /// ISO 8601 in UTC with fractional seconds, or local calendar/SQLite formats.
    static func makeDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let withoutFraction = ISO8601DateFormatter()
        withoutFraction.formatOptions = [.withInternetDateTime]
        let dateOnly = ISO8601DateFormatter()
        dateOnly.formatOptions = [.withFullDate, .withDashSeparatorInDate]

        let sqliteFormatter = DateFormatter()
        sqliteFormatter.locale = Locale(identifier: "en_US_POSIX")
        sqliteFormatter.timeZone = TimeZone(secondsFromGMT: 0)
        sqliteFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"

        let secondaryFormatter = DateFormatter()
        secondaryFormatter.locale = Locale(identifier: "en_US_POSIX")
        secondaryFormatter.timeZone = TimeZone(secondsFromGMT: 0)
        secondaryFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"

        decoder.dateDecodingStrategy = .custom { decoder in
            let raw = try decoder.singleValueContainer().decode(String.self)
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if let date = withFraction.date(from: trimmed) ??
                          withoutFraction.date(from: trimmed) ??
                          dateOnly.date(from: trimmed) ??
                          sqliteFormatter.date(from: trimmed) ??
                          secondaryFormatter.date(from: trimmed) {
                return date
            }
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Unrecognised date \(raw)")
            )
        }
        return decoder
    }

    static func makeEncoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            try container.encode(formatter.string(from: date))
        }
        return encoder
    }
}

// MARK: - Resilient Decoding Extensions

extension ApplicationEventType {
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        self = ApplicationEventType(rawValue: raw) ?? .unknown
    }
}

extension JobApplication {
    enum CodingKeys: String, CodingKey {
        case id, company, title, location, jobUrl, jobDescription, status
        case dateFound, dateApplied, deadline, lastActivityAt
        case followUpOn, followUpDismissedAt, nextAction, nextActionDate
        case resumeId, source, createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        company = try container.decode(String.self, forKey: .company)
        title = try container.decode(String.self, forKey: .title)
        location = try container.decodeIfPresent(String.self, forKey: .location)
        jobUrl = try container.decode(String.self, forKey: .jobUrl)
        jobDescription = try container.decodeIfPresent(String.self, forKey: .jobDescription) ?? ""
        status = try container.decode(ApplicationStage.self, forKey: .status)
        dateFound = try container.decode(Date.self, forKey: .dateFound)
        dateApplied = try container.decodeIfPresent(Date.self, forKey: .dateApplied)
        deadline = try container.decodeIfPresent(String.self, forKey: .deadline)
        lastActivityAt = try container.decode(Date.self, forKey: .lastActivityAt)
        followUpOn = try container.decodeIfPresent(Bool.self, forKey: .followUpOn) ?? false
        followUpDismissedAt = try container.decodeIfPresent(Date.self, forKey: .followUpDismissedAt)
        nextAction = try container.decodeIfPresent(String.self, forKey: .nextAction)
        nextActionDate = try container.decodeIfPresent(String.self, forKey: .nextActionDate)
        resumeId = try container.decodeIfPresent(String.self, forKey: .resumeId)
        source = try container.decodeIfPresent(String.self, forKey: .source) ?? "manual"
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
    }
}

extension SyncRecruiterSignal {
    enum CodingKeys: String, CodingKey {
        case id, subject, sender, receivedAt, newStatus, confidence, evidence, candidateApplicationIds
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        subject = try container.decode(String.self, forKey: .subject)
        sender = try container.decode(String.self, forKey: .sender)
        receivedAt = try container.decode(Date.self, forKey: .receivedAt)
        newStatus = try container.decodeIfPresent(ApplicationStage.self, forKey: .newStatus)
        confidence = try container.decodeIfPresent(Double.self, forKey: .confidence) ?? 0.0
        evidence = try container.decodeIfPresent(String.self, forKey: .evidence) ?? ""
        candidateApplicationIds = try container.decodeIfPresent([String].self, forKey: .candidateApplicationIds) ?? []
    }
}
