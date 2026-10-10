import Foundation
import AppKit

/// One campaign joined to ITS served figures by campaign id.
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

enum SidebarMenu { case tenant, account }

/// A record opened from a panel row: its detail replaces the list, Back returns.
enum Detail {
    case person(LeadRow)
    case company(RevenueOrg)
    case conversation(UniboxPerson)
}

@MainActor
final class AppState: ObservableObject {
    @Published var detail: Detail?
    /// Which sidebar popover is open (the web's tenant switcher or account menu).
    @Published var menu: SidebarMenu?
    /// Bumped to put the cursor in the chat ("Search or ask…", ⌘K).
    @Published var focusTick = 0
    @Published var addingBrand = false
    @Published var creatingOffer = false

    func focusChat() { menu = nil; focusTick += 1 }
    func startNewBrand() { addingBrand = true; focusChat() }
    func startNewOffer() { creatingOffer = true; pane = .offer; detail = nil }
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
    /// The selected offer's ON campaigns (sidebar Campaigns) and the steps they land on (sidebar Outcomes).
    @Published var onCampaigns: [OnCampaign] = []
    @Published var outcomes: [OutcomeEntry] = []
    /// lead-service's bucket counts for the selected offer: the People badge and each outcome's count.
    @Published var bucketCounts: BucketCounts.Counts?
    /// The offer's campaigns as the Sales path lists them (Campaigns > Overview, names, order).
    @Published var salesPaths: Load<OfferSalesPaths> = .idle
    /// The platform catalogue (legs, campaign names): the same for every tenant, read once.
    private var legCatalogue: LegCatalogue?
    @Published var balance: Balance?

    @Published var pane: Pane? = .today
    @Published var peopleBucket = "contacted"
    @Published var today: Load<TodayData> = .idle
    @Published var companies: Load<OfferRevenue> = .idle
    @Published var people: Load<LeadPage> = .idle
    @Published var deals: Load<DealsData> = .idle
    @Published var offerData: Load<OfferData> = .idle
    @Published var audiences: Load<[Audience]> = .idle
    @Published var campaignFigures: Load<RevenueGroup?> = .idle
    @Published var outcomePeople: Load<LeadPage> = .idle
    @Published var unibox: Load<UniboxPeople> = .idle

    @Published var cli: ClaudeCLI.Located?
    @Published var cliChecked = false
    @Published var chat: [ChatItem] = []
    @Published var chatBusy = false
    @Published var draft = ""
    private let session = ClaudeSession()
    /// The assistant bubble being written right now (streamed text).
    private var streamingIndex: Int?
    private let browserLogin = BrowserLogin()
    @Published var signingIn = false

