import SwiftUI

/// Dashboard v2's Keel tokens (`apps/dashboard/src/components/v2/keel.css`), restated for
/// SwiftUI so the app reads as the same product. Light only, like v2.
enum K {
    static let canvas = Color(hex: 0xF3F3F4)
    static let surface = Color(hex: 0xFAFAFA)
    static let raised = Color.white
    static let inset = Color(hex: 0xF5F5F6)
    static let hover = Color(hex: 0x101012, alpha: 0x0A)
    static let selected = Color(hex: 0x101012, alpha: 0x0F)
    static let strong = Color(hex: 0x18181B)
    static let fg1 = Color(hex: 0x101012)
    static let fg2 = Color(hex: 0x5E5E66)
    static let fg3 = Color(hex: 0x74747C)
    static let fg4 = Color(hex: 0xA9A9B0)
    static let lineSubtle = Color(hex: 0x101012, alpha: 0x11)
    static let line = Color(hex: 0x101012, alpha: 0x17)
    /// Charter blue (OKLCH hue 258), for selection and links only.
    static let accent = Color(hex: 0x2563EB)
    static let accentSoft = Color(hex: 0x2563EB, alpha: 0x1A)
    /// Every RUNNING indicator is green, whatever the accent.
    static let run = Color(hex: 0x16A34A)
    static let teal = Color(hex: 0x0E9F86)
    static let amber = Color(hex: 0xC7870A)
    static let rose = Color(hex: 0xE03A6A)
    static let violet = Color(hex: 0x6E5CF0)
    static let sky = Color(hex: 0x1D8BE0)

    static let body = Font.system(size: 13)
    static let meta = Font.system(size: 12)
    static let label = Font.system(size: 10.5, weight: .medium, design: .monospaced)
    static let title = Font.system(size: 22, weight: .semibold)
}

extension Color {
    init(hex: UInt32, alpha: UInt8 = 0xFF) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: Double(alpha) / 255
        )
    }
}

/// `k-label`: mono 10.5px uppercase, fg-3. Every field and column label.
struct KLabel: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased()).font(K.label).tracking(0.6).foregroundStyle(K.fg3)
    }
}

/// `k-card`: raised, 12px radius, an inset ring rather than a border.
struct KCard<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .background(K.raised, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(K.lineSubtle, lineWidth: 1))
            .shadow(color: .black.opacity(0.04), radius: 1, y: 1)
    }
}

/// A 28px Keel control: `k-btn` (raised) or `k-btn-ghost`.
struct KButtonStyle: ButtonStyle {
    var ghost = false
    var strong = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(K.body)
            .padding(.horizontal, 10)
            .frame(height: 28)
            .foregroundStyle(strong ? Color.white : K.fg1)
            .background(
                RoundedRectangle(cornerRadius: 8).fill(
                    strong ? (configuration.isPressed ? Color(hex: 0x27272B) : K.strong)
                        : ghost ? (configuration.isPressed ? K.selected : Color.clear)
                        : (configuration.isPressed ? K.inset : K.raised)
                )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8).strokeBorder(ghost || strong ? Color.clear : K.line, lineWidth: 1)
            )
            .contentShape(Rectangle())
    }
}

/// Status = a dot plus a capitalised word, never a pill.
struct StateDot: View {
    let word: String
    let color: Color
    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(word).font(K.meta).foregroundStyle(K.fg2)
        }
    }
}

/// A figure with its label underneath: the Keel stat cell.
struct Figure: View {
    let label: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            KLabel(label)
            Text(value).font(.system(size: 20, weight: .semibold)).monospacedDigit().foregroundStyle(value == "—" ? K.fg4 : K.fg1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Loading = shimmer rows at row height, never one big block. The pulse is driven by a
/// timeline and touches opacity only: a `withAnimation(.repeatForever)` started on appear
/// leaks into the layout and made the whole panel bob up and down (owner 2026-10-04).
struct ShimmerRows: View {
    var count = 4
    var body: some View {
        TimelineView(.animation) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            let o = 0.7 + 0.3 * sin(t * 3)
            VStack(spacing: 8) {
                ForEach(0..<count, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 6).fill(K.inset).frame(height: 28).opacity(o)
                }
            }
        }
    }
}

/// A brand or company mark: its logo from logo.dev (the dashboard's publishable token),
/// else a soft tile with its initial.
struct Logo: View {
    let domain: String?
    let name: String
    var size: CGFloat = 24
    var body: some View {
        Group {
            if let url = logoURL {
                AsyncImage(url: url) { phase in
                    if let img = phase.image { img.resizable().scaledToFit() } else { initial }
                }
            } else {
                initial
            }
        }
        .frame(width: size, height: size)
        .background(RoundedRectangle(cornerRadius: size * 0.25).fill(K.raised))
        .clipShape(RoundedRectangle(cornerRadius: size * 0.25))
        .overlay(RoundedRectangle(cornerRadius: size * 0.25).strokeBorder(K.lineSubtle, lineWidth: 1))
    }
    private var logoURL: URL? {
        guard let d = domain?.trimmingCharacters(in: .whitespaces), !d.isEmpty,
              let enc = d.addingPercentEncoding(withAllowedCharacters: .urlHostAllowed) else { return nil }
        return URL(string: "https://img.logo.dev/\(enc)?token=pk_J1iY4__HSfm9acHjR8FibA&size=\(Int(size * 2))&format=png")
    }
    private var initial: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: size * 0.45, weight: .semibold)).foregroundStyle(nameTint(name))
            .frame(width: size, height: size)
            .background(nameTint(name).opacity(0.14))
    }
}

