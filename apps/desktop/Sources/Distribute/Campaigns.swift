import SwiftUI

// The sidebar's Campaigns and Outcomes (owner 2026-10-10), ported from dashboard v2's
// `components/v2/ongoing-campaigns.ts` and `lib/v2/outcomes.ts`: every ON campaign of the
// selected offer (any kind, named and ordered as the web lists it), and one outcome per
// step those campaigns land on. Same served reads; nothing is counted here.

// MARK: - Wire shapes

/// `GET /public/channels`: the platform's steps, legs and campaign names (no org, no brand).
struct PublicCatalogue: Decodable {
    struct Step: Decodable { let key: String?; let label: String? }
    struct Leg: Decodable { let legKey: String?; let fromStep: Step?; let toStep: Step? }
    struct Transition: Decodable { let legKey: String?; let from: Step?; let to: Step?; let campaignName: String?; let crewName: String? }
    struct Channel: Decodable { let slug: String?; let name: String?; let stepTransitions: [Transition]? }
    let steps: [Step]?
    let legs: [Leg]?
    let channels: [Channel]?
}

/// `GET /offers/:id/sales-paths?scope=catalogue`: the offer's campaigns, as the Sales path page lists them.
struct OfferSalesPaths: Decodable {
    struct Step: Decodable { let key: String; let label: String }
    struct Outreach: Decodable {
        let channelSlug: String
        let channelName: String?
        let legKey: String
        let campaignName: String?
        let reactive: Bool
        let operatedBy: String?
        let selectedPathCount: Double
        let roi: Double?
    }
    struct Source: Decodable {
        let channelSlug: String
        let channelName: String?
        let legKey: String
        let campaignName: String?
        let toStep: Step
        let live: Bool
        let roi: Double?
    }
    let campaigns: [Outreach]?
    let sourceCampaigns: [Source]?
}

/// crm-service's people, one per person on every channel (the Unibox list).
struct UniboxPerson: Decodable, Identifiable {
    let personKey: String
    let personId: String?
    let displayName: String?
    let company: String?
    let emails: [String]
    let sources: [String]
    let lastActivityAt: String?
    let state: String
    var id: String { personId ?? personKey }
    var name: String { displayName ?? emails.first ?? personKey }
}
struct UniboxPeople: Decodable { let total: Int; let people: [UniboxPerson] }

/// One person's whole exchange, every channel merged, oldest first.
struct PersonTimeline: Decodable {
    struct Item: Decodable {
        let at: String?
        let source: String
        let channel: String
        let kind: String
        let direction: String?
        let subject: String?
        let text: String?
        let from: String?
    }
    struct Source: Decodable { let source: String; let status: String; let error: String? }
    let items: [Item]
    let sources: [Source]
}

// MARK: - The outbound leg rename (`lib/outbound-leg-key.ts`, LOCKED 2026-10-09)

private let outboundFeatureSlugs: Set<String> = [
    "sales-cold-email-outreach", "feedback-request-cold-email-outreach", "sales-crm-email-outreach",
    "cold-call-outreach", "cold-instagram-outreach", "cold-linkedin-outreach", "cold-reddit-outreach",
    "cold-sms-outreach", "cold-whatsapp-outreach", "cold-x-outreach",
]
private let outboundLegRename = ["start_to_conversation": "lead_found_to_conversation", "start_to_website_visit": "lead_found_to_website_visit"]

/// The one spelling of a (feature, leg) the app compares on: the NEW key for an outbound feature.
func canonicalLegKey(_ featureSlug: String?, _ legKey: String) -> String {
    guard let f = featureSlug, outboundFeatureSlugs.contains(f) else { return legKey }
    return outboundLegRename[legKey] ?? legKey
}

/// The other spelling of a renamed outbound leg key (either direction).
private func legKeyTwin(_ legKey: String) -> String? {
    if let next = outboundLegRename[legKey] { return next }
    return outboundLegRename.first { $0.value == legKey }?.key
}

func campaignKey(_ featureSlug: String, _ legKey: String) -> String { "\(featureSlug):\(canonicalLegKey(featureSlug, legKey))" }

let leadFoundStep = "lead_found"

/// `lib/step-marks.ts`: the retired form steps read as the current one.
func canonicalStepKey(_ key: String) -> String {
    ["form_filled": "form_submitted", "lead_form_submitted": "form_submitted"][key] ?? key
}

