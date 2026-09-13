enum ApplicationSort: String, CaseIterable, Identifiable {
    case recent
    case oldest
    case quietest
    case company

    var id: String { rawValue }

    var label: String {
        switch self {
        case .recent: "Recent activity"
        case .oldest: "Oldest activity"
        case .quietest: "Longest quiet"
        case .company: "Company name"
        }
    }
}
