import Foundation

struct InsightWeekEntry: Identifiable {
    let date: Date
    let count: Int

    var id: Date { date }
}