// MARK: - The leg catalogue (`lib/legs.ts`)

struct LegDef { let fromKey: String?; let toKey: String; let toLabel: String }

struct LegCatalogue {
    var legs: [String: LegDef] = [:]
    var campaignNames: [String: String] = [:]
    var crewNames: [String: String] = [:]
    var channelNames: [String: String] = [:]

    init() {}
    init(_ body: PublicCatalogue) {
        var stepLabels: [String: String] = [:]
        for s in body.steps ?? [] { if let k = s.key, let l = s.label, stepLabels[k] == nil { stepLabels[k] = l } }
        func add(_ legKey: String?, _ from: PublicCatalogue.Step?, _ to: PublicCatalogue.Step?) {
            guard let legKey, let toKey = to?.key, legs[legKey] == nil else { return }
            legs[legKey] = LegDef(fromKey: from?.key, toKey: toKey, toLabel: to?.label ?? stepLabels[toKey] ?? toKey)
        }
        for l in body.legs ?? [] { add(l.legKey, l.fromStep, l.toStep) }
        for c in body.channels ?? [] {
            guard let slug = c.slug else { continue }
            if let n = c.name { channelNames[slug] = n }
            for t in c.stepTransitions ?? [] {
                guard let served = t.legKey else { continue }
                add(served, t.from, t.to)
                let id = campaignKey(slug, served)
                if let n = t.campaignName { campaignNames[id] = n }
                if let n = t.crewName { crewNames[id] = n }
            }
        }
    }

    func leg(_ legKey: String?) -> LegDef? {
        guard let legKey else { return nil }
        return legs[legKey] ?? legKeyTwin(legKey).flatMap { legs[$0] }
    }
}

// MARK: - Outcomes (`lib/v2/outcomes.ts`)

enum OutcomeItems: Equatable {
    /// The people in one of lead-service's engagement buckets.
    case people(bucket: String)
    /// The people a source found, per list.
    case leadsFound
    /// The brand's posts (a staff read on the web today).
    case posts
    /// No service serves this step's items yet: the panel says so, nothing is guessed.
    case unavailable
}

struct Outcome: Equatable {
    let key: String
    let label: String
    let items: OutcomeItems
}

private let bucketForStep: [String: String] = [
    "conversation": "positive_reply", "website_visit": "website_visit", "meeting_booked": "meeting_booked",
    "meeting_attended": "meeting_attended", "signup": "signup", "form_submitted": "form_submission", "paid_client": "sale",
]
private let postsStep = "posts"
private let plural: [String: String] = [
    leadFoundStep: "Leads found", "conversation": "Positive replies", "website_visit": "Website visits",
    "meeting_booked": "Meetings booked", "meeting_attended": "Meetings attended", "signup": "Signups",
    "form_submitted": "Form submissions", "paid_client": "Paid clients", postsStep: "Posts",
]

/// The outcome one campaign produces: the step its leg lands on.
func outcomeOf(featureSlug: String?, toKey: String?, toLabel: String? = nil) -> Outcome? {
    if let f = featureSlug, f.hasSuffix("-publishing") { return Outcome(key: postsStep, label: plural[postsStep]!, items: .posts) }
    guard let toKey else { return nil }
    let key = canonicalStepKey(toKey)
    let items: OutcomeItems = bucketForStep[key].map { .people(bucket: $0) } ?? (key == leadFoundStep ? .leadsFound : .unavailable)
    return Outcome(key: key, label: plural[key] ?? toLabel ?? key, items: items)
}

// MARK: - ON campaigns (`components/v2/ongoing-campaigns.ts`)

struct OnCampaign: Identifiable {
    let campaign: Campaign
    /// features-service's campaign name; nil when none is served (the crew/channel name shows).
    let name: String?
    let fallbackName: String
    let leg: LegDef?
    let outcome: Outcome?
    var id: String { campaign.id }
    var label: String { name ?? fallbackName }
}

struct OutcomeEntry: Identifiable {
    let outcome: Outcome
    var campaigns: [OnCampaign]
    var id: String { outcome.key }
}

