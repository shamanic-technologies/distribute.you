import SwiftUI

/// The sidebar of dashboard v2 (`components/v2/v2-shell.tsx` `V2Sidebar`), same groups,
/// items, counts and look. A click opens that view's compact panel beside the chat
/// instead of a page: the chat stays the product.
enum Pane: String, Hashable, CaseIterable {
    case today, companies, people, deals, offer, targeting, channels, integrations, settings, billing

    var title: String {
        switch self {
        case .today: return "Today"
        case .companies: return "Companies"
        case .people: return "People"
        case .deals: return "Deals"
        case .offer: return "Offer"
        case .targeting: return "Targeting"
        case .channels: return "Channels"
        case .integrations: return "Integrations"
        case .settings: return "Brand settings"
        case .billing: return "Billing"
        }
    }

    var symbol: String {
        switch self {
        case .today: return "chart.bar"
        case .companies: return "building.2"
        case .people: return "person.2"
        case .deals: return "rectangle.split.3x1"
        case .offer: return "tag"
        case .targeting: return "scope"
        case .channels: return "envelope"
        case .integrations: return "powerplug"
        case .settings: return "gearshape"
        case .billing: return "creditcard"
        }
    }
}

struct SidebarView: View {
    @EnvironmentObject var state: AppState
    @State private var recordsOpen = true

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BrandSwitcher().padding(.horizontal, 8).padding(.top, 8)
            OfferSwitcher().padding(.horizontal, 8).padding(.top, 6)
            KScroll {
                VStack(alignment: .leading, spacing: 1) {
                    NavRow(pane: .today, trailing: state.counts.needsCall.flatMap { $0 > 0 ? AnyView(Badge(n: $0)) : nil })
                    Button { recordsOpen.toggle() } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "tablecells").font(.system(size: 12)).frame(width: 16).foregroundStyle(K.fg3)
                            Text("Records").font(K.body).foregroundStyle(K.fg2)
                            Spacer()
                            Image(systemName: "chevron.down").font(.system(size: 9, weight: .semibold)).foregroundStyle(K.fg3)
                                .rotationEffect(.degrees(recordsOpen ? 0 : -90))
                        }
                        .padding(.leading, 8).padding(.trailing, 6).frame(height: 28).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    if recordsOpen {
                        NavRow(pane: .companies, indent: true, trailing: CountText(n: state.counts.companies))
                        NavRow(pane: .people, indent: true, trailing: CountText(n: state.counts.people))
                        NavRow(pane: .deals, indent: true, trailing: CountText(n: state.counts.deals))
                    }
                    Text("Setup").font(K.meta).foregroundStyle(K.fg3).padding(.horizontal, 8).padding(.top, 20).padding(.bottom, 4)
                    NavRow(pane: .offer)
                    NavRow(pane: .targeting)
                    NavRow(pane: .channels)
                    NavRow(pane: .integrations)
                    NavRow(pane: .settings)
                    if !state.topCompanies.isEmpty {
                        Text("Top companies").font(K.meta).foregroundStyle(K.fg3).padding(.horizontal, 8).padding(.top, 20).padding(.bottom, 4)
                        ForEach(state.topCompanies) { o in
                            let name = o.orgName ?? o.orgDomain ?? "Company"
                            Button { state.openCompany(o) } label: {
                                HStack(spacing: 8) {
                                    Logo(domain: o.orgDomain, name: name, size: 16)
                                    Text(name).font(K.body).foregroundStyle(K.fg2).lineLimit(1)
                                    Spacer(minLength: 0)
                                }
                                .padding(.horizontal, 8).frame(height: 28).contentShape(Rectangle())
                            }
                            .buttonStyle(NavHoverStyle(active: false))
                        }
                    }
                }
                .padding(.horizontal, 8).padding(.top, 12)
            }
            Spacer(minLength: 0)
            CreditsRow().padding(.horizontal, 8)
            Text("Revenue made easy.").font(K.meta).foregroundStyle(K.fg3).padding(.horizontal, 16).padding(.top, 8)
            AccountRow().padding(8)
        }
        .frame(width: 240)
        .background(K.canvas)
    }
}

private struct NavRow<Trailing: View>: View {
    @EnvironmentObject var state: AppState
    let pane: Pane
    var indent = false
    var trailing: Trailing?

    init(pane: Pane, indent: Bool = false, trailing: Trailing? = nil) {
        self.pane = pane; self.indent = indent; self.trailing = trailing
    }

