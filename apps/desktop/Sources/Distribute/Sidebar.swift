import SwiftUI

/// The sidebar of dashboard v2, drawn as EXACTLY as SwiftUI allows (owner 2026-10-04:
/// « make the left sidebar as exact as the webapp »): `v2-shell.tsx` V2Sidebar for the
/// nav, `sidebar-menus.tsx` for the tenant switcher, the search box and the account
/// menu, the web's own icon paths (`SVGPath.swift`). A click opens that page's compact
/// panel beside the chat instead of navigating: the chat stays the product.
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
            // px-2 pt-2 space-y-2: tenant switcher, then the search box.
            VStack(spacing: 8) {
                TenantButton()
                SearchBox()
            }
            .padding(.horizontal, 8).padding(.top, 8)
            KScroll {
                VStack(alignment: .leading, spacing: 1) {
                    NavRow(pane: .today, icon: V2Icon.today, trailing: state.counts.needsCall.flatMap { $0 > 0 ? AnyView(TodayBadge(n: $0)) : nil })
                    Button { recordsOpen.toggle() } label: {
                        HStack(spacing: 8) {
                            SVGIcon(d: V2Icon.records)
                            Text("Records").font(K.body).foregroundStyle(K.fg2)
                            Spacer()
                            SVGIcon(d: V2Icon.chevron, viewBox: 12, size: 12)
                                .rotationEffect(.degrees(recordsOpen ? 0 : -90))
                        }
                        .padding(.leading, 8).padding(.trailing, 6).frame(height: 28).contentShape(Rectangle())
                    }
                    .buttonStyle(NavHoverStyle(active: false))
                    if recordsOpen {
                        NavRow(pane: .companies, indent: true, trailing: CountText(n: state.counts.companies))
                        NavRow(pane: .people, indent: true, trailing: CountText(n: state.counts.people))
                        NavRow(pane: .deals, indent: true, trailing: CountText(n: state.counts.deals))
                    }
                    GroupTitle("Setup")
                    NavRow(pane: .offer, icon: V2Icon.offer)
                    NavRow(pane: .targeting, icon: V2Icon.target)
                    NavRow(pane: .channels, icon: V2Icon.channels)
                    NavRow(pane: .integrations, icon: V2Icon.plug)
                    NavRow(pane: .settings, icon: V2Icon.settings)
                    if !state.topCompanies.isEmpty {
                        GroupTitle("Top companies")
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
                .padding(.horizontal, 8).padding(.top, 12).padding(.bottom, 12)
            }
            Spacer(minLength: 0)
            // BrandWhyLine: k-fg3 px-4 pb-1 pt-2 text-[12px].
            Text("Revenue made easy.").font(K.meta).foregroundStyle(K.fg3).padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 4)
            AccountButton().padding(.horizontal, 8).padding(.bottom, 8).padding(.top, 4)
        }
        .frame(width: 240)
        .background(K.canvas)
        // The two menus are Keel popovers drawn inside the sidebar's width, like the web.
        .overlay(alignment: .top) {
            if state.menu == .tenant {
                TenantMenu().padding(.horizontal, 8).padding(.top, 8 + 36 + 4)
            }
        }
        .overlay(alignment: .bottom) {
            if state.menu == .account {
                AccountMenu().padding(.horizontal, 8).padding(.bottom, 8 + 44 + 4)
            }
        }
    }
}

private struct GroupTitle: View {
    let title: String
    init(_ t: String) { title = t }
    var body: some View {
        Text(title).font(K.meta).foregroundStyle(K.fg3).padding(.horizontal, 8).padding(.top, 20).padding(.bottom, 4)
    }
}

private struct NavRow<Trailing: View>: View {
    @EnvironmentObject var state: AppState
    let pane: Pane
    var icon: String?
    var indent = false
    var trailing: Trailing?

    init(pane: Pane, icon: String? = nil, indent: Bool = false, trailing: Trailing? = nil) {
        self.pane = pane; self.icon = icon; self.indent = indent; self.trailing = trailing
    }

