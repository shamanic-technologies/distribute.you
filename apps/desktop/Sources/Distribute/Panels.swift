import SwiftUI

/// Compact native reads of dashboard v2's pages, opened beside the chat. Every figure is
/// served (the app formats and labels, it computes no metric); every row can be handed to
/// the chat with Ask.
struct PanelView: View {
    @EnvironmentObject var state: AppState
    let pane: Pane

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: pane.symbol).font(.system(size: 12)).foregroundStyle(K.fg3)
                Text(pane.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(K.fg1)
                if let offer = state.selectedOffer, ![Pane.channels, .integrations, .settings, .billing].contains(pane) {
                    Text(offer.name).font(K.meta).foregroundStyle(K.fg3).lineLimit(1)
                }
                Spacer()
                Button { Task { await state.load(pane) } } label: { Image(systemName: "arrow.clockwise") }
                    .buttonStyle(KButtonStyle(ghost: true)).help("Refresh")
                Button { state.pane = nil } label: { Image(systemName: "xmark") }
                    .buttonStyle(KButtonStyle(ghost: true)).help("Close")
            }
            .padding(.horizontal, 12).frame(height: 48)
            Rectangle().fill(K.lineSubtle).frame(height: 1)
            KScroll {
                VStack(alignment: .leading, spacing: 12) {
                    if let detail = state.detail {
                        Button { state.detail = nil } label: {
                            HStack(spacing: 4) { Image(systemName: "chevron.left"); Text(pane.title) }.font(K.meta).foregroundStyle(K.fg3)
                        }
                        .buttonStyle(.plain)
                        switch detail {
                        case .person(let lead): PersonDetail(row: lead)
                        case .company(let org): CompanyDetail(org: org)
                        }
                    } else {
                        content
                    }
                }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .background(K.surface)
    }

    @ViewBuilder private var content: some View {
        switch pane {
        case .today: TodayPanel()
        case .companies: CompaniesPanel()
        case .people: PeoplePanel()
        case .deals: DealsPanel()
        case .offer: OfferPanel()
        case .targeting: TargetingPanel()
        case .channels: ChannelsPanel()
        case .integrations: IntegrationsPanel()
        case .settings: SettingsPanel()
        case .billing: BillingPanel()
        }
    }
}

/// Idle/loading = shimmer rows, failure = one plain sentence, else the content.
struct LoadView<T, Content: View>: View {
    let load: Load<T>
    var rows = 4
    @ViewBuilder let content: (T) -> Content
    var body: some View {
        switch load {
        case .idle, .loading: ShimmerRows(count: rows)
        case .failed(let why): EmptyNote(text: why, isError: !why.hasPrefix("No ") && !why.hasPrefix("This brand"))
        case .loaded(let v): content(v)
        }
    }
}

/// A row that offers itself to the chat on hover.
struct AskRow<Content: View>: View {
    @EnvironmentObject var state: AppState
    let question: String
    var open: (() -> Void)? = nil
    @ViewBuilder let content: Content
    @State private var hovering = false
    var body: some View {
        HStack(spacing: 8) {
            content
            if hovering {
                Button("Ask") { state.ask(question) }.buttonStyle(KButtonStyle()).font(K.meta)
                if open != nil {
                    Image(systemName: "chevron.right").font(.system(size: 10, weight: .semibold)).foregroundStyle(K.fg3)
                }
            }
        }
        .padding(.horizontal, 10).frame(minHeight: 44)
        .background(RoundedRectangle(cornerRadius: 8).fill(hovering ? K.hover : Color.clear))
        .contentShape(Rectangle())
        .onTapGesture { open?() }
        .onHover { hovering = $0 }
    }
}

private struct SectionTitle: View {
    let title: String
    var count: Int?
    var body: some View {
        HStack(spacing: 6) {
            Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(K.fg1)
            if let count { Text(count.formatted()).font(K.meta).monospacedDigit().foregroundStyle(K.fg3) }
        }
        .padding(.top, 6)
    }
}

// MARK: - Today

