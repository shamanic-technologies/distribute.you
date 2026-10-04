import Foundation

/// The one channel distribute runs today. Its slug is features-service's own identifier.
let coldEmailFeatureSlug = "sales-cold-email-outreach"
let apiBaseURL = URL(string: "https://api.distribute.you/v1")!
let dashboardURL = URL(string: "https://dashboard.distribute.you")!

struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

// MARK: - Wire shapes (only the fields the app prints)

struct MeBrand: Decodable, Hashable, Identifiable {
    let id: String
    let name: String?
    let domain: String?
    var label: String { name ?? domain ?? id }
}

struct MeOrg: Decodable, Hashable, Identifiable {
    let id: String
    let name: String?
    let brands: [MeBrand]
}

struct MeUser: Decodable {
    let email: String?
    let firstName: String?
}

struct Me: Decodable {
    let user: MeUser?
    /// Null when the gateway could not look memberships up (listed in `lookupErrors`).
    let organizations: [MeOrg]?
    let lookupErrors: [LookupError]?
    struct LookupError: Decodable { let source: String; let error: String }
}

struct Balance: Decodable {
    /// Full-precision decimal string in cents, e.g. "1234.5600000000".
    let balance_cents: String
    let depleted: Bool
}

struct Campaign: Decodable, Identifiable {
    let id: String
    let name: String
    let status: String
    let featureSlug: String?
}

struct CampaignList: Decodable { let campaigns: [Campaign] }

/// One campaign's served figures from features-service (`groupBy=campaignId`, `pricing=net`).
/// Every number is SERVED: the app formats, it never computes a metric.
struct RevenueGroup: Decodable {
    let campaignId: String
    let costEconomics: CostEconomics
    let outcomes: Outcomes?

    struct CostEconomics: Decodable { let committedCostUsd: Double? }
    struct Outcomes: Decodable {
        let recipientsRepliesPositive: Double?
        let recipientsClicked: Double?
        let cpprCents: Double?
        let sending: Sending?
        struct Sending: Decodable {
            let recipientsSent: Double
            let replyRatePct: Double?
        }
    }
}

struct RevenueByCampaign: Decodable { let groups: [RevenueGroup] }

struct CheckoutSession: Decodable { let url: String }

// MARK: - Dashboard v2 reads (same routes and fields as `apps/dashboard/src/components/v2`)

struct Offer: Decodable, Identifiable, Hashable {
    let offerId: String
    let name: String
    var id: String { offerId }
}
struct OfferList: Decodable { let offers: [Offer] }

struct CampaignOffer: Decodable { let id: String; let offerId: String? }
struct CampaignOfferList: Decodable { let campaigns: [CampaignOffer] }

struct Maturity: Decodable {
    struct Figures: Decodable { let roiMultiple: Double? }
    let flash: Figures?
    let mature: Figures?
    let isMature: Bool?
}

struct RevenueOrg: Decodable, Identifiable {
    let orgId: String?
    let orgName: String?
    let orgDomain: String?
    let tags: [String]
    let expectedRevenueUsd: Double
    let mostAdvancedDate: String?
    let topPerson: TopPerson?
    struct TopPerson: Decodable { let firstName: String?; let lastName: String? }
    var id: String { orgDomain ?? orgId ?? orgName ?? UUID().uuidString }
}

struct OfferRevenue: Decodable {
    struct Headline: Decodable { let totalPipelineUsd: Double? }
    struct Cost: Decodable { let maturity: Maturity? }
    let headline: Headline?
    let costEconomics: Cost?
    let organizations: [RevenueOrg]
}

struct RevenueWindow: Decodable {
    struct Day: Decodable { let count: Double? }
    struct Count: Decodable { let total: Int; let daily: [Day]? }
    struct Emails: Decodable { let sent: Int; let delivered: Int; let bounced: Int; let deliveryRatePct: Double? }
    struct SpendDay: Decodable { let totalSpentCents: Double? }
    struct Spend: Decodable { let totalSpentCents: Double; let daily: [SpendDay]? }
    struct PipeDay: Decodable { let cumulativePipelineUsd: Double? }
    struct Pipeline: Decodable { let daily: [PipeDay]? }
    struct Body: Decodable {
        let emails: Emails?
        let spend: Spend?
        let recipientsRepliesPositive: Count?
        let recipientsClicked: Count?
        let expectedPipeline: Pipeline?
    }
    let window: Body
}

struct BucketCounts: Decodable {
    struct Counts: Decodable {
        let contacted, website_visit, positive_reply, signup, meeting_booked, meeting_attended, sale: Int
    }
    struct People: Decodable { let delivered: Int; let interested: Int }
    let counts: Counts
    let people: People?
}

