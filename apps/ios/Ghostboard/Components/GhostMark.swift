import SwiftUI

struct GhostMark: View {
    var size: CGFloat = 22
    @Environment(\.palette) private var palette

    var body: some View {
        Canvas { context, canvasSize in
            let scale = min(canvasSize.width, canvasSize.height) / 24
            var silhouette = Path()
            silhouette.addArc(
                center: CGPoint(x: 12 * scale, y: 10.4 * scale),
                radius: 7.6 * scale,
                startAngle: .degrees(180),
                endAngle: .degrees(0),
                clockwise: false
            )
            silhouette.addLine(to: CGPoint(x: 19.6 * scale, y: 21.2 * scale))
            for point in hemPoints {
                silhouette.addLine(to: CGPoint(x: point.x * scale, y: point.y * scale))
            }
            silhouette.closeSubpath()
            context.fill(silhouette, with: .color(palette.accent))

            for centerX in [9.6, 14.4] {
                let eye = Path(ellipseIn: CGRect(
                    x: (centerX - 1.15) * scale,
                    y: 8.7 * scale,
                    width: 2.3 * scale,
                    height: 3 * scale
                ))
                context.fill(eye, with: .color(palette.background))
            }
        }
        .drawingGroup()
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    private var hemPoints: [CGPoint] {
        [
            CGPoint(x: 17.7, y: 19.15), CGPoint(x: 15.8, y: 21.2),
            CGPoint(x: 13.9, y: 19.15), CGPoint(x: 12, y: 21.2),
            CGPoint(x: 10.1, y: 19.15), CGPoint(x: 8.2, y: 21.2),
            CGPoint(x: 6.3, y: 19.15), CGPoint(x: 4.4, y: 21.2),
        ]
    }
}