private struct TodayPanel: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        KTabs(options: [(7, "7 days"), (30, "30 days")], selection: state.windowDays) { state.setWindow($0) }
        LoadView(load: state.today) { d in
            if let win = d.window?.window {
                KCard {
                    Grid(alignment: .topLeading, horizontalSpacing: 0, verticalSpacing: 0) {
                        GridRow {
                            Tile(label: "Return", value: shownReturn(d.revenue?.costEconomics?.maturity),
                                 note: "on what you spent", color: K.teal)
                            Tile(label: "Pipeline", value: usd(d.revenue?.headline?.totalPipelineUsd), note: "expected",
                                 spark: win.expectedPipeline?.daily?.compactMap(\.cumulativePipelineUsd), color: K.teal)
                        }
                        Divider().overlay(K.lineSubtle).gridCellUnsizedAxes(.horizontal)
                        GridRow {
                            Tile(label: "Positive replies", value: count(win.recipientsRepliesPositive.map { Double($0.total) }),
                                 spark: win.recipientsRepliesPositive?.daily?.compactMap(\.count), color: K.run)
                            Tile(label: "Website visits", value: count(win.recipientsClicked.map { Double($0.total) }),
                                 spark: win.recipientsClicked?.daily?.compactMap(\.count), color: K.sky)
                        }
                        Divider().overlay(K.lineSubtle).gridCellUnsizedAxes(.horizontal)
                        GridRow {
                            Tile(label: "Delivered", value: win.emails?.deliveryRatePct.map { String(format: "%.0f%%", $0) } ?? "—",
                                 note: win.emails.map { "\($0.delivered.formatted()) of \($0.sent.formatted()) emails" }, color: K.accent)
                            Tile(label: "Spent", value: dollars(cents: win.spend?.totalSpentCents),
                                 spark: win.spend?.daily?.compactMap(\.totalSpentCents), color: K.amber)
                        }
                    }
                }
            } else {
                EmptyNote(text: "No campaign runs this offer yet. Ask the chat to start one.")
            }
            SectionTitle(title: "Needs your call", count: d.needsCall.total)
            if d.needsCall.leads.isEmpty {
                EmptyNote(text: "Nobody is waiting on you.")
            }
            ForEach(d.needsCall.leads) { lead in
                AskRow(question: "\(personName(lead)) replied with interest. What should I answer, and what happens next? ", open: { state.openPerson(lead) }) {
                    PersonLine(lead: lead)
                }
            }
        }
    }
}

/// Keel's stat tile: label, figure, then a small viz (or a note) in the tile's colour.
private struct Tile: View {
    let label: String
    let value: String
    var note: String?
    var spark: [Double]?
    var color: Color = K.accent
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Figure(label: label, value: value)
            if let spark, spark.count > 1 {
                SparkLine(values: spark, color: color)
            } else if let note {
                Text(note).font(K.meta).foregroundStyle(K.fg3).frame(height: 28, alignment: .topLeading)
            } else {
                Color.clear.frame(height: 28)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

/// Dashboard v2's return rule (`lib/maturity.ts`): before maturity, a flash return above
/// 1x is shown, else "Learning"; after it, the mature return.
func shownReturn(_ m: Maturity?) -> String {
    guard let m else { return "—" }
    if m.isMature == false {
        if let r = m.flash?.roiMultiple, r > 1 { return String(format: "%.1f×", r) }
        return "Learning"
    }
    return m.mature?.roiMultiple.map { String(format: "%.1f×", $0) } ?? "—"
}

// MARK: - Companies

private let stageOrder: [(tag: String, label: String)] = [
    ("closeWin", "Close won"), ("meetingAttended", "Meeting attended"), ("meeting", "Meeting booked"),
    ("formSubmitted", "Form submitted"), ("reply", "Positive reply"), ("visit", "Website visit"),
    ("delivered", "Delivered"), ("sent", "Sent"), ("contacted", "Contacted"),
]

private struct CompaniesPanel: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        LoadView(load: state.companies) { rev in
            let orgs = rev.organizations.sorted { $0.expectedRevenueUsd > $1.expectedRevenueUsd }
            if orgs.isEmpty { EmptyNote(text: "No company reached yet.") }
            VStack(spacing: 2) {
                ForEach(orgs) { o in
                    let name = o.orgName ?? o.orgDomain ?? "Unknown company"
                    let stage = stageOrder.first { o.tags.contains($0.tag) }?.label ?? "Contacted"
                    AskRow(question: "Tell me about \(name)\(o.orgDomain.map { " (\($0))" } ?? ""): where it stands and what to do next. ", open: { state.openCompany(o) }) {
                        Logo(domain: o.orgDomain, name: name, size: 28)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(name).font(K.body).foregroundStyle(K.fg1).lineLimit(1)
                            StateDot(word: stage, color: stage == "Close won" ? K.teal : stage == "Positive reply" || stage.hasPrefix("Meeting") ? K.run : K.fg4)
                        }
                        Spacer()
                        Text(usd(o.expectedRevenueUsd)).font(K.body).monospacedDigit().foregroundStyle(K.fg1)
                    }
                }
            }
            Text("\(orgs.count.formatted()) companies · \(usd(rev.headline?.totalPipelineUsd)) expected pipeline")
                .font(K.meta).foregroundStyle(K.fg3).padding(.top, 4)
        }
    }
}