struct StandingCounts: Decodable {
    struct Counts: Decodable {
        let unresolved, contacted, engaged, sales_interest, customer, opted_out, disqualified: Int
    }
    let counts: Counts
}

struct LeadRow: Decodable, Identifiable {
    let id: String
    let email: String
    let status: String
    let standing: Standing?
    struct Standing: Decodable { let state: String }
    let contacted, sent, delivered, clicked, bounced, unsubscribed, replied: Bool
    let servedAt, firstContactedAt, firstSentAt, firstDeliveredAt, firstClickedAt, firstRepliedAt, firstBouncedAt, firstUnsubscribedAt: String?
    let lead: Person?
    struct Person: Decodable {
        let firstName: String?
        let lastName: String?
        let currentTitle: String?
        let headline: String?
        let photoUrl: String?
        let linkedinUrl: String?
        let organization: Org?
        struct Org: Decodable {
            let name: String?
            let primaryDomain: String?
            let industry: String?
            let estimatedNumEmployees: Int?
            let city: String?
            let country: String?
            let shortDescription: String?
        }
    }
}
struct LeadPage: Decodable { let leads: [LeadRow]; let total: Int? }

struct Audience: Decodable, Identifiable {
    let id: String
    let name: String
    let status: String
    let nlPrompt: String?
    let sizeCount: Double?
    let availableToContactPct: Double?

    enum CodingKeys: String, CodingKey { case id, name, status, nlPrompt, sizeCount, availableToContactPct }
    /// The producer may send these counts as strings, as the dashboard's Zod coerces them.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        status = try c.decode(String.self, forKey: .status)
        nlPrompt = try c.decodeIfPresent(String.self, forKey: .nlPrompt)
        sizeCount = Self.number(c, .sizeCount)
        availableToContactPct = Self.number(c, .availableToContactPct)
    }
    private static func number(_ c: KeyedDecodingContainer<CodingKeys>, _ k: CodingKeys) -> Double? {
        if let d = try? c.decodeIfPresent(Double.self, forKey: k) { return d }
        if let s = try? c.decodeIfPresent(String.self, forKey: k) { return Double(s) }
        return nil
    }
}
struct AudienceList: Decodable { let audiences: [Audience] }

struct OfferEconomics: Decodable { let lifetimeRevenueUsd: Double?; let bookingUrl: String? }

struct LeadDetailEnvelope: Decodable { let leadDetail: LeadRow }

struct LeadHistory: Decodable {
    struct Source: Decodable { let source: String; let status: String }
    struct Destination: Decodable { let state: String?; let href: String? }
    struct Event: Decodable, Identifiable {
        let id: String
        let at: String?
        let type: String
        let evidence: String?
        let direction: String?
        let milestone: String?
        let from: String?
        let to: [String]?
        let subject: String?
        let bodyText: String?
        let bodyStatus: String?
        let kind: String?
        let step: String?
        let event: String?
        let note: String?
        let state: String?
        let dueAt: String?
        let stoppedReason: String?
        let destination: Destination?
    }
    let events: [Event]
    let sources: [Source]?
}

struct ApiKeyInfo: Decodable, Identifiable { let id: String; let keyPrefix: String; let name: String?; let createdAt: String; let lastUsedAt: String? }
struct ApiKeyList: Decodable { let keys: [ApiKeyInfo] }
struct NewApiKey: Decodable { let key: String }

struct BrandInfo: Decodable { let id: String; let domain: String?; let name: String?; let url: String?; let clickDestinationUrl: String? }
struct BrandEnvelope: Decodable { let brand: BrandInfo }

struct SalesRep: Decodable { let salesRepEmail: String?; let salesRepPhone: String?; let salesRepFirstName: String?; let salesRepRole: String? }

struct SalesBudget: Decodable {
    let mode: String
    let dailyBudgetCents: Double?
    enum CodingKeys: String, CodingKey { case mode, dailyBudgetCents }
    /// Served as a number or a numeric string.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        mode = try c.decode(String.self, forKey: .mode)
        if let d = try? c.decodeIfPresent(Double.self, forKey: .dailyBudgetCents) { dailyBudgetCents = d }
        else if let s = try? c.decodeIfPresent(String.self, forKey: .dailyBudgetCents) { dailyBudgetCents = Double(s) }
        else { dailyBudgetCents = nil }
    }
}

struct ConversionToken: Decodable { let token: String; let ingestUrl: String; let status: String? }

struct BillingAccount: Decodable {
    let payment_mode: String?
    let credited_cents: String
    let balance_cents: String
    let has_payment_method: Bool
    let has_auto_topup: Bool
    let auto_reload_supported: Bool?
    let card_brand: String?
    let card_last4: String?
}
struct Payment: Decodable, Identifiable { let id: String; let amount: Int; let currency: String; let status: String; let created: Double }
struct PaymentList: Decodable { let data: [Payment] }