/// One row of Campaigns > Overview: every campaign of the offer, the running ones first.
struct OfferCampaignRow: Identifiable {
    let key: String
    let name: String?
    let channelName: String?
    let reactive: Bool
    let roi: Double?
    var running: OnCampaign?
    var id: String { key }
}

private let activeStatuses: Set<String> = ["active", "running", "ongoing", "live"]
func isActiveStatus(_ s: String) -> Bool { activeStatuses.contains(s.lowercased()) }

/// The offer's campaigns, listed and ordered as the web's Sales path Campaigns section:
/// proactive before reactive, ROI high to low.
func offerCampaignRows(_ paths: OfferSalesPaths?) -> [OfferCampaignRow] {
    guard let paths else { return [] }
    var out: [OfferCampaignRow] = []
    for c in paths.campaigns ?? [] where c.operatedBy != "customer" && c.selectedPathCount > 0 {
        out.append(OfferCampaignRow(key: campaignKey(c.channelSlug, c.legKey), name: c.campaignName, channelName: c.channelName, reactive: c.reactive, roi: c.roi))
    }
    for c in paths.sourceCampaigns ?? [] where c.live {
        out.append(OfferCampaignRow(key: campaignKey(c.channelSlug, c.legKey), name: c.campaignName, channelName: c.channelName, reactive: true, roi: c.roi))
    }
    func roi(_ r: OfferCampaignRow) -> Double { r.roi.flatMap { $0.isFinite ? $0 : nil } ?? -.infinity }
    // A stable sort: equal rows keep the producer's order.
    return out.enumerated().sorted { a, b in
        if a.element.reactive != b.element.reactive { return !a.element.reactive }
        if roi(a.element) != roi(b.element) { return roi(a.element) > roi(b.element) }
        return a.offset < b.offset
    }.map(\.element)
}

/// The selected offer's ON campaigns, one per identity (offer x leg x channel), in the
/// Sales path order, each with the step it lands on; then one outcome per step.
func joinOnCampaigns(campaigns: [Campaign], offerId: String, catalogue: LegCatalogue, paths: OfferSalesPaths?) -> (campaigns: [OnCampaign], outcomes: [OutcomeEntry]) {
    let rows = offerCampaignRows(paths)
    var order: [String: Int] = [:]
    for (i, r) in rows.enumerated() where order[r.key] == nil { order[r.key] = i }
    var sourceByKey: [String: OfferSalesPaths.Source] = [:]
    for s in paths?.sourceCampaigns ?? [] { sourceByKey[campaignKey(s.channelSlug, s.legKey)] = s }

    var seen = Set<String>()
    var on: [(Int, OnCampaign)] = []
    for c in campaigns where c.offerId == offerId && isActiveStatus(c.status) {
        guard let slug = c.featureSlug else { continue }
        let key = campaignKey(slug, c.legKey ?? "")
        guard seen.insert(key).inserted else { continue }
        let source = sourceByKey[key]
        let leg = catalogue.leg(c.legKey)
        let name = catalogue.campaignNames[key] ?? source?.campaignName
        if name == nil { NSLog("[desktop] no campaignName served for a running campaign \(slug) \(c.legKey ?? "-")") }
        // A source campaign's leg is not in the leg catalogue: it lands on Lead found.
        let toKey = leg?.toKey ?? (source != nil ? leadFoundStep : nil)
        let outcome = outcomeOf(featureSlug: slug, toKey: toKey, toLabel: leg?.toLabel ?? source?.toStep.label)
        if outcome == nil { NSLog("[desktop] a running campaign produces no known step \(slug) \(c.legKey ?? "-")") }
        let fallback = catalogue.crewNames[key] ?? catalogue.channelNames[slug] ?? source?.channelName ?? slug
        on.append((order[key] ?? Int.max, OnCampaign(campaign: c, name: name, fallbackName: fallback, leg: leg, outcome: outcome)))
    }
    let sorted = on.enumerated().sorted { a, b in a.element.0 != b.element.0 ? a.element.0 < b.element.0 : a.offset < b.offset }.map(\.element.1)
    var outcomes: [OutcomeEntry] = []
    for c in sorted {
        guard let o = c.outcome else { continue }
        if let i = outcomes.firstIndex(where: { $0.outcome.key == o.key }) { outcomes[i].campaigns.append(c) }
        else { outcomes.append(OutcomeEntry(outcome: o, campaigns: [c])) }
    }
    return (sorted, outcomes)
}

