import SwiftUI

// MARK: - Person (dashboard v2 `person-page.tsx`)

struct PersonDetail: View {
    @EnvironmentObject var state: AppState
    let row: LeadRow
    @State private var lead: Load<LeadRow> = .idle
    @State private var history: Load<LeadHistory> = .idle

    var body: some View {
        let l = lead.value ?? row
        let name = personName(l)
        HStack(spacing: 12) {
            Avatar(url: l.lead?.photoUrl, name: name, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 18, weight: .semibold)).foregroundStyle(K.fg1)
                let sub = [l.lead?.currentTitle ?? l.lead?.headline, l.lead?.organization?.name].compactMap { $0 }.joined(separator: " at ")
                if !sub.isEmpty { Text(sub).font(K.body).foregroundStyle(K.fg2) }
            }
        }
        HStack(spacing: 8) {
            let st = leadStatus(l)
            StateDot(word: st.word, color: st.word == "Replied" || st.word == "Website visit" ? K.run : K.fg4)
            if let s = l.standing?.state { Text(standingLabel(s)).font(K.meta).foregroundStyle(K.fg2).padding(.horizontal, 6).padding(.vertical, 2).background(RoundedRectangle(cornerRadius: 5).fill(K.selected)) }
        }
        HStack(spacing: 6) {
            Button("Draft my reply") { state.ask("Draft my reply to \(name) (\(l.email)), from their last message. ") }.buttonStyle(KButtonStyle(strong: true))
            Button("What next?") { state.ask("What should happen next with \(name) (\(l.email))? ") }.buttonStyle(KButtonStyle())
        }
        KCard {
            VStack(alignment: .leading, spacing: 10) {
                Field(label: "Email", value: l.email)
                Field(label: "Company", value: l.lead?.organization?.name)
                Field(label: "First queued", value: l.firstContactedAt.flatMap(ago))
                Field(label: "Last activity", value: leadStatus(l).date.flatMap(ago))
                if let li = l.lead?.linkedinUrl, let u = URL(string: li) {
                    VStack(alignment: .leading, spacing: 2) {
                        KLabel("LinkedIn")
                        Link("Profile", destination: u).font(K.body)
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        Text("Activity").font(.system(size: 13, weight: .semibold)).padding(.top, 6)
        LoadView(load: history) { h in
            if let missing = h.sources?.filter({ $0.status == "unavailable" }), !missing.isEmpty {
                EmptyNote(text: "Some history is unavailable right now: \(missing.map(\.source).joined(separator: ", ")).", isError: true)
            }
            let events = h.events.filter { $0.type != "followup" }.reversed()
            if events.isEmpty { EmptyNote(text: "Nothing has happened yet.") }
            ForEach(Array(events)) { e in TimelineRow(event: e) }
            if let f = h.events.last(where: { $0.type == "followup" }) {
                Text(f.state == "stopped" ? "No further follow-ups" : f.dueAt.flatMap(ago).map { "Next follow-up \($0)" } ?? "")
                    .font(K.meta).foregroundStyle(K.fg3)
            }
        }
        .task(id: row.id) { await load() }
    }

    private func load() async {
        guard let api = state.api, let brand = state.selectedBrand else { return }
        lead = .loading; history = .loading
        do { lead = .loaded(try await api.leadDetail(id: row.id, brandId: brand.id)) } catch { lead = .failed(error.localizedDescription) }
        do { history = .loaded(try await api.leadHistory(id: row.id, brandId: brand.id)) } catch { history = .failed(error.localizedDescription) }
    }
}

/// v2's labels for a standing (`lib/lead-board.ts`).
func standingLabel(_ s: String) -> String {
    switch s {
    case "sales_interest": return "Interested"
    case "customer": return "Close won"
    case "opted_out": return "Opt-out"
    case "disqualified": return "Disqualified"
    case "engaged", "contacted": return "Contacted"
    case "not_contacted": return "Not contacted"
    default: return "Not placed"
    }
}

private struct Field: View {
    let label: String
    let value: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            KLabel(label)
            Text(value ?? "—").font(K.body).foregroundStyle(value == nil ? K.fg4 : K.fg1).textSelection(.enabled)
        }
    }
}