// MARK: - People

private let peopleBuckets: [(key: String, label: String)] = [
    ("contacted", "Contacted"), ("website_visit", "Visits"), ("positive_reply", "Replies"),
    ("meeting_booked", "Meetings"), ("signup", "Signups"), ("sale", "Sales"),
]

private struct PeoplePanel: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        KTabs(options: peopleBuckets.map { ($0.key, $0.label) }, selection: state.peopleBucket) { state.setPeopleBucket($0) }
        LoadView(load: state.people) { page in
            if page.leads.isEmpty { EmptyNote(text: "Nobody at this step yet.") }
            VStack(spacing: 2) {
                ForEach(page.leads) { lead in
                    AskRow(question: "Tell me about \(personName(lead)) (\(lead.email)) and what to do next. ", open: { state.openPerson(lead) }) {
                        PersonLine(lead: lead)
                    }
                }
            }
            if let total = page.total {
                Text("\(total.formatted()) people").font(K.meta).foregroundStyle(K.fg3).padding(.top, 4)
            }
        }
    }
}

func personName(_ l: LeadRow) -> String {
    let n = [l.lead?.firstName, l.lead?.lastName].compactMap { $0 }.joined(separator: " ")
    return n.isEmpty ? l.email : n
}

/// v2's status chip (`lib/api.ts` deliveryStatus + `lib/lead-status.ts` labels): the first
/// true served flag in the dashboard's order, and the date that goes with it.
func leadStatus(_ l: LeadRow) -> (word: String, date: String?) {
    if l.replied { return ("Replied", l.firstRepliedAt) }
    if l.clicked { return ("Website visit", l.firstClickedAt) }
    if l.bounced { return ("Bounced", l.firstBouncedAt) }
    if l.unsubscribed { return ("Unsubscribed", l.firstUnsubscribedAt) }
    if l.delivered { return ("Delivered", l.firstDeliveredAt) }
    if l.sent { return ("Sent", l.firstSentAt) }
    if l.contacted { return ("Queued", l.firstContactedAt) }
    if l.status == "served" { return ("Processing", l.servedAt) }
    return (l.status.capitalized, nil)
}

