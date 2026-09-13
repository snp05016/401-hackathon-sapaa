import Foundation

struct DesktopToolsSummary: Equatable {
    let discoverSavedCount: Int
    let browserSavedCount: Int
    let resumeLinkedCount: Int
    let recruiterSignalCount: Int

    init(applications: [JobApplication], recruiterSignals: [SyncRecruiterSignal]) {
        discoverSavedCount = applications.count { application in
            application.source.lowercased().hasPrefix("jobspy:")
        }
        browserSavedCount = applications.count { application in
            Self.browserSources.contains(application.source.lowercased())
        }
        resumeLinkedCount = applications.count { application in
            application.resumeId?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
        }
        recruiterSignalCount = recruiterSignals.count
    }

    private static let browserSources: Set<String> = [
        "ashby",
        "extension",
        "generic",
        "greenhouse",
        "indeed",
        "lever",
        "linkedin",
        "workday",
    ]
}