/// One event of `lead-history-timeline.tsx`, with v2's wording.
private struct TimelineRow: View {
    let event: LeadHistory.Event
    var body: some View {
        if let label {
            HStack(alignment: .top, spacing: 10) {
                Circle().fill(dot).frame(width: 7, height: 7).padding(.top, 6)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(label).font(.system(size: 13, weight: .medium)).foregroundStyle(K.fg1)
                        if event.evidence == "asserted" { Text("recorded by hand").font(K.meta).foregroundStyle(K.fg3) }
                        Spacer()
                        if let at = event.at.flatMap(ago) { Text(at).font(K.meta).foregroundStyle(K.fg3) }
                    }
                    if let who { Text(who).font(K.meta).foregroundStyle(K.fg3) }
                    if event.bodyStatus != "unavailable", event.bodyStatus != "empty", event.subject != nil || event.bodyText != nil {
                        VStack(alignment: .leading, spacing: 4) {
                            if let s = event.subject { Text(s).font(.system(size: 12, weight: .semibold)).foregroundStyle(K.fg1) }
                            if let b = event.bodyText { Text(b).font(K.meta).foregroundStyle(K.fg2).lineLimit(8).textSelection(.enabled) }
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 8).fill(K.inset))
                    }
                    if let note = event.note { Text(note).font(K.meta).foregroundStyle(K.fg2) }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var inbound: Bool { event.direction == "inbound" }
    private var who: String? {
        guard event.type == "message" else { return nil }
        return inbound ? event.from : event.to?.first.map { "To \($0)" }
    }
    private var dot: Color {
        if inbound || event.milestone == "replied" { return K.run }
        if event.milestone == "bounced" { return K.rose }
        if event.milestone == "clicked" { return K.sky }
        return K.fg4
    }
    private var label: String? {
        switch event.type {
        case "message": return inbound ? "Their reply" : "Email sent"
        case "generated_email": return "Email we wrote"
        case "delivery":
            switch event.milestone {
            case "sent": return "Sent"
            case "delivered": return "Delivered"
            case "clicked": return "Website visit"
            case "replied": return "Replied"
            case "bounced": return "Bounced"
            case "unsubscribed": return "Unsubscribed"
            default: return nil
            }
        case "lifecycle": return event.kind == "served" || event.event == "served" ? "Added to the campaign" : "Queued for sending"
        case "reply_statement": return "Reply recorded"
        case "opt_out_statement": return "Asked us to stop"
        case "step_statement": return event.kind == "never" ? "Will never reach \(event.step ?? "")" : "Reached \(event.step ?? "")"
        case "conversion": return "Converted: \(event.event ?? "")"
        default: return nil
        }
    }
}

// MARK: - Company (dashboard v2 `company-page.tsx`)

struct CompanyDetail: View {
    @EnvironmentObject var state: AppState
    let org: RevenueOrg
    @State private var people: Load<[LeadRow]> = .idle

    var body: some View {
        let name = org.orgName ?? org.orgDomain ?? "Unknown company"
        HStack(spacing: 12) {
            Logo(domain: org.orgDomain, name: name, size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.system(size: 18, weight: .semibold)).foregroundStyle(K.fg1)
                if let d = org.orgDomain { Text(d).font(K.body).foregroundStyle(K.fg3) }
            }
        }
        KCard {
            HStack(spacing: 0) {
                Figure(label: "Expected value", value: usd(org.expectedRevenueUsd)).padding(12)
                Figure(label: "Stage", value: companyStage(org)).padding(12)
            }
        }
        Button("What should we do with \(name)?") { state.ask("What should we do next with \(name)\(org.orgDomain.map { " (\($0))" } ?? "")? ") }
            .buttonStyle(KButtonStyle(strong: true))
        if let brief = people.value?.first?.lead?.organization {
            KCard {
                VStack(alignment: .leading, spacing: 6) {
                    KLabel("Brief")
                    if let d = brief.shortDescription { Text(d).font(K.body).foregroundStyle(K.fg1).fixedSize(horizontal: false, vertical: true) }
                    let facts = [brief.industry, brief.estimatedNumEmployees.map { "\($0.formatted()) people" }, [brief.city, brief.country].compactMap { $0 }.joined(separator: ", ")]
                        .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                    if !facts.isEmpty { Text(facts).font(K.meta).foregroundStyle(K.fg3) }
                }
                .padding(12).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        Text("People").font(.system(size: 13, weight: .semibold)).padding(.top, 6)
        LoadView(load: people) { list in
            if list.isEmpty { EmptyNote(text: "Nobody from this company yet.") }
            ForEach(list) { lead in
                AskRow(question: "Tell me about \(personName(lead)) at \(name). ", open: { state.openPerson(lead) }) { PersonLineCompact(lead: lead) }
            }
        }
        .task(id: org.id) { await load(name: name) }
    }

    private func load(name: String) async {
        guard let api = state.api, let brand = state.selectedBrand, let offer = state.selectedOffer else { return }
        people = .loading
        do {
            let page = try await api.companyPeople(brandId: brand.id, offerId: offer.offerId, orgName: name)
            // v2 keeps the people whose company matches by domain, else by name.
            let mine = page.leads.filter {
                let o = $0.lead?.organization
                if let d = org.orgDomain, let pd = o?.primaryDomain { return d.lowercased() == pd.lowercased() }
                return (o?.name ?? "").lowercased() == name.lowercased()
            }
            people = .loaded(mine)
        } catch {
            people = .failed(error.localizedDescription)
        }
    }
}

func companyStage(_ o: RevenueOrg) -> String {
    let order: [(String, String)] = [
        ("closeWin", "Close won"), ("meetingAttended", "Meeting attended"), ("meeting", "Meeting booked"),
        ("formSubmitted", "Form submitted"), ("reply", "Positive reply"), ("visit", "Website visit"),
        ("delivered", "Delivered"), ("sent", "Sent"), ("contacted", "Contacted"),
    ]
    return order.first { o.tags.contains($0.0) }?.1 ?? "Contacted"
}

private struct PersonLineCompact: View {
    let lead: LeadRow
    var body: some View {
        let st = leadStatus(lead)
        Avatar(url: lead.lead?.photoUrl, name: personName(lead), size: 28)
        VStack(alignment: .leading, spacing: 1) {
            Text(personName(lead)).font(K.body).foregroundStyle(K.fg1).lineLimit(1)
            if let t = lead.lead?.currentTitle ?? lead.lead?.headline { Text(t).font(K.meta).foregroundStyle(K.fg3).lineLimit(1) }
        }
        Spacer(minLength: 6)
        StateDot(word: st.word, color: st.word == "Replied" || st.word == "Website visit" ? K.run : K.fg4)
    }
}