private struct PersonLine: View {
    let lead: LeadRow
    var body: some View {
        let st = leadStatus(lead)
        let sub = [lead.lead?.organization?.name, lead.lead?.currentTitle ?? lead.lead?.headline].compactMap { $0 }.joined(separator: " · ")
        Avatar(url: lead.lead?.photoUrl, name: personName(lead), size: 28)
        VStack(alignment: .leading, spacing: 1) {
            Text(personName(lead)).font(K.body).foregroundStyle(K.fg1).lineLimit(1)
            if !sub.isEmpty { Text(sub).font(K.meta).foregroundStyle(K.fg3).lineLimit(1) }
        }
        Spacer(minLength: 6)
        VStack(alignment: .trailing, spacing: 1) {
            StateDot(word: st.word, color: st.word == "Replied" || st.word == "Website visit" ? K.run : st.word == "Bounced" ? K.rose : K.fg4)
            if let d = st.date.flatMap(ago) { Text(d).font(K.meta).foregroundStyle(K.fg3) }
        }
    }
}

// MARK: - Deals

private struct DealsPanel: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        LoadView(load: state.deals) { d in
            let c = d.standing.counts
            // v2's board columns (`lib/lead-board.ts`): Contacted = contacted + engaged.
            let cols: [(String, Int)] = [
                ("Contacted", c.contacted + c.engaged), ("Interested", c.sales_interest), ("Close won", c.customer),
                ("Disqualified", c.disqualified), ("Opt-out", c.opted_out),
            ] + (c.unresolved > 0 ? [("Not placed", c.unresolved)] : [])
            if let pipe = d.pipelineUsd {
                Text("\(usd(pipe)) in expected pipeline").font(.system(size: 18, weight: .semibold)).foregroundStyle(K.fg1)
            }
            KCard {
                StepBars(columns: cols).padding(14)
            }
            AskRow(question: "Walk me through my deals board: who is interested, who is close, and what should I do first? ") {
                Text("Ask what to do first").font(K.body).foregroundStyle(K.accent)
                Spacer()
            }
        }
    }
}