    var body: some View {
        let active = state.pane == pane
        Button { state.open(pane) } label: {
            HStack(spacing: 8) {
                if !indent {
                    Image(systemName: pane.symbol).font(.system(size: 12)).frame(width: 16).foregroundStyle(K.fg3)
                }
                Text(pane.title).font(K.body).foregroundStyle(active ? K.fg1 : K.fg2).lineLimit(1)
                Spacer(minLength: 4)
                if let trailing { trailing }
            }
            .padding(.leading, indent ? 32 : 8).padding(.trailing, 6).frame(height: 28)
            .background(RoundedRectangle(cornerRadius: 8).fill(active ? K.selected : Color.clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(NavHoverStyle(active: active))
    }
}

extension NavRow where Trailing == EmptyView {
    init(pane: Pane, indent: Bool = false) { self.init(pane: pane, indent: indent, trailing: nil) }
}

private struct NavHoverStyle: ButtonStyle {
    let active: Bool
    @State private var hovering = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(RoundedRectangle(cornerRadius: 8).fill(!active && hovering ? K.hover : Color.clear))
            .onHover { hovering = $0 }
    }
}

private struct CountText: View {
    let n: Int?
    var body: some View {
        if let n { Text(n.formatted()).font(K.meta).monospacedDigit().foregroundStyle(K.fg3).padding(.trailing, 4) }
    }
}

private struct Badge: View {
    let n: Int
    var body: some View {
        Text(n.formatted()).font(.system(size: 11, weight: .medium)).monospacedDigit().foregroundStyle(K.fg2)
            .padding(.horizontal, 6).background(RoundedRectangle(cornerRadius: 5).fill(K.selected))
            .help("Replied with interest, not yet closed")
    }
}

/// The tenant switcher: brand mark + name, every org's brands in the menu.
struct BrandSwitcher: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        KMenu {
            ForEach(state.me?.organizations ?? []) { org in
                if !org.brands.isEmpty {
                    Section(org.name ?? org.id) {
                        ForEach(org.brands) { brand in
                            Button(brand.label) { state.select(brand: brand, in: org) }
                        }
                    }
                }
            }
        } label: {
            HStack(spacing: 8) {
                Logo(domain: state.selectedBrand?.domain, name: state.selectedBrand?.label ?? "?", size: 24)
                VStack(alignment: .leading, spacing: 0) {
                    Text(state.selectedBrand?.label ?? "Choose a brand").font(.system(size: 13, weight: .medium)).foregroundStyle(K.fg1).lineLimit(1)
                    if let org = state.selectedOrg?.name { Text(org).font(K.meta).foregroundStyle(K.fg3).lineLimit(1) }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.up.chevron.down").font(.system(size: 10)).foregroundStyle(K.fg3)
            }
            .padding(.horizontal, 8).frame(height: 40)
        }
    }
}

/// v2's offer switcher: every brand page reads ONE offer, picked here.
struct OfferSwitcher: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        if !state.offers.isEmpty {
            KMenu {
                ForEach(state.offers) { offer in
                    Button(offer.name) { state.select(offer: offer) }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "tag").font(.system(size: 11)).foregroundStyle(K.fg3)
                    Text(state.selectedOffer?.name ?? "Choose an offer").font(K.meta).foregroundStyle(K.fg2).lineLimit(1)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.down").font(.system(size: 9)).foregroundStyle(K.fg3)
                }
                .padding(.horizontal, 8).frame(height: 28)
            }
        }
    }
}

struct BrandMark: View {
    let name: String
    var body: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
            .frame(width: 24, height: 24)
            .background(RoundedRectangle(cornerRadius: 6).fill(K.accent))
    }
}

/// Prepaid credit and its top-up, the one money control the app keeps.
private struct CreditsRow: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        HStack(spacing: 6) {
            VStack(alignment: .leading, spacing: 1) {
                KLabel("Prepaid credit")
                if let b = state.balance {
                    Text(dollars(cents: Double(b.balance_cents))).font(.system(size: 13, weight: .semibold)).monospacedDigit()
                        .foregroundStyle(b.depleted ? K.rose : K.fg1)
                } else {
                    Text("—").font(K.body).foregroundStyle(K.fg4)
                }
            }
            Spacer()
            KMenu {
                ForEach([50, 100, 250], id: \.self) { usd in
                    Button("$\(usd)") { Task { await state.topUp(cents: usd * 100) } }
                }
            } label: {
                Text("Top up").font(K.meta).foregroundStyle(K.fg1).padding(.horizontal, 10).frame(height: 26)
                    .background(RoundedRectangle(cornerRadius: 8).fill(K.raised))
                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(K.line, lineWidth: 1))
            }
            .fixedSize()
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(K.raised))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(state.pane == .billing ? K.accent.opacity(0.5) : K.lineSubtle, lineWidth: 1))
        .contentShape(Rectangle())
        .onTapGesture { state.open(.billing) }
    }
}

private struct AccountRow: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        KMenu {
            Button("Billing") { state.open(.billing) }
            Divider()
            Button("Sign out") { state.signOut() }
        } label: {
            HStack(spacing: 8) {
                Text(String((state.me?.user?.email ?? "?").prefix(1)).uppercased())
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(K.fg2)
                    .frame(width: 24, height: 24).background(Circle().fill(K.selected))
                Text(state.me?.user?.email ?? "").font(K.meta).foregroundStyle(K.fg2).lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 8).frame(height: 36)
        }
    }
}