// MARK: - Faces

/// `lib/sales-path-avatars.ts`: the names a face is drawn for, served by the dashboard.
private let salesPathAvatarNames: Set<String> = [
    "Victory", "Sol", "Herald", "Epiphany", "Triumph", "Zenith", "Summit", "Glory",
    "Aurora", "Bounty", "Jubilee", "Radiance", "Apex", "Laurel", "Harvest", "Eureka",
    "Halo", "Crown", "Pinnacle", "Ascent", "Bliss", "Splendor", "Fortune", "Valor",
    "Anthem", "Beacon", "Comet", "Dawn", "Elation", "Encore", "Euphoria", "Fanfare",
    "Flourish", "Gala", "Gleam", "Golden", "Grace", "Honor", "Horizon", "Jackpot",
    "Joy", "Jubilation", "Lumen", "Luster", "Majesty", "Marvel", "Meridian", "Miracle",
    "Nova", "Oasis", "Opulence", "Ovation", "Paragon", "Plenty", "Prism", "Prodigy",
    "Rapture", "Regal", "Rise", "Rhapsody", "Riches", "Soar",
    "Sterling", "Sunrise",
    "Solstice", "Sovereign", "Sparkle", "Spire",
]

/// `PathAvatar`: the campaign's face (a round image per name), else its initial on a soft disc.
struct CampaignFace: View {
    let name: String
    var size: CGFloat = 16
    @Environment(\.isSnapshot) private var snapshot
    var body: some View {
        Group {
            if !snapshot, salesPathAvatarNames.contains(name), let url = URL(string: "\(dashboardURL.absoluteString)/sales-path-avatars/\(name.lowercased()).jpg") {
                AsyncImage(url: url) { p in if let img = p.image { img.resizable().scaledToFill() } else { initial } }
            } else {
                initial
            }
        }
        .frame(width: size, height: size).clipShape(Circle())
    }
    private var initial: some View {
        Text(String(name.prefix(1))).font(.system(size: size * 0.6, weight: .semibold)).foregroundStyle(K.fg2)
            .frame(width: size, height: size).background(Circle().fill(K.inset))
            .overlay(Circle().strokeBorder(K.lineSubtle, lineWidth: 1))
    }
}

/// The live dot beside an ON campaign (`k-dot-pulse`): a TimelineView driving opacity only.
struct LiveDot: View {
    @Environment(\.isSnapshot) private var snapshot
    var body: some View {
        if snapshot {
            Circle().fill(K.run).frame(width: 6, height: 6)
        } else {
            TimelineView(.animation) { ctx in
                let t = ctx.date.timeIntervalSinceReferenceDate
                Circle().fill(K.run).frame(width: 6, height: 6)
                    .background(Circle().fill(K.run).opacity(0.35 * (1 - (t.truncatingRemainder(dividingBy: 1.6) / 1.6))).frame(width: 12, height: 12))
            }
            .frame(width: 12, height: 12)
        }
    }
}

// MARK: - Panels

/// Campaigns > Overview: every campaign of the offer, the running ones first.
struct CampaignsOverviewPanel: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        Text("Every campaign of this offer, the ones running first.").font(K.meta).foregroundStyle(K.fg3)
        LoadView(load: state.salesPaths) { paths in
            let rows = offerCampaignRows(paths).map { r -> OfferCampaignRow in
                var r = r; r.running = state.onCampaigns.first { campaignKey($0.campaign.featureSlug ?? "", $0.campaign.legKey ?? "") == r.key }; return r
            }
            let ordered = rows.filter { $0.running != nil } + rows.filter { $0.running == nil }
            if ordered.isEmpty { EmptyNote(text: "No campaign for this offer yet. Ask the chat to start one.") }
            VStack(spacing: 2) {
                ForEach(ordered) { r in
                    let label = r.name ?? r.channelName ?? r.key
                    AskRow(question: "About my campaign \"\(label)\": how is it doing, and what should I change? ", open: r.running.map { on in { state.open(.campaign(on.id)) } }) {
                        CampaignFace(name: label, size: 24)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(label).font(K.body).foregroundStyle(K.fg1).lineLimit(1)
                            if let ch = r.channelName { Text(ch).font(K.meta).foregroundStyle(K.fg3).lineLimit(1) }
                        }
                        Spacer(minLength: 6)
                        VStack(alignment: .trailing, spacing: 1) {
                            StateDot(word: r.running != nil ? "On" : "Off", color: r.running != nil ? K.run : K.fg4)
                            Text(r.roi.map { String(format: "%.1f× ROI", $0) } ?? "ROI —").font(K.meta).monospacedDigit().foregroundStyle(K.fg3)
                        }
                    }
                }
            }
        }
    }
}