    var api: DistributeAPI? { apiKey.map { DistributeAPI(apiKey: $0, orgId: selectedOrg?.id) } }

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
            Notifier.shared.start(state: self)
        } catch {
            loadError = error.localizedDescription
        }
        await refreshAll()
    }

    private func resetPanels() {
        counts = SidebarCounts()
        today = .idle; companies = .idle; people = .idle; deals = .idle
        offerData = .idle; audiences = .idle; campaignFigures = .idle; outcomePeople = .idle; unibox = .idle
        onCampaigns = []; outcomes = []; bucketCounts = nil; salesPaths = .idle
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
        await refreshCampaigns(api: api, brandId: brand.id, offerId: offer.offerId)
        do {
            let campaigns = try await api.campaigns(brandId: brand.id)
            offerHasCampaign = campaigns.contains { $0.offerId == offer.offerId }
            async let buckets = api.bucketCounts(brandId: brand.id, offerId: offer.offerId)
            async let standing = api.standingCounts(brandId: brand.id, offerId: offer.offerId)
            async let needs = api.leads(brandId: brand.id, offerId: offer.offerId, extra: ["bucket": "positive_reply", "standing": "sales_interest", "limit": "5"])
            let (bk, st, nc) = try await (buckets, standing, needs)
            var c = SidebarCounts()
            c.people = bk.counts.contacted
            bucketCounts = bk.counts
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

    /// Campaigns and Outcomes: the brand's campaigns, the leg catalogue and the offer's
    /// sales-path campaigns, joined as dashboard v2's `useOngoingCampaigns` joins them.
    private func refreshCampaigns(api: DistributeAPI, brandId: String, offerId: String) async {
        if case .idle = salesPaths { salesPaths = .loading }
        do {
            async let campaigns = api.campaigns(brandId: brandId)
            async let paths = api.offerSalesPaths(brandId: brandId, offerId: offerId)
            if legCatalogue == nil { legCatalogue = LegCatalogue(try await api.publicCatalogue()) }
            let (c, p) = try await (campaigns, paths)
            guard offerId == selectedOffer?.offerId else { return }
            salesPaths = .loaded(p)
            let joined = joinOnCampaigns(campaigns: c, offerId: offerId, catalogue: legCatalogue ?? LegCatalogue(), paths: p)
            onCampaigns = joined.campaigns
            outcomes = joined.outcomes
        } catch {
            NSLog("[desktop] campaigns failed: \(error.localizedDescription)")
            salesPaths = .failed(error.localizedDescription)
        }
    }

    // MARK: panels

    func open(_ p: Pane) {
        detail = nil
        pane = (pane == p) ? nil : p
        if let pane { Task { await load(pane) } }
    }

    func openPerson(_ lead: LeadRow) { detail = .person(lead) }

    func openCompany(_ org: RevenueOrg) {
        if pane != .companies { pane = .companies; Task { await load(.companies) } }
        detail = .company(org)
    }

    /// A brand straight from its website, in the selected org (or the only one).
    func addBrand(url: String) async throws {
        guard let api, let org = selectedOrg ?? me?.organizations?.first else {
            throw APIError(message: "No organization to add the brand to.")
        }
        let id = try await api.createBrand(orgId: org.id, url: url)
        let fresh = try await api.me()
        me = fresh
        if let o = fresh.organizations?.first(where: { $0.id == org.id }), let b = o.brands.first(where: { $0.id == id }) {
            addingBrand = false
            selectedBrand = nil
            select(brand: b, in: o)
        }
    }

    /// The offer the person picked from the proposals becomes the selected one.
    func offerCreated(_ offerId: String) async {
        guard let api, let brand = selectedBrand else { return }
        if let list = try? await api.offers(brandId: brand.id) {
            offers = list
            if let o = list.first(where: { $0.offerId == offerId }) { creatingOffer = false; select(offer: o) }
        }
    }

    func load(_ p: Pane) async {
        guard let api, let brand = selectedBrand else { return }
        guard let offer = selectedOffer else {
            let none = "This brand has no offer yet. Create it in Offer."
            switch p {
            case .today: today = .failed(none)
            case .companies: companies = .failed(none)
            case .people: people = .failed(none)
            case .deals: deals = .failed(none)
            case .offer: offerData = .failed(none)
            case .campaigns: salesPaths = .failed(none)
            case .outcome: outcomePeople = .failed(none)
            case .unibox: await loadUnibox(api: api, brandId: brand.id)
            case .campaign, .outcomes, .integrations, .settings, .billing: break
            }
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
                async let win = api.offerSinceInception(offerId: o, brandId: b)
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
            // Targeting lives inside the Offer (owner 2026-10-10).
            await run({ audiences = $0 }) {
                async let active = api.audiences(brandId: b, offerId: o, status: "active")
                async let paused = api.audiences(brandId: b, offerId: o, status: "paused")
                return try await active + paused
            }
            await run({ offerData = $0 }) {
                async let econ = api.offerEconomics(brandId: b, offerId: o)
                async let fields = api.offerUserFields(brandId: b, offerId: o)
                let f = try await fields
                return OfferData(lifetimeRevenueUsd: try await econ.lifetimeRevenueUsd, fields: f.fields.mapValues(\.value))
            }
        case .unibox:
            await loadUnibox(api: api, brandId: b)
        case .campaigns:
            await refreshCampaigns(api: api, brandId: b, offerId: o)
        case .campaign(let id):
            guard let slug = onCampaigns.first(where: { $0.id == id })?.campaign.featureSlug else { campaignFigures = .loaded(nil); return }
            // The campaign's own feature serves its figures; a campaign with no row there yet reads "—".
            await run({ campaignFigures = $0 }) {
                try await api.featureRevenue(featureSlug: slug, brandId: b).first { $0.campaignId == id }
            }
        case .outcome(let key):
            let outcome = outcomes.first { $0.outcome.key == key }?.outcome ?? outcomeOf(featureSlug: nil, toKey: key)
            switch outcome?.items {
            case .people(let bucket):
                await run({ outcomePeople = $0 }) { try await api.leads(brandId: b, offerId: o, extra: ["bucket": bucket, "limit": "50"]) }
            case .leadsFound:
                await run({ audiences = $0 }) {
                    async let active = api.audiences(brandId: b, offerId: o, status: "active")
                    async let paused = api.audiences(brandId: b, offerId: o, status: "paused")
                    return try await active + paused
                }
            default:
                break
            }
        case .outcomes, .integrations, .settings, .billing:
            break
        }
    }

    private func loadUnibox(api: DistributeAPI, brandId: String) async {
        unibox = .loading
        do { unibox = .loaded(try await api.people(brandId: brandId)) } catch { unibox = .failed(error.localizedDescription) }
    }

    /// The title of what is open beside the chat: a campaign by its name, an outcome by its step.
    func title(of p: Pane) -> String {
        switch p {
        case .campaign(let id): return onCampaigns.first { $0.id == id }?.label ?? "Campaign"
        case .outcome(let key): return (outcomes.first { $0.outcome.key == key }?.outcome ?? outcomeOf(featureSlug: nil, toKey: key))?.label ?? "Outcome"
        default: return p.title
        }
    }

    func setPeopleBucket(_ bucket: String) {
        peopleBucket = bucket
        Task { await load(.people) }
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
            offerId: selectedOffer?.offerId, offerName: selectedOffer?.name, looking: pane.map(title(of:))
        )
        streamingIndex = nil
        session.send(text, cli: cli, context: ctx, onItem: { [weak self] item in
            guard let self else { return }
            self.streamingIndex = nil
            self.chat.append(item)
        }, onDelta: { [weak self] delta in
            guard let self else { return }
            if let i = self.streamingIndex, i < self.chat.count, case .assistant(let id, let t) = self.chat[i] {
                self.chat[i] = .assistant(id: id, text: t + delta)
            } else {
                self.chat.append(.assistant(id: UUID(), text: delta))
                self.streamingIndex = self.chat.count - 1
            }
        }, onText: { [weak self] full in
            guard let self else { return }
            if let i = self.streamingIndex, i < self.chat.count, case .assistant(let id, _) = self.chat[i] {
                self.chat[i] = .assistant(id: id, text: full)
            } else {
                self.chat.append(.assistant(id: UUID(), text: full))
            }
            self.streamingIndex = nil
        }, onDone: { [weak self] in
            guard let self else { return }
            self.streamingIndex = nil
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
