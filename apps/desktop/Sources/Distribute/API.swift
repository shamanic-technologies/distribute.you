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

    // MARK: transport

    private func get<T: Decodable>(_ path: String, query: [String: String]) async throws -> T {
        try await send("GET", path, query: query, body: nil)
    }

    private func send<T: Decodable>(_ method: String, _ path: String, query: [String: String], body: [String: Any]?) async throws -> T {
        var comps = URLComponents(url: apiBaseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) } }
        var req = URLRequest(url: comps.url!)
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
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError(message: "\(method) \(path): unexpected response shape (\(error))")
        }
    }
}
