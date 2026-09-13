import Foundation

enum AppFormat {
    private static let dayMonth: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM"
        return formatter
    }()

    private static let dayMonthYear: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        return formatter
    }()

    private static let calendarDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    static func shortDate(_ date: Date) -> String {
        Calendar.current.isDate(date, equalTo: Date(), toGranularity: .year)
            ? dayMonth.string(from: date)
            : dayMonthYear.string(from: date)
    }

    static func fullDate(_ date: Date) -> String {
        dayMonthYear.string(from: date)
    }

    private static let calendarDayDisplay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        return formatter
    }()

    /// Renders a bare `YYYY-MM-DD` calendar date without pretending it is a moment in time.
    static func calendarDay(_ raw: String) -> String {
        guard let date = calendarDate.date(from: raw) else { return raw }
        return calendarDayDisplay.string(from: date)
    }

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter
    }()

    static func relative(_ date: Date, from reference: Date = Date()) -> String {
        // "in 0 seconds" is what the formatter says about now; nobody says that.
        if abs(date.timeIntervalSince(reference)) < 60 { return "just now" }
        return relativeFormatter.localizedString(for: date, relativeTo: reference)
    }

    static func percent(_ value: Double) -> String {
        "\(Int((value * 100).rounded()))%"
    }

    static func days(_ count: Int) -> String {
        count == 1 ? "1 day" : "\(count) days"
    }

    /// The desktop card meta reads "{n}d quiet".
    static func quiet(_ days: Int) -> String {
        "\(days)d quiet"
    }
}