struct CreatedBrand: Decodable { let brandId: String }
struct OfferProposal: Decodable, Hashable { let name: String; let description: String; let icon: String? }
struct OfferProposals: Decodable { let offers: [OfferProposal]; let mainOfferIndex: Int? }
struct ConfirmedOffer: Decodable { let chosenOfferId: String }

struct UserFields: Decodable {
    let fields: [String: Field]
    struct Field: Decodable {
        let value: [String]
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: Keys.self)
            if let s = try? c.decode(String.self, forKey: .value) { value = [s] }
            else if let a = try? c.decode([String].self, forKey: .value) { value = a }
            else { value = [] }
        }
        enum Keys: String, CodingKey { case value }
    }
}

// MARK: - Client

struct DistributeAPI {
    let apiKey: String

    func me() async throws -> Me {
        try await get("/me", query: [:])
    }

    func balance(orgId: String) async throws -> Balance {
        try await get("/billing/accounts/balance", query: ["orgId": orgId])
    }

    func campaigns(brandId: String) async throws -> [Campaign] {
        let list: CampaignList = try await get("/campaigns", query: ["brandId": brandId])
        return list.campaigns
    }

    func coldEmailRevenue(brandId: String) async throws -> [RevenueGroup] {
        let res: RevenueByCampaign = try await get(
            "/features/\(coldEmailFeatureSlug)/revenue",
            query: ["brandId": brandId, "groupBy": "campaignId", "pricing": "net"]
        )
        return res.groups
    }

    /// Prepaid top-up: a hosted Stripe checkout the app opens in the browser.
    func topUpCheckout(orgId: String, amountCents: Int) async throws -> URL {
        let back = "https://distribute.you/desktop/topped-up"
        let session: CheckoutSession = try await send(
            "POST", "/billing/checkout-sessions", query: ["orgId": orgId],
            body: ["topup_amount_cents": amountCents, "success_url": back, "cancel_url": back]
        )
        guard let url = URL(string: session.url) else {
            throw APIError(message: "Checkout returned an invalid URL: \(session.url)")
        }
        return url
    }

    func offers(brandId: String) async throws -> [Offer] {
        let l: OfferList = try await get("/brands/\(brandId)/offers", query: [:]); return l.offers
    }
    func campaignOffers(brandId: String) async throws -> [CampaignOffer] {
        let l: CampaignOfferList = try await get("/campaigns", query: ["brandId": brandId]); return l.campaigns
    }
    func offerRevenue(offerId: String, brandId: String) async throws -> OfferRevenue {
        try await get("/offers/\(offerId)/revenue", query: ["brandId": brandId, "pricing": "net"])
    }
    func offerWindow(offerId: String, brandId: String, days: Int) async throws -> RevenueWindow {
        try await get("/offers/\(offerId)/revenue", query: ["brandId": brandId, "pricing": "net", "windowDays": String(days)])
    }
    func bucketCounts(brandId: String, offerId: String) async throws -> BucketCounts {
        try await get("/leads/bucket-counts", query: ["brandId": brandId, "offerId": offerId])
    }
    func standingCounts(brandId: String, offerId: String) async throws -> StandingCounts {
        try await get("/leads/standing-counts", query: ["brandId": brandId, "offerId": offerId])
    }
    func leads(brandId: String, offerId: String, extra: [String: String]) async throws -> LeadPage {
        var q = ["brandId": brandId, "offerId": offerId, "view": "basic", "sort": "activity"]
        q.merge(extra) { _, new in new }
        return try await get("/leads", query: q)
    }
    func audiences(brandId: String, offerId: String, status: String) async throws -> [Audience] {
        let l: AudienceList = try await get("/orgs/audiences", query: ["brandId": brandId, "offerId": offerId, "status": status]); return l.audiences
    }
    func offerEconomics(brandId: String, offerId: String) async throws -> OfferEconomics {
        try await get("/brands/\(brandId)/offers/\(offerId)/economics", query: [:])
    }
    func offerUserFields(brandId: String, offerId: String) async throws -> UserFields {
        try await get("/brands/\(brandId)/offers/\(offerId)/user-fields", query: [:])
    }