/// A person: their photo, else their initials on a soft tint.
struct Avatar: View {
    let url: String?
    let name: String
    var size: CGFloat = 28
    var body: some View {
        Group {
            if let s = url, let u = URL(string: s) {
                AsyncImage(url: u) { phase in
                    if let img = phase.image { img.resizable().scaledToFill() } else { initials }
                }
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
    }
    private var initials: some View {
        let parts = name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined()
        return Text(parts.uppercased()).font(.system(size: size * 0.38, weight: .semibold)).foregroundStyle(nameTint(name))
            .frame(width: size, height: size).background(nameTint(name).opacity(0.14))
    }
}

/// A stable decorative tint per name, from the v2 data palette.
func nameTint(_ name: String) -> Color {
    let palette = [K.violet, K.sky, K.amber, K.teal, K.rose, K.accent]
    let h = name.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0xFFFF }
    return palette[h % palette.count]
}

/// v2's SparkLine: a thin line over a soft fill, in the tile's colour.
struct SparkLine: View {
    let values: [Double]
    var color: Color = K.accent
    var body: some View {
        GeometryReader { g in
            let pts = points(in: g.size)
            if pts.count > 1 {
                ZStack {
                    Path { p in
                        p.move(to: CGPoint(x: pts[0].x, y: g.size.height))
                        pts.forEach { p.addLine(to: $0) }
                        p.addLine(to: CGPoint(x: pts.last!.x, y: g.size.height))
                        p.closeSubpath()
                    }
                    .fill(LinearGradient(colors: [color.opacity(0.18), color.opacity(0)], startPoint: .top, endPoint: .bottom))
                    Path { p in
                        p.move(to: pts[0]); pts.dropFirst().forEach { p.addLine(to: $0) }
                    }
                    .stroke(color, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                }
            }
        }
        .frame(height: 28)
    }
    private func points(in size: CGSize) -> [CGPoint] {
        guard values.count > 1 else { return [] }
        let lo = values.min() ?? 0, hi = values.max() ?? 1
        let span = hi - lo == 0 ? 1 : hi - lo
        return values.enumerated().map { i, v in
            CGPoint(x: size.width * CGFloat(i) / CGFloat(values.count - 1),
                    y: size.height - 2 - (size.height - 4) * CGFloat((v - lo) / span))
        }
    }
}

/// Empty or error: one plain sentence.
struct EmptyNote: View {
    let text: String
    var isError = false
    var body: some View {
        Text(text).font(K.body).foregroundStyle(isError ? K.rose : K.fg3).textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Snapshot-safe containers
// ImageRenderer (the CI snapshot) draws no AppKit-backed view: a ScrollView renders empty
// and a Menu or TextField renders a placeholder. In a snapshot these swap for plain views.

private struct SnapshotKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var isSnapshot: Bool {
        get { self[SnapshotKey.self] }
        set { self[SnapshotKey.self] = newValue }
    }
}

struct KScroll<Content: View>: View {
    var axis: Axis.Set = .vertical
    @ViewBuilder var content: Content
    @Environment(\.isSnapshot) private var snapshot
    var body: some View {
        if snapshot {
            if axis == .horizontal { HStack(spacing: 0) { content } } else { VStack(spacing: 0) { content }.frame(maxHeight: .infinity, alignment: .top) }
        } else {
            ScrollView(axis, showsIndicators: false) { content }
        }
    }
}

struct KMenu<Label: View, Items: View>: View {
    @ViewBuilder var items: Items
    @ViewBuilder var label: Label
    @Environment(\.isSnapshot) private var snapshot
    var body: some View {
        if snapshot {
            label
        } else {
            Menu { items } label: { label }.menuStyle(.borderlessButton).menuIndicator(.hidden)
        }
    }
}

/// Keel's underline tabs (`k-tab`), used for a small choice like 7 / 30 days.
struct KTabs<V: Hashable>: View {
    let options: [(V, String)]
    let selection: V
    let pick: (V) -> Void
    var body: some View {
        HStack(spacing: 12) {
            ForEach(options, id: \.0) { value, label in
                Button { pick(value) } label: {
                    VStack(spacing: 6) {
                        Text(label).font(K.body).foregroundStyle(value == selection ? K.fg1 : K.fg3)
                        Rectangle().fill(value == selection ? K.fg1 : Color.clear).frame(height: 1.5)
                    }
                    .fixedSize()
                }
                .buttonStyle(.plain)
            }
        }
    }
}
