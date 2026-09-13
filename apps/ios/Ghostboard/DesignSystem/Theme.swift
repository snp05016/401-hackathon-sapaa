import SwiftUI

/// The three editorial themes the desktop app ships, mirrored so the two
/// applications read as one product. `paper` is the desktop default.
enum AppTheme: String, CaseIterable, Identifiable {
    case system
    case paper
    case noir
    case bone

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "Match system"
        case .paper: return "Paper"
        case .noir: return "Noir"
        case .bone: return "Bone"
        }
    }

    func palette(for colorScheme: ColorScheme) -> AppPalette {
        switch self {
        case .system: return colorScheme == .dark ? .noir : .paper
        case .paper: return .paper
        case .noir: return .noir
        case .bone: return .bone
        }
    }

    /// Forces the appearance so navigation chrome and sheets match the palette.
    var preferredColorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .paper, .bone: return .light
        case .noir: return .dark
        }
    }
}

/// Semantic colours shared by every mobile surface. The names describe purpose,
/// not a single theme, so feature views do not need appearance-specific branches.
struct AppPalette {
    let background: Color
    let surface: Color
    let elevated: Color
    let rail: Color
    let textPrimary: Color
    let textSecondary: Color
    let textMuted: Color
    /// Oxblood — the accent, and also the danger/closed colour.
    let accent: Color
    /// Signal teal — live data and positive outcomes.
    let success: Color
    /// Brass — in progress.
    let warning: Color
    let hairline: Color
    let cardShadow: Color
    /// The `--wash` gradient the desktop lays over the base paper.
    let wash: Color
    let washAlpha: Double
    let isDark: Bool

    static let paper = AppPalette(
        background: Color(hex: 0xF7F5F0),
        surface: Color(hex: 0xFEFDF9),
        elevated: Color(hex: 0xFFFFFF),
        rail: Color(hex: 0xE8E4DB),
        textPrimary: Color(hex: 0x111113),
        textSecondary: Color(hex: 0x535159),
        textMuted: Color(hex: 0x77747C),
        accent: Color(hex: 0x8D2635),
        success: Color(hex: 0x168579),
        warning: Color(hex: 0x98661B),
        hairline: Color(hex: 0x111113, opacity: 0.11),
        cardShadow: Color(hex: 0x111113, opacity: 0.07),
        wash: Color(hex: 0xFFFFFF),
        washAlpha: 0.92,
        isDark: false
    )

    static let noir = AppPalette(
        background: Color(hex: 0x12120E),
        surface: Color(hex: 0x1B1B1F),
        elevated: Color(hex: 0x242329),
        rail: Color(hex: 0x2B2930),
        textPrimary: Color(hex: 0xF7F5F0),
        textSecondary: Color(hex: 0xC5C1C8),
        textMuted: Color(hex: 0x9A969E),
        accent: Color(hex: 0xD87380),
        success: Color(hex: 0x52BFB3),
        warning: Color(hex: 0xE1B262),
        hairline: Color(hex: 0xF7F5F0, opacity: 0.13),
        cardShadow: Color(hex: 0x000000, opacity: 0.32),
        wash: Color(hex: 0xCDC6B6),
        washAlpha: 0.04,
        isDark: true
    )

    static let bone = AppPalette(
        background: Color(hex: 0xEEEAE1),
        surface: Color(hex: 0xF8F5EF),
        elevated: Color(hex: 0xFFFCF6),
        rail: Color(hex: 0xDDD7CB),
        textPrimary: Color(hex: 0x111113),
        textSecondary: Color(hex: 0x514F55),
        textMuted: Color(hex: 0x747177),
        accent: Color(hex: 0x8D2635),
        success: Color(hex: 0x14766D),
        warning: Color(hex: 0x8A5D18),
        hairline: Color(hex: 0x111113, opacity: 0.12),
        cardShadow: Color(hex: 0x111113, opacity: 0.08),
        wash: Color(hex: 0xFFFFFF),
        washAlpha: 0.9,
        isDark: false
    )
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}

private struct PaletteKey: EnvironmentKey {
    static let defaultValue = AppPalette.paper
}

extension EnvironmentValues {
    var palette: AppPalette {
        get { self[PaletteKey.self] }
        set { self[PaletteKey.self] = newValue }
    }
}

/// Tailwind's 4pt rhythm as the desktop uses it.
enum AppSpacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 44
    static let section: CGFloat = 36
}

enum AppRadius {
    static let card: CGFloat = 18
    static let compact: CGFloat = 12
    static let badge: CGFloat = 8
    static let sheet: CGFloat = 28
}

enum AppMotion {
    /// cubic-bezier(0.16, 1, 0.3, 1) — the desktop's reveal easing.
    static let reveal = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.55)
    static let quick = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.28)
}

/// The desktop pairs Bodoni Moda with Archivo. Neither ships with iOS, so the
/// display face maps to New York (Apple's serif) and body text to SF, keeping
/// the serif/sans contrast of the original.
struct AppFontSpec {
    let size: CGFloat
    let weight: Font.Weight
    let design: Font.Design
    let relativeTo: Font.TextStyle
}

enum AppFont {
    static func display(_ size: CGFloat, weight: Font.Weight = .regular) -> AppFontSpec {
        AppFontSpec(size: size, weight: weight, design: .serif, relativeTo: .title)
    }

    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> AppFontSpec {
        AppFontSpec(size: size, weight: weight, design: .default, relativeTo: .body)
    }

    static let screenTitle = AppFontSpec(size: 42, weight: .regular, design: .serif, relativeTo: .largeTitle)
    static let sectionTitle = AppFontSpec(size: 23, weight: .regular, design: .serif, relativeTo: .title2)
    static let recordTitle = AppFontSpec(size: 16, weight: .semibold, design: .default, relativeTo: .headline)
    static let supporting = AppFontSpec(size: 14, weight: .regular, design: .default, relativeTo: .subheadline)
    static let metadata = AppFontSpec(size: 12, weight: .regular, design: .default, relativeTo: .caption)
}

/// Scales every editorial role against its nearest Dynamic Type text style.
private struct ScaledAppFont: ViewModifier {
    let spec: AppFontSpec
    @ScaledMetric private var scaledSize: CGFloat

    init(spec: AppFontSpec) {
        self.spec = spec
        _scaledSize = ScaledMetric(wrappedValue: spec.size, relativeTo: spec.relativeTo)
    }

    func body(content: Content) -> some View {
        content.font(.system(size: scaledSize, weight: spec.weight, design: spec.design))
    }
}

extension View {
    func appFont(_ spec: AppFontSpec) -> some View {
        modifier(ScaledAppFont(spec: spec))
    }
}

extension View {
    /// Applies the product surface to every row of a Form or List.
    func listRowBackgroundStyle(_ color: Color) -> some View {
        environment(\.defaultMinListRowHeight, 44)
            .listRowBackground(color)
    }

    /// A hairline rule in the palette's border colour.
    func hairline(_ palette: AppPalette, edges: Edge.Set = .bottom) -> some View {
        overlay(alignment: edges == .top ? .top : .bottom) {
            Rectangle()
                .fill(palette.hairline)
                .frame(height: 1)
        }
    }
}