    var body: some View {
        let active = state.pane == pane
        Button { state.open(pane) } label: {
            HStack(spacing: 8) {
                if let icon { SVGIcon(d: icon) }
                Text(pane.title).font(K.body).foregroundStyle(active ? K.fg1 : K.fg2).lineLimit(1)
                Spacer(minLength: 4)
                if let trailing { trailing }
            }
            .padding(.leading, indent ? 30 : 8).padding(.trailing, 6).frame(height: 28)
            .background(RoundedRectangle(cornerRadius: 8).fill(active ? K.selected : Color.clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(NavHoverStyle(active: active))
    }
}

extension NavRow where Trailing == EmptyView {
    init(pane: Pane, icon: String? = nil, indent: Bool = false) { self.init(pane: pane, icon: icon, indent: indent, trailing: nil) }
}

struct NavHoverStyle: ButtonStyle {
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

private struct TodayBadge: View {
    let n: Int
    var body: some View {
        Text(n.formatted()).font(.system(size: 11, weight: .medium)).monospacedDigit().foregroundStyle(K.fg2)
            .padding(.horizontal, 6).background(RoundedRectangle(cornerRadius: 5).fill(K.selected))
            .help("Replied with interest, not yet closed")
    }
}

/// `k-input`: 28px, 8px radius, raised, inset line.
private struct SearchBox: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        Button { state.focusChat() } label: {
            HStack(spacing: 8) {
                SVGIcon(d: V2Icon.search, size: 14, lineWidth: 1.4)
                Text("Search or ask…").font(K.body).foregroundStyle(K.fg3)
                Spacer(minLength: 0)
                Text("⌘K").font(.system(size: 11, weight: .medium)).foregroundStyle(K.fg3)
                    .padding(.horizontal, 5).frame(height: 18)
                    .background(RoundedRectangle(cornerRadius: 5).fill(K.raised))
                    .overlay(RoundedRectangle(cornerRadius: 5).strokeBorder(K.line, lineWidth: 1))
            }
            .padding(.horizontal, 8).frame(height: 28)
            .background(RoundedRectangle(cornerRadius: 8).fill(K.raised))
            .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(K.line, lineWidth: 1))
            .shadow(color: .black.opacity(0.05), radius: 0.5, y: 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .keyboardShortcut("k", modifiers: .command)
    }
}

// MARK: - Tenant switcher (`TenantSwitcherV2`)

private struct TenantButton: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        Button { state.menu = state.menu == .tenant ? nil : .tenant } label: {
            HStack(spacing: 8) {
                Logo(domain: state.selectedBrand?.domain, name: state.selectedBrand?.label ?? "Brand", size: 20, radius: 5)
                VStack(alignment: .leading, spacing: 0) {
                    Text(state.selectedBrand?.label ?? "Brand").font(.system(size: 13, weight: .semibold)).foregroundStyle(K.fg1).lineLimit(1)
                    if state.selectedBrand != nil {
                        Text(state.selectedOffer?.name ?? (state.offers.isEmpty ? "No offer yet" : " ")).font(K.meta).foregroundStyle(K.fg3).lineLimit(1)
                    }
                }
                Spacer(minLength: 4)
                SVGIcon(d: V2Icon.updown, viewBox: 12, size: 12, lineWidth: 1.2)
            }
            .padding(.horizontal, 8).frame(height: 36)
            .contentShape(Rectangle())
        }
        .buttonStyle(NavHoverStyle(active: state.menu == .tenant))
    }
}

/// The popover's rows: h-8, 8px radius, 13px fg1, the current one `bg-selected font-medium`.
private struct MenuRow<Lead: View>: View {
    let title: String
    var current = false
    var trailing: String? = nil
    @ViewBuilder var lead: Lead
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                lead
                Text(title).font(.system(size: 13, weight: current ? .medium : .regular)).foregroundStyle(K.fg1).lineLimit(1)
                Spacer(minLength: 4)
                if let trailing { Text(trailing).font(K.meta).foregroundStyle(K.fg3) }
            }
            .padding(.horizontal, 8).frame(height: 32)
            .background(RoundedRectangle(cornerRadius: 8).fill(current ? K.selected : Color.clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(NavHoverStyle(active: current))
    }
}

private struct MenuLabel: View {
    let text: String
    var body: some View { Text(text).font(K.meta).foregroundStyle(K.fg3).padding(.horizontal, 8).padding(.top, 8).padding(.bottom, 4) }
}

private struct MenuDivider: View {
    var body: some View { Rectangle().fill(K.lineSubtle).frame(height: 1).padding(.vertical, 4) }
}

private struct PlusMark: View {
    var body: some View { SVGIcon(d: V2Icon.plus, viewBox: 14, size: 14).frame(width: 20, height: 20) }
}

/// `k-popover`: raised, 12px radius, `--elev-popover`.
private struct Popover<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content }
            .padding(4)
            .background(RoundedRectangle(cornerRadius: 12).fill(K.raised))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color(hex: 0x101012, alpha: 0x14), lineWidth: 1))
            .shadow(color: .black.opacity(0.08), radius: 3, y: 2)
            .shadow(color: .black.opacity(0.14), radius: 14, y: 12)
            .onExitCommand { }
    }
}