/// One ON campaign: its face, the step it lands on, and its served figures.
struct CampaignPanel: View {
    @EnvironmentObject var state: AppState
    let id: String
    var body: some View {
        if let c = state.onCampaigns.first(where: { $0.id == id }) {
            HStack(spacing: 10) {
                CampaignFace(name: c.label, size: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(c.label).font(.system(size: 18, weight: .semibold)).foregroundStyle(K.fg1)
                    HStack(spacing: 8) {
                        StateDot(word: "On", color: K.run)
                        if let o = c.outcome { Text("Produces \(o.label.lowercased())").font(K.meta).foregroundStyle(K.fg3) }
                    }
                }
            }
            LoadView(load: state.campaignFigures) { figures in
                CampaignCard(row: CampaignRow(campaign: c.campaign, figures: figures))
            }
            if let o = c.outcome {
                Button("See \(o.label.lowercased())") { state.open(.outcome(o.key)) }
                    .buttonStyle(.plain).font(K.body).foregroundStyle(K.accent)
            }
        } else {
            EmptyNote(text: "This campaign is not running on this offer any more.")
        }
    }
}

/// Outcomes > Overview: one row per step the ON campaigns produce, who produces it, how many people reached it.
struct OutcomesOverviewPanel: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        Text("What your running campaigns bring in. Open one to see who reached it.").font(K.meta).foregroundStyle(K.fg3)
        if state.outcomes.isEmpty { EmptyNote(text: "Turn a campaign on and what it brings in shows here.") }
        VStack(spacing: 2) {
            ForEach(state.outcomes) { o in
                AskRow(question: "Who reached \(o.outcome.label.lowercased()), and what should I do with them? ", open: { state.open(.outcome(o.outcome.key)) }) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(o.outcome.label).font(.system(size: 13, weight: .medium)).foregroundStyle(K.fg1)
                        ProducedBy(campaigns: o.campaigns)
                    }
                    Spacer(minLength: 6)
                    Text(outcomeCount(o.outcome)).font(K.body).monospacedDigit().foregroundStyle(K.fg1)
                }
            }
        }
    }
    private func outcomeCount(_ o: Outcome) -> String {
        guard case .people(let bucket) = o.items, let n = state.bucketCounts?.count(bucket) else { return "—" }
        return n.formatted()
    }
}

