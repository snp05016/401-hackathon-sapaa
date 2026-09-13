import Foundation

enum ApplicationSearch {
    static func results(
        from applications: [JobApplication],
        query: String,
        stage: ApplicationStage?,
        sort: ApplicationSort,
        staleness: (String) -> SyncStaleness?
    ) -> [JobApplication] {
        let searchText = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let filtered = applications.filter { application in
            let matchesStage = stage == nil || application.status == stage
            guard matchesStage else { return false }
            guard !searchText.isEmpty else { return true }

            return application.company.localizedStandardContains(searchText)
                || application.title.localizedStandardContains(searchText)
                || application.source.localizedStandardContains(searchText)
                || (application.location?.localizedStandardContains(searchText) ?? false)
        }

        switch sort {
        case .recent:
            return filtered.sorted(by: recentFirst)
        case .oldest:
            return filtered.sorted(by: oldestFirst)
        case .quietest:
            return filtered.sorted {
                let leftDays = staleness($0.id)?.daysSinceLastActivity ?? 0
                let rightDays = staleness($1.id)?.daysSinceLastActivity ?? 0
                if leftDays == rightDays { return recentFirst($0, $1) }
                return leftDays > rightDays
            }
        case .company:
            return filtered.sorted {
                let comparison = $0.company.localizedStandardCompare($1.company)
                if comparison == .orderedSame { return recentFirst($0, $1) }
                return comparison == .orderedAscending
            }
        }
    }

    private static func recentFirst(_ left: JobApplication, _ right: JobApplication) -> Bool {
        if left.lastActivityAt == right.lastActivityAt { return left.id < right.id }
        return left.lastActivityAt > right.lastActivityAt
    }

    private static func oldestFirst(_ left: JobApplication, _ right: JobApplication) -> Bool {
        if left.lastActivityAt == right.lastActivityAt { return left.id < right.id }
        return left.lastActivityAt < right.lastActivityAt
    }
}