private struct TenantMenu: View {
    @EnvironmentObject var state: AppState
    @State private var orgSearch = ""
    @Environment(\.isSnapshot) private var snapshot

    var body: some View {
        Popover {
            // This org's brands.
            KScroll {
                VStack(spacing: 0) {
                    ForEach(state.selectedOrg?.brands ?? []) { b in
                        MenuRow(title: b.label, current: b.id == state.selectedBrand?.id, lead: {
                            Logo(domain: b.domain, name: b.label, size: 20, radius: 5)
                        }) {
                            state.menu = nil
                            if let org = state.selectedOrg { state.select(brand: b, in: org) }
                        }
                    }
                }
            }
            .frame(height: min(CGFloat(state.selectedOrg?.brands.count ?? 0) * 32, 224))
            MenuDivider()
            MenuRow(title: "New brand", lead: { PlusMark() }) { state.menu = nil; state.startNewBrand() }
            if state.selectedBrand != nil {
                MenuDivider()
                MenuLabel(text: "Offers")
                KScroll {
                    VStack(spacing: 0) {
                        ForEach(state.offers) { o in
                            MenuRow(title: o.name, current: o.offerId == state.selectedOffer?.offerId, lead: { OfferMarkView(imageUrl: o.imageUrl) }) {
                                state.menu = nil
                                state.select(offer: o)
                            }
                        }
                    }
                }
                .frame(height: min(CGFloat(state.offers.count) * 32, 192))
                MenuDivider()
                MenuRow(title: "New offer", lead: { PlusMark() }) { state.menu = nil; state.startNewOffer() }
            }
            MenuDivider()
            MenuLabel(text: "Organizations")
            if orgs.count > 8 || !orgSearch.isEmpty {
                Group {
                    if snapshot {
                        Text("Search all organizations…").font(K.body).foregroundStyle(K.fg4).frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        TextField("Search all organizations…", text: $orgSearch).textFieldStyle(.plain).font(K.body)
                    }
                }
                .padding(.horizontal, 8).frame(height: 28)
                .background(RoundedRectangle(cornerRadius: 8).fill(K.raised))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(K.line, lineWidth: 1))
                .padding(.horizontal, 4).padding(.bottom, 4)
            }
            KScroll {
                VStack(spacing: 0) {
                    ForEach(filteredOrgs) { o in
                        MenuRow(title: o.name ?? o.id, current: o.id == state.selectedOrg?.id, lead: { OrgAvatar(name: o.name ?? "?") }) {
                            state.menu = nil
                            if o.id != state.selectedOrg?.id, let b = o.brands.first { state.select(brand: b, in: o) }
                        }
                    }
                }
            }
            .frame(height: min(CGFloat(filteredOrgs.count) * 32, 192))
        }
    }

    /// Orgs the key can act in, own first (`/me` order). Only those holding a brand can be opened.
    private var orgs: [MeOrg] { (state.me?.organizations ?? []).filter { !$0.brands.isEmpty } }
    private var filteredOrgs: [MeOrg] {
        let q = orgSearch.lowercased()
        let list = q.isEmpty ? orgs : orgs.filter { ($0.name ?? "").lowercased().contains(q) || $0.brands.contains { $0.label.lowercased().contains(q) } }
        return Array(list.prefix(100))
    }
}