    func leadDetail(id: String, brandId: String) async throws -> LeadRow {
        let e: LeadDetailEnvelope = try await get("/leads/\(id)", query: ["brandId": brandId]); return e.leadDetail
    }
    func leadHistory(id: String, brandId: String) async throws -> LeadHistory {
        try await get("/leads/\(id)/history", query: ["brandId": brandId, "scope": "campaign"])
    }
    func companyPeople(brandId: String, offerId: String, orgName: String) async throws -> LeadPage {
        try await leads(brandId: brandId, offerId: offerId, extra: ["limit": "50", "q": orgName])
    }
    func apiKeys() async throws -> [ApiKeyInfo] { let l: ApiKeyList = try await get("/api-keys", query: [:]); return l.keys }
    func createApiKey(name: String) async throws -> String {
        let k: NewApiKey = try await send("POST", "/api-keys", query: [:], body: ["name": name]); return k.key
    }
    func deleteApiKey(id: String) async throws { try await sendIgnoringBody("DELETE", "/api-keys/\(id)", query: [:], body: nil) }
    func brand(id: String) async throws -> BrandInfo { let e: BrandEnvelope = try await get("/brands/\(id)", query: [:]); return e.brand }
    func renameBrand(id: String, name: String) async throws { try await sendIgnoringBody("PATCH", "/brands/\(id)", query: [:], body: ["name": name]) }
    func salesRep(brandId: String) async throws -> SalesRep { try await get("/brands/\(brandId)/sales-rep", query: [:]) }
    func setSalesRep(brandId: String, email: String, phone: String?, firstName: String?, role: String?) async throws {
        var body: [String: Any] = ["salesRepEmail": email]
        body["salesRepPhone"] = phone ?? NSNull(); body["salesRepFirstName"] = firstName ?? NSNull(); body["salesRepRole"] = role ?? NSNull()
        try await sendIgnoringBody("PUT", "/brands/\(brandId)/sales-rep", query: [:], body: body)
    }
    func setBookingUrl(brandId: String, offerId: String, url: String?) async throws {
        try await sendIgnoringBody("PUT", "/brands/\(brandId)/offers/\(offerId)/economics", query: [:], body: ["bookingUrl": url ?? NSNull()])
    }
    func salesBudget(brandId: String) async throws -> SalesBudget { try await get("/brands/\(brandId)/sales-budget", query: [:]) }
    func setSalesBudget(brandId: String, cents: Int) async throws {
        try await sendIgnoringBody("PUT", "/brands/\(brandId)/sales-budget", query: [:], body: ["dailyBudgetCents": cents])
    }
    func conversionToken(brandId: String) async throws -> ConversionToken { try await get("/brands/\(brandId)/conversion-token", query: [:]) }
    func billingAccount(orgId: String) async throws -> BillingAccount { try await get("/billing/accounts", query: ["orgId": orgId]) }
    func payments(orgId: String) async throws -> [Payment] { let l: PaymentList = try await get("/billing/payments", query: ["orgId": orgId]); return l.data }
    func setAutoTopUp(orgId: String, on: Bool) async throws {
        if on {
            try await sendIgnoringBody("PATCH", "/billing/accounts/auto_topup", query: ["orgId": orgId], body: ["topup_amount_cents": 5000, "topup_threshold_cents": 500])
        } else {
            try await sendIgnoringBody("DELETE", "/billing/accounts/auto_topup", query: ["orgId": orgId], body: nil)
        }
    }
    func createBrand(orgId: String, url: String) async throws -> String {
        let b: CreatedBrand = try await send("POST", "/brands", query: ["orgId": orgId], body: ["url": url]); return b.brandId
    }
    func proposeOffers(brandId: String, description: String) async throws -> OfferProposals {
        try await send("POST", "/brands/\(brandId)/offers/proposals", query: ["brandId": brandId], body: ["description": description], timeout: 150)
    }
    func confirmOffer(brandId: String, offers: [OfferProposal], chosen: Int) async throws -> String {
        let list = offers.map { ["name": $0.name, "description": $0.description, "icon": $0.icon ?? ""] }
        let r: ConfirmedOffer = try await send("POST", "/brands/\(brandId)/offers/confirm", query: ["brandId": brandId], body: ["offers": list, "chosenIndex": chosen])
        return r.chosenOfferId
    }

    // MARK: transport

    private func get<T: Decodable>(_ path: String, query: [String: String]) async throws -> T {
        try await send("GET", path, query: query, body: nil)
    }

    private func sendIgnoringBody(_ method: String, _ path: String, query: [String: String], body: [String: Any]?) async throws {
        _ = try await raw(method, path, query: query, body: body, timeout: 60)
    }

    private func send<T: Decodable>(_ method: String, _ path: String, query: [String: String], body: [String: Any]?, timeout: TimeInterval = 60) async throws -> T {
        let data = try await raw(method, path, query: query, body: body, timeout: timeout)
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError(message: "\(method) \(path): unexpected response shape (\(error))")
        }
    }

    private func raw(_ method: String, _ path: String, query: [String: String], body: [String: Any]?, timeout: TimeInterval) async throws -> Data {
        var comps = URLComponents(url: apiBaseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) } }
        var req = URLRequest(url: comps.url!)
        req.timeoutInterval = timeout
        req.httpMethod = method
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw APIError(message: "\(method) \(path) failed (\(status)): \(text.prefix(300))")
        }
        return data
    }
}