/// Counts per step: one card, one vertical bar per step, count above, label below.
private struct StepBars: View {
    let columns: [(String, Int)]
    var body: some View {
        let top = max(columns.map(\.1).max() ?? 1, 1)
        HStack(alignment: .bottom, spacing: 10) {
            ForEach(columns, id: \.0) { col in
                VStack(spacing: 6) {
                    Text(col.1.formatted()).font(.system(size: 12, weight: .semibold)).monospacedDigit().foregroundStyle(K.fg1)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(col.0 == "Close won" ? K.teal : col.0 == "Interested" ? K.run : col.0 == "Contacted" ? K.accent.opacity(0.75) : K.fg4.opacity(0.6))
                        .frame(height: max(4, 120 * CGFloat(col.1) / CGFloat(top)))
                    Text(col.0).font(.system(size: 11)).foregroundStyle(K.fg3).lineLimit(1).minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

// MARK: - Offer

private let leverLabels: [(String, String)] = [
    ("services", "Services"), ("dreamOutcome", "Dream outcome"), ("perceivedLikelihood", "Why it works"),
    ("socialProof", "Social proof"), ("riskReversal", "Risk reversal"), ("urgency", "Urgency"), ("scarcity", "Scarcity"),
]

private struct OfferPanel: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        if state.selectedOffer == nil { CreateOfferView() }
        else { LoadView(load: state.offerData) { d in
            Text(state.selectedOffer?.name ?? "").font(.system(size: 18, weight: .semibold)).foregroundStyle(K.fg1)
            KCard { Figure(label: "Lifetime revenue per client", value: usd(d.lifetimeRevenueUsd)).padding(12) }
            ForEach(leverLabels, id: \.0) { key, label in
                let values = d.fields[key] ?? []
                AskRow(question: "Improve the \(label.lowercased()) of my offer \"\(state.selectedOffer?.name ?? "")\". ") {
                    VStack(alignment: .leading, spacing: 3) {
                        KLabel(label)
                        Text(values.isEmpty ? "—" : values.joined(separator: ", "))
                            .font(K.body).foregroundStyle(values.isEmpty ? K.fg4 : K.fg1).fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.vertical, 6)
                    Spacer(minLength: 0)
                }
            }
        } }
    }
}

// MARK: - Targeting

private struct TargetingPanel: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        LoadView(load: state.audiences) { list in
            if list.isEmpty { EmptyNote(text: "No audience for this offer yet. Ask the chat to suggest some.") }
            VStack(spacing: 2) {
                ForEach(list) { a in
                    AskRow(question: "How is the audience \"\(a.name)\" doing, and should I change it? ") {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 8) {
                                Text(a.name).font(K.body).foregroundStyle(K.fg1).lineLimit(1)
                                StateDot(word: a.status.capitalized, color: a.status == "active" ? K.run : K.amber)
                            }
                            if let p = a.nlPrompt { Text(p).font(K.meta).foregroundStyle(K.fg3).lineLimit(2) }
                        }
                        Spacer(minLength: 6)
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(count(a.sizeCount)).font(K.body).monospacedDigit().foregroundStyle(K.fg1)
                            Text(a.availableToContactPct.map { String(format: "%.0f%% left", $0) } ?? "—").font(K.meta).foregroundStyle(K.fg3)
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Channels

private struct ChannelsPanel: View {
    @EnvironmentObject var state: AppState
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "envelope").foregroundStyle(K.fg3)
            Text("Cold email").font(.system(size: 13, weight: .semibold))
        }
        LoadView(load: state.rows) { rows in
            if rows.isEmpty { EmptyNote(text: "No cold email campaign on this brand yet. Ask the chat to start one.") }
            ForEach(rows) { CampaignCard(row: $0) }
        }
    }
}

struct CampaignCard: View {
    @EnvironmentObject var state: AppState
    let row: CampaignRow

    var body: some View {
        let o = row.figures?.outcomes
        KCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(row.campaign.name).font(.system(size: 13, weight: .semibold)).foregroundStyle(K.fg1).lineLimit(2)
                    Spacer()
                    StateDot(word: row.campaign.status == "ongoing" ? "Running" : row.campaign.status.capitalized,
                             color: row.campaign.status == "ongoing" ? K.run : K.fg4)
                }
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 10) {
                    GridRow {
                        Figure(label: "Sent", value: count(o?.sending?.recipientsSent))
                        Figure(label: "Clicks", value: count(o?.recipientsClicked))
                        Figure(label: "Positive replies", value: count(o?.recipientsRepliesPositive))
                    }
                    GridRow {
                        Figure(label: "Spent", value: row.figures?.costEconomics.committedCostUsd.map { dollars(cents: $0 * 100) } ?? "—")
                        Figure(label: "Per reply", value: costPerPositiveReply(o))
                        Figure(label: "Reply rate", value: o?.sending?.replyRatePct.map { String(format: "%.1f%%", $0) } ?? "—")
                    }
                }
                Button("Ask about this campaign") {
                    state.ask("About my campaign \"\(row.campaign.name)\" (id \(row.campaign.id)): ")
                }
                .buttonStyle(.plain).font(K.meta).foregroundStyle(K.accent)
            }
            .padding(12)
        }
    }

    /// At zero positive replies the served cost is not a price yet: "Learning".
    private func costPerPositiveReply(_ o: RevenueGroup.Outcomes?) -> String {
        guard let o else { return "—" }
        guard let replies = o.recipientsRepliesPositive, replies > 0, let cents = o.cpprCents else { return "Learning" }
        return dollars(cents: cents)
    }
}

// MARK: - Formatting (display only)

func count(_ v: Double?) -> String {
    guard let v else { return "—" }
    return Int(v).formatted()
}

func dollars(cents: Double?) -> String {
    guard let cents else { return "—" }
    return (cents / 100).formatted(.currency(code: "USD"))
}

/// Whole dollars, for pipeline and value figures.
func usd(_ v: Double?) -> String {
    guard let v else { return "—" }
    return v.formatted(.currency(code: "USD").precision(.fractionLength(0)))
}

private let isoFull: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
}()
private let isoPlain = ISO8601DateFormatter()

func ago(_ iso: String) -> String? {
    guard let d = isoFull.date(from: iso) ?? isoPlain.date(from: iso) else { return nil }
    return RelativeDateTimeFormatter().localizedString(for: d, relativeTo: Date())
}
