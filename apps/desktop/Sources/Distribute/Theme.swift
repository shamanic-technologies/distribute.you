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

/// Loading = shimmer rows at row height, never one big block.
struct ShimmerRows: View {
    var count = 4
    @State private var phase = false
    var body: some View {
        VStack(spacing: 8) {
            ForEach(0..<count, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 6).fill(K.inset).frame(height: 28)
                    .opacity(phase ? 0.55 : 1)
            }
        }
        .onAppear { withAnimation(.easeInOut(duration: 0.9).repeatForever()) { phase = true } }
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
        HStack(spacing: 14) {
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
