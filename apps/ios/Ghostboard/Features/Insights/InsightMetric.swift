import SwiftUI

struct InsightMetric: Identifiable {
    let value: String
    let label: String
    var tint: Color?

    var id: String { label }
}
