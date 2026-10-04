import Foundation
import AppKit

/// One row of the channel panel: a campaign joined to ITS served figures by campaign id.
struct CampaignRow: Identifiable {
    let campaign: Campaign
    let figures: RevenueGroup?
    var id: String { campaign.id }
}

/// The four sidebar counts dashboard v2 shows, from the same reads.
struct SidebarCounts {
    var needsCall: Int?
    var companies: Int?
    var people: Int?
    var deals: Int?
}

/// A panel's read: not asked yet, loading, answered, or failed (stated, never hidden).
enum Load<T> {
    case idle, loading, loaded(T), failed(String)
    var value: T? { if case .loaded(let v) = self { return v } else { return nil } }
}

struct TodayData {
    let revenue: OfferRevenue?
    let window: RevenueWindow?
    let needsCall: LeadPage
}

struct DealsData {
    let standing: StandingCounts
    let pipelineUsd: Double?
}

struct OfferData {
    let lifetimeRevenueUsd: Double?
    let fields: [String: [String]]
}

@MainActor
final class AppState: ObservableObject {
    @Published var apiKey: String? = Keychain.read()
    @Published var me: Me?
    @Published var loadError: String?
    @Published var selectedBrand: MeBrand?
    @Published var selectedOrg: MeOrg?

    @Published var offers: [Offer] = []
    @Published var selectedOffer: Offer?
    /// Whether the selected offer has a campaign: without one, money reads 404 by design.
    @Published var offerHasCampaign = false
    @Published var counts = SidebarCounts()
    @Published var balance: Balance?

    @Published var pane: Pane? = .today
    @Published var windowDays = 7
    @Published var peopleBucket = "contacted"
    @Published var today: Load<TodayData> = .idle
    @Published var companies: Load<OfferRevenue> = .idle
    @Published var people: Load<LeadPage> = .idle
    @Published var deals: Load<DealsData> = .idle
    @Published var offerData: Load<OfferData> = .idle
    @Published var audiences: Load<[Audience]> = .idle
    @Published var rows: Load<[CampaignRow]> = .idle

    @Published var cli: ClaudeCLI.Located?
    @Published var cliChecked = false
    @Published var chat: [ChatItem] = []
    @Published var chatBusy = false
    @Published var draft = ""
    private let session = ClaudeSession()
    private let browserLogin = BrowserLogin()
    @Published var signingIn = false

    var api: DistributeAPI? { apiKey.map(DistributeAPI.init(apiKey:)) }

    // MARK: sign-in