/// "Soar, Nova": the campaigns behind an outcome, each with its face.
private struct ProducedBy: View {
    @EnvironmentObject var state: AppState
    let campaigns: [OnCampaign]
    var body: some View {
        HStack(spacing: 10) {
            ForEach(campaigns) { c in
                Button { state.open(.campaign(c.id)) } label: {
                    HStack(spacing: 5) {
                        CampaignFace(name: c.label, size: 14)
                        Text(c.label).font(K.meta).foregroundStyle(K.fg2).lineLimit(1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// One outcome: the people who reached it, read where the web reads them.
struct OutcomePanel: View {
    @EnvironmentObject var state: AppState
    let key: String
    var body: some View {
        let running = state.outcomes.first { $0.outcome.key == key }
        let outcome = running?.outcome ?? outcomeOf(featureSlug: nil, toKey: key)
        if let running {
            HStack(spacing: 6) {
                Text("Produced by").font(K.meta).foregroundStyle(K.fg3)
                ProducedBy(campaigns: running.campaigns)
            }
        } else {
            Text("No running campaign produces this today.").font(K.meta).foregroundStyle(K.fg3)
        }
        switch outcome?.items {
        case .people:
            LoadView(load: state.outcomePeople) { page in
                if page.leads.isEmpty { EmptyNote(text: "Nobody at this step yet.") }
                VStack(spacing: 2) {
                    ForEach(page.leads) { lead in
                        AskRow(question: "Tell me about \(personName(lead)) (\(lead.email)) and what to do next. ", open: { state.openPerson(lead) }) {
                            PersonLine(lead: lead)
                        }
                    }
                }
                if let total = page.total { Text("\(total.formatted()) people").font(K.meta).foregroundStyle(K.fg3).padding(.top, 4) }
            }
        case .leadsFound:
            AudienceRows()
        default:
            EmptyNote(text: "Not available yet. We cannot list each one here yet.")
        }
    }
}

// MARK: - Unibox

/// Everyone the brand is talking to, on every channel, one thread per person.
struct UniboxPanel: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        Text("Everyone you are talking to, on every channel, in one thread.").font(K.meta).foregroundStyle(K.fg3)
        LoadView(load: state.unibox) { list in
            if list.people.isEmpty { EmptyNote(text: "No conversation yet.") }
            VStack(spacing: 2) {
                ForEach(list.people) { p in
                    AskRow(question: "Catch me up on my conversation with \(p.name): what was said and what should I answer? ", open: { state.detail = .conversation(p) }) {
                        Avatar(url: nil, name: p.name, size: 28)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(p.name).font(K.body).foregroundStyle(K.fg1).lineLimit(1)
                            let sub = [p.company, p.sources.map(sourceWord).joined(separator: ", ")].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                            if !sub.isEmpty { Text(sub).font(K.meta).foregroundStyle(K.fg3).lineLimit(1) }
                        }
                        Spacer(minLength: 6)
                        if let d = p.lastActivityAt.flatMap(ago) { Text(d).font(K.meta).foregroundStyle(K.fg3) }
                    }
                }
            }
            Text("\(list.total.formatted()) people").font(K.meta).foregroundStyle(K.fg3).padding(.top, 4)
        }
    }
}

/// `people-conversations.ts` SOURCE_LABEL.
func sourceWord(_ s: String) -> String {
    ["gmail": "Gmail", "instantly": "Cold email", "matrix": "Messaging apps", "gohighlevel": "GoHighLevel"][s] ?? s.capitalized
}

/// One person's thread, every channel merged, newest last.
struct ConversationDetail: View {
    @EnvironmentObject var state: AppState
    let person: UniboxPerson
    @State private var timeline: Load<PersonTimeline> = .idle
    var body: some View {
        HStack(spacing: 12) {
            Avatar(url: nil, name: person.name, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(person.name).font(.system(size: 18, weight: .semibold)).foregroundStyle(K.fg1)
                if let c = person.company { Text(c).font(K.body).foregroundStyle(K.fg2) }
            }
        }
        Button("Draft my reply") { state.ask("Draft my reply to \(person.name)\(person.emails.first.map { " (\($0))" } ?? ""), from their last message. ") }
            .buttonStyle(KButtonStyle(strong: true))
        LoadView(load: timeline) { t in
            let failed = t.sources.filter { $0.error != nil }
            if !failed.isEmpty { EmptyNote(text: "Some messages could not be read right now: \(failed.map { sourceWord($0.source) }.joined(separator: ", ")).", isError: true) }
            if t.items.isEmpty { EmptyNote(text: "No message yet.") }
            ForEach(Array(t.items.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(item.direction == "outbound" ? "You" : (item.from ?? person.name)).font(.system(size: 12, weight: .medium)).foregroundStyle(K.fg1).lineLimit(1)
                        Text(sourceWord(item.source)).font(K.meta).foregroundStyle(K.fg3)
                        Spacer()
                        if let d = item.at.flatMap(ago) { Text(d).font(K.meta).foregroundStyle(K.fg3) }
                    }
                    if let s = item.subject { Text(s).font(.system(size: 12, weight: .semibold)).foregroundStyle(K.fg1) }
                    if let b = item.text { Text(b).font(K.meta).foregroundStyle(K.fg2).lineLimit(10).textSelection(.enabled) }
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 8).fill(item.direction == "outbound" ? K.accentSoft : K.inset))
            }
        }
        .task(id: person.id) { await load() }
    }
    private func load() async {
        guard let api = state.api, let brand = state.selectedBrand else { return }
        timeline = .loading
        do { timeline = .loaded(try await api.personTimeline(brandId: brand.id, ref: person.id)) } catch { timeline = .failed(error.localizedDescription) }
    }
}