/// `OrgAvatar` fallback: the initial on a soft tile, 20px.
private struct OrgAvatar: View {
    let name: String
    var body: some View {
        Text(String(name.prefix(1)).uppercased()).font(.system(size: 10, weight: .semibold)).foregroundStyle(K.fg2)
            .frame(width: 20, height: 20).background(RoundedRectangle(cornerRadius: 5).fill(K.selected))
    }
}

/// `OfferMark` sm: the offer's generated image, else the tag glyph on a soft tile (18px).
struct OfferMarkView: View {
    let imageUrl: String?
    var body: some View {
        Group {
            if let s = imageUrl, let u = URL(string: s) {
                AsyncImage(url: u) { p in if let img = p.image { img.resizable().scaledToFill() } else { glyph } }
            } else { glyph }
        }
        .frame(width: 18, height: 18).clipShape(RoundedRectangle(cornerRadius: 4))
    }
    private var glyph: some View {
        SVGIcon(d: V2Icon.offer, size: 12, color: K.accent).frame(width: 18, height: 18).background(K.accentSoft)
    }
}

// MARK: - Account menu (`AccountMenuV2`)

private struct AccountButton: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        Button { state.menu = state.menu == .account ? nil : .account } label: {
            HStack(spacing: 10) {
                Text(String(displayName.prefix(1)).uppercased()).font(.system(size: 11, weight: .medium)).foregroundStyle(K.fg2)
                    .frame(width: 28, height: 28).background(Circle().fill(K.selected))
                VStack(alignment: .leading, spacing: 0) {
                    Text(displayName).font(.system(size: 13, weight: .medium)).foregroundStyle(K.fg1).lineLimit(1)
                    if hasName, let e = state.me?.user?.email { Text(e).font(K.meta).foregroundStyle(K.fg3).lineLimit(1) }
                }
                Spacer(minLength: 4)
                SVGIcon(d: V2Icon.updown, viewBox: 12, size: 12, lineWidth: 1.2)
            }
            .padding(.horizontal, 6).padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(NavHoverStyle(active: state.menu == .account))
    }
    private var hasName: Bool { !(state.me?.user?.firstName ?? "").isEmpty }
    private var displayName: String { state.me?.user?.firstName ?? state.me?.user?.email ?? "" }
}

private struct AccountMenu: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        Popover {
            Text(state.me?.user?.email ?? "").font(.system(size: 13)).foregroundStyle(K.fg3).lineLimit(1)
                .padding(.horizontal, 8).padding(.vertical, 6)
            MenuDivider()
            MenuRow(title: "API Keys", lead: { SVGIcon(d: V2Icon.key, color: K.fg2) }) { state.menu = nil; state.open(.integrations) }
            MenuRow(title: "Billing", lead: { SVGIcon(d: V2Icon.billing, color: K.fg2) }) { state.menu = nil; state.open(.billing) }
            MenuRow(title: "Help", lead: { SVGIcon(d: V2Icon.help, color: K.fg2) }) {
                state.menu = nil
                NSWorkspace.shared.open(supportURL(email: state.me?.user?.email ?? "", org: state.selectedOrg?.name ?? ""))
            }
            MenuDivider()
            MenuRow(title: "Sign out", lead: { SVGIcon(d: V2Icon.out, color: K.fg2) }) { state.menu = nil; state.signOut() }
        }
    }
}

/// The support chat the web's Help opens (`supportWhatsAppHref`, same number and words).
func supportURL(email: String, org: String) -> URL {
    let intro = email.isEmpty ? "Hi! I have a question about distribute.you:" : "Hi! I'm \(email)\(org.isEmpty ? "" : " (\(org))") and I have a question:"
    var c = URLComponents(string: "https://wa.me/33680478702")!
    c.queryItems = [URLQueryItem(name: "text", value: intro)]
    return c.url!
}