    /// Google or email in the browser, on the dashboard's own sign-in; the key comes back by itself.
    func signInWithBrowser() {
        loadError = nil
        signingIn = true
        browserLogin.start { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let key):
                Task {
                    await self.connect(key: key)
                    self.signingIn = false
                    NSApp.activate(ignoringOtherApps: true)
                }
            case .failure(let error):
                self.signingIn = false
                self.loadError = error.localizedDescription
            }
        }
    }

    func cancelBrowserSignIn() {
        browserLogin.stop()
        signingIn = false
    }

    func connect(key: String) async {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let me = try await DistributeAPI(apiKey: trimmed).me()
            Keychain.save(trimmed)
            apiKey = trimmed
            apply(me)
        } catch {
            loadError = error.localizedDescription
        }
    }

    func signOut() {
        Keychain.delete()
        session.reset()
        apiKey = nil; me = nil; selectedBrand = nil; selectedOrg = nil; selectedOffer = nil
        offers = []; counts = SidebarCounts(); balance = nil; chat = []
        resetPanels()
    }

    func boot() async {
        if !cliChecked {
            cli = await Task.detached { ClaudeCLI.locate() }.value
            cliChecked = true
        }
        guard let api else { return }
        do { apply(try await api.me()) } catch { loadError = error.localizedDescription }
    }

    private func apply(_ me: Me) {
        self.me = me
        loadError = nil
        if me.organizations == nil {
            let why = (me.lookupErrors ?? []).map { "\($0.source): \($0.error)" }.joined(separator: "; ")
            loadError = "Could not load your brands. \(why)"
            return
        }
        if selectedBrand == nil, let org = me.organizations?.first(where: { !$0.brands.isEmpty }) {
            select(brand: org.brands[0], in: org)
        }
    }

    // MARK: brand and offer

    func select(brand: MeBrand, in org: MeOrg) {
        guard brand.id != selectedBrand?.id else { return }
        selectedBrand = brand
        selectedOrg = org
        selectedOffer = nil
        offers = []
        session.reset()
        chat = []
        resetPanels()
        Task { await loadBrand() }
    }

    /// Every brand page reads ONE offer: the one picked here (remembered per brand), else the first.
    func select(offer: Offer) {
        guard let brand = selectedBrand else { return }
        UserDefaults.standard.set(offer.offerId, forKey: "offer-\(brand.id)")
        selectedOffer = offer
        resetPanels()
        Task { await refreshAll() }
    }

    private func loadBrand() async {
        guard let api, let brand = selectedBrand else { return }
        do {
            let list = try await api.offers(brandId: brand.id)
            guard brand.id == selectedBrand?.id else { return }
            offers = list
            let remembered = UserDefaults.standard.string(forKey: "offer-\(brand.id)")
            selectedOffer = list.first(where: { $0.offerId == remembered }) ?? list.first
        } catch {
            loadError = error.localizedDescription
        }
        await refreshAll()
    }

    private func resetPanels() {
        counts = SidebarCounts()
        today = .idle; companies = .idle; people = .idle; deals = .idle
        offerData = .idle; audiences = .idle; rows = .idle
    }

    /// Re-reads the sidebar and the open panel (after a brand/offer pick or a chat turn).
    func refreshAll() async {
        await refreshSidebar()
        if let pane { await load(pane) }
    }

    private func refreshSidebar() async {
        guard let api, let brand = selectedBrand, let org = selectedOrg else { return }
        if let b = try? await api.balance(orgId: org.id) { balance = b }
        guard let offer = selectedOffer else { return }
        do {
            let campaigns = try await api.campaignOffers(brandId: brand.id)
            offerHasCampaign = campaigns.contains { $0.offerId == offer.offerId }
            async let buckets = api.bucketCounts(brandId: brand.id, offerId: offer.offerId)
            async let standing = api.standingCounts(brandId: brand.id, offerId: offer.offerId)
            async let needs = api.leads(brandId: brand.id, offerId: offer.offerId, extra: ["bucket": "positive_reply", "standing": "sales_interest", "limit": "5"])
            let (bk, st, nc) = try await (buckets, standing, needs)
            var c = SidebarCounts()
            c.people = bk.counts.contacted
            // Deals badge = Contacted + Interested + Close won, as v2 adds the board columns.
            c.deals = st.counts.contacted + st.counts.engaged + st.counts.sales_interest + st.counts.customer
            c.needsCall = nc.total
            if offerHasCampaign {
                c.companies = try await api.offerRevenue(offerId: offer.offerId, brandId: brand.id).organizations.count
            }
            counts = c
        } catch {
            NSLog("[desktop] sidebar counts failed: \(error.localizedDescription)")
        }
    }

    // MARK: panels

    func open(_ p: Pane) {
        if p.opensDashboard {
            NSWorkspace.shared.open(dashboardLink(for: p))
            return
        }
        pane = (pane == p) ? nil : p
        if let pane { Task { await load(pane) } }
    }

    func load(_ p: Pane) async {
        guard let api, let brand = selectedBrand else { return }
        guard let offer = selectedOffer else {
            let none = "This brand has no offer yet. Add one on the dashboard."
            switch p {
            case .today: today = .failed(none)
            case .companies: companies = .failed(none)
            case .people: people = .failed(none)
            case .deals: deals = .failed(none)
            case .offer: offerData = .failed(none)
            case .targeting: audiences = .failed(none)
            case .channels: break
            case .integrations, .settings: break
            }
            if p == .channels { await loadChannels(api: api, brandId: brand.id) }
            return
        }
        let b = brand.id, o = offer.offerId
        func run<T>(_ set: (Load<T>) -> Void, _ work: () async throws -> T) async {
            set(.loading)
            do { set(.loaded(try await work())) } catch { set(.failed(error.localizedDescription)) }
        }
        switch p {
        case .today:
            await run({ today = $0 }) {
                async let needs = api.leads(brandId: b, offerId: o, extra: ["bucket": "positive_reply", "standing": "sales_interest", "limit": "5"])
                guard offerHasCampaign else { return TodayData(revenue: nil, window: nil, needsCall: try await needs) }
                async let rev = api.offerRevenue(offerId: o, brandId: b)
                async let win = api.offerWindow(offerId: o, brandId: b, days: windowDays)
                return TodayData(revenue: try await rev, window: try await win, needsCall: try await needs)
            }
        case .companies:
            guard offerHasCampaign else { companies = .failed("No campaign runs this offer yet, so no company has been reached."); return }
            await run({ companies = $0 }) { try await api.offerRevenue(offerId: o, brandId: b) }
        case .people:
            await run({ people = $0 }) { try await api.leads(brandId: b, offerId: o, extra: ["bucket": peopleBucket, "limit": "50"]) }
        case .deals:
            await run({ deals = $0 }) {
                let st = try await api.standingCounts(brandId: b, offerId: o)
                var pipe: Double? = nil
                if offerHasCampaign { pipe = try await api.offerRevenue(offerId: o, brandId: b).headline?.totalPipelineUsd }
                return DealsData(standing: st, pipelineUsd: pipe)
            }
        case .offer:
            await run({ offerData = $0 }) {
                async let econ = api.offerEconomics(brandId: b, offerId: o)
                async let fields = api.offerUserFields(brandId: b, offerId: o)
                let f = try await fields
                return OfferData(lifetimeRevenueUsd: try await econ.lifetimeRevenueUsd, fields: f.fields.mapValues(\.value))
            }
        case .targeting:
            await run({ audiences = $0 }) {
                async let active = api.audiences(brandId: b, offerId: o, status: "active")
                async let paused = api.audiences(brandId: b, offerId: o, status: "paused")
                return try await active + paused
            }
        case .channels:
            await loadChannels(api: api, brandId: b)
        case .integrations, .settings:
            break
        }
    }

    private func loadChannels(api: DistributeAPI, brandId: String) async {
        rows = .loading
        do {
            async let campaigns = api.campaigns(brandId: brandId)
            async let revenue = api.coldEmailRevenue(brandId: brandId)
            let (c, r) = try await (campaigns, revenue)
            let byId = Dictionary(r.map { ($0.campaignId, $0) }, uniquingKeysWith: { a, _ in a })
            rows = .loaded(c.filter { $0.featureSlug == coldEmailFeatureSlug }.map { CampaignRow(campaign: $0, figures: byId[$0.id]) })
        } catch {
            rows = .failed(error.localizedDescription)
        }
    }

    func setWindow(_ days: Int) {
        windowDays = days
        Task { await load(.today) }
    }

    func setPeopleBucket(_ bucket: String) {
        peopleBucket = bucket
        Task { await load(.people) }
    }

    /// The dashboard v2 page a pane mirrors (`apps/dashboard/src/lib/v2/routes.ts`).
    func dashboardLink(for p: Pane?) -> URL {
        guard let org = selectedOrg, let brand = selectedBrand else { return dashboardURL }
        let base = "\(dashboardURL.absoluteString)/v2/orgs/\(org.id)/brands/\(brand.id)"
        let offer = selectedOffer.map { "/offers/\($0.offerId)" } ?? "/offers"
        let suffix: String
        switch p {
        case nil, .today?: suffix = ""
        case .companies?: suffix = "/companies"
        case .people?: suffix = "/people"
        case .deals?: suffix = "/deals"
        case .offer?: suffix = offer
        case .targeting?: suffix = selectedOffer == nil ? "/targeting" : "\(offer)/targeting"
        case .channels?: suffix = selectedOffer == nil ? "/channels" : "\(offer)/channels"
        case .integrations?: suffix = "/integrations/ai"
        case .settings?: suffix = "/settings"
        }
        return URL(string: base + suffix) ?? dashboardURL
    }

    func topUp(cents: Int) async {
        guard let api, let org = selectedOrg else { return }
        do {
            NSWorkspace.shared.open(try await api.topUpCheckout(orgId: org.id, amountCents: cents))
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: chat

    func ask(_ text: String) {
        draft = text
    }

    func send(_ text: String) {
        guard let cli, let apiKey, let brand = selectedBrand, let org = selectedOrg, !chatBusy else { return }
        chat.append(.user(id: UUID(), text: text))
        chatBusy = true
        let ctx = SessionContext(
            apiKey: apiKey, orgId: org.id, brandId: brand.id, brandName: brand.label,
            offerId: selectedOffer?.offerId, offerName: selectedOffer?.name, looking: pane?.title
        )
        session.send(text, cli: cli, context: ctx, onItem: { [weak self] item in
            self?.chat.append(item)
        }, onDone: { [weak self] in
            guard let self else { return }
            self.chatBusy = false
            // The chat may have changed a budget, an audience or sending: re-read what is on screen.
            Task { await self.refreshAll() }
        })
    }

    func stopChat() { session.stop() }

    func newChat() {
        session.reset()
        chat = []
    }
}
