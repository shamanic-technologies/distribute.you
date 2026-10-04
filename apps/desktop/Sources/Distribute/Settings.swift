import SwiftUI

/// The setup pages dashboard v2 keeps behind Integrations, Brand settings and Billing,
/// native in the app (owner 2026-10-04: « va jusqu'au bout sans rediriger vers la web app »).
/// Reads and writes are the dashboard's own gateway calls (mapped in `API.swift`).

// MARK: - Integrations (v2 `integrations-ai.tsx`: the tab every user has)

struct IntegrationsPanel: View {
    @EnvironmentObject var state: AppState
    @State private var keys: Load<[ApiKeyInfo]> = .idle
    @State private var fresh: String?
    @State private var error: String?

    var body: some View {
        KCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles").foregroundStyle(K.violet)
                    Text("Claude Code").font(.system(size: 13, weight: .semibold))
                    Spacer()
                    StateDot(word: state.cli == nil ? "Not found" : "Connected", color: state.cli == nil ? K.rose : K.run)
                }
                Text("The chat runs on your own Claude subscription, through Claude Code on this Mac.").font(K.meta).foregroundStyle(K.fg3)
            }
            .padding(12)
        }
        KCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "point.3.connected.trianglepath.dotted").foregroundStyle(K.sky)
                    Text("MCP server").font(.system(size: 13, weight: .semibold))
                }
                Text("Use distribute from any AI tool with your key.").font(K.meta).foregroundStyle(K.fg3)
                CopyLine(text: "https://mcp.distribute.you/mcp")
            }
            .padding(12)
        }
        HStack {
            Text("API keys").font(.system(size: 13, weight: .semibold))
            Spacer()
            Button("New key") { Task { await create() } }.buttonStyle(KButtonStyle())
        }
        .padding(.top, 6)
        if let fresh {
            VStack(alignment: .leading, spacing: 4) {
                Text("Copy it now. It is shown only once.").font(K.meta).foregroundStyle(K.amber)
                CopyLine(text: fresh)
            }
        }
        if let error { EmptyNote(text: error, isError: true) }
        LoadView(load: keys) { list in
            ForEach(list) { k in
                HStack(spacing: 8) {
                    Image(systemName: "key").font(.system(size: 11)).foregroundStyle(K.fg3)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(k.name ?? "Key").font(K.body).foregroundStyle(K.fg1)
                        Text("\(k.keyPrefix)… · \(k.lastUsedAt.flatMap(ago).map { "used \($0)" } ?? "never used")").font(K.meta).foregroundStyle(K.fg3)
                    }
                    Spacer()
                    Button("Revoke") { Task { await revoke(k) } }.buttonStyle(KButtonStyle(ghost: true)).font(K.meta)
                }
                .padding(.horizontal, 10).frame(minHeight: 40)
            }
        }
        .task { await load() }
    }

    private func load() async {
        guard let api = state.api else { return }
        keys = .loading
        do { keys = .loaded(try await api.apiKeys()) } catch { keys = .failed(error.localizedDescription) }
    }
    private func create() async {
        guard let api = state.api else { return }
        do { fresh = try await api.createApiKey(name: "Key from distribute for Mac"); await load() } catch { self.error = error.localizedDescription }
    }
    private func revoke(_ k: ApiKeyInfo) async {
        guard let api = state.api else { return }
        do { try await api.deleteApiKey(id: k.id); await load() } catch { self.error = error.localizedDescription }
    }
}

struct CopyLine: View {
    let text: String
    @State private var copied = false
    var body: some View {
        HStack(spacing: 6) {
            Text(text).font(.system(size: 12, design: .monospaced)).foregroundStyle(K.fg1).lineLimit(1).truncationMode(.middle).textSelection(.enabled)
            Spacer(minLength: 4)
            Button(copied ? "Copied" : "Copy") {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(text, forType: .string)
                copied = true
            }
            .buttonStyle(KButtonStyle(ghost: true)).font(K.meta)
        }
        .padding(.leading, 10).padding(.trailing, 2).frame(height: 32)
        .background(RoundedRectangle(cornerRadius: 8).fill(K.inset))
    }
}

// MARK: - Brand settings (v2 `brand-settings-page.tsx`)

struct SettingsPanel: View {
    @EnvironmentObject var state: AppState
    @State private var brand: Load<BrandInfo> = .idle
    @State private var rep: Load<SalesRep> = .idle
    @State private var econ: Load<OfferEconomics> = .idle
    @State private var budget: Load<SalesBudget> = .idle
    @State private var token: Load<ConversionToken> = .idle

    @State private var name = ""
    @State private var repEmail = ""
    @State private var repPhone = ""
    @State private var repName = ""
    @State private var booking = ""
    @State private var daily = ""
    @State private var saving: String?
    @State private var error: String?

    var body: some View {
        if let error { EmptyNote(text: error, isError: true) }
        SettingsSection(title: "Brand", purpose: "The name we sign with.") {
            LoadView(load: brand, rows: 1) { b in
                EditLine(label: "Name", text: $name, saving: saving == "name") { await save("name") { try await $0.renameBrand(id: b.id, name: name) } }
                InfoLine(label: "Website", value: b.url ?? b.domain)
                InfoLine(label: "Clicks land on", value: b.clickDestinationUrl ?? b.url)
            }
        }
        SettingsSection(title: "Sales rep", purpose: "Who takes the call when someone is interested.") {
            LoadView(load: rep, rows: 1) { _ in
                EditLine(label: "First name", text: $repName, saving: false) { await saveRep() }
                EditLine(label: "Email", text: $repEmail, saving: saving == "rep") { await saveRep() }
                EditLine(label: "Phone", text: $repPhone, saving: false) { await saveRep() }
            }
        }
        if let offer = state.selectedOffer {
            SettingsSection(title: "Booking link", purpose: "Where an interested person books a call for \(offer.name).") {
                LoadView(load: econ, rows: 1) { _ in
                    EditLine(label: "Booking URL", text: $booking, saving: saving == "booking") {
                        await save("booking") { try await $0.setBookingUrl(brandId: state.selectedBrand!.id, offerId: offer.offerId, url: booking.isEmpty ? nil : booking) }
                    }
                }
            }
        }
        SettingsSection(title: "Daily budget", purpose: "The most we spend per day, in whole dollars, from your prepaid credit.") {
            LoadView(load: budget, rows: 1) { _ in
                EditLine(label: "Dollars per day", text: $daily, saving: saving == "budget") {
                    guard let usd = Int(daily.filter(\.isNumber)) else { error = "Type a whole number of dollars."; return }
                    await save("budget") { try await $0.setSalesBudget(brandId: state.selectedBrand!.id, cents: usd * 100) }
                }
            }
        }
        SettingsSection(title: "Conversion tracking", purpose: "Send us your signups and sales, so the return is measured.") {
            LoadView(load: token, rows: 1) { t in
                InfoLine(label: "Status", value: (t.status ?? "not_set_up").replacingOccurrences(of: "_", with: " ").capitalized)
                CopyLine(text: t.ingestUrl)
            }
        }
        Button("Ask the chat to change a setting") { state.ask("In my brand settings, change ") }
            .buttonStyle(.plain).font(K.meta).foregroundStyle(K.accent)
            .task(id: state.selectedBrand?.id) { await load() }
    }

    private func load() async {
        guard let api = state.api, let b = state.selectedBrand else { return }
        brand = .loading; rep = .loading; econ = .loading; budget = .loading; token = .loading
        do { let x = try await api.brand(id: b.id); brand = .loaded(x); name = x.name ?? "" } catch { brand = .failed(error.localizedDescription) }
        do { let x = try await api.salesRep(brandId: b.id); rep = .loaded(x); repEmail = x.salesRepEmail ?? ""; repPhone = x.salesRepPhone ?? ""; repName = x.salesRepFirstName ?? "" } catch { rep = .failed(error.localizedDescription) }
        if let o = state.selectedOffer {
            do { let x = try await api.offerEconomics(brandId: b.id, offerId: o.offerId); econ = .loaded(x); booking = x.bookingUrl ?? "" } catch { econ = .failed(error.localizedDescription) }
        }
        do { let x = try await api.salesBudget(brandId: b.id); budget = .loaded(x); daily = x.dailyBudgetCents.map { String(Int($0 / 100)) } ?? "" } catch { budget = .failed(error.localizedDescription) }
        do { token = .loaded(try await api.conversionToken(brandId: b.id)) } catch { token = .failed(error.localizedDescription) }
    }

    private func saveRep() async {
        guard !repEmail.isEmpty else { error = "A sales rep needs an email."; return }
        await save("rep") {
            try await $0.setSalesRep(brandId: state.selectedBrand!.id, email: repEmail,
                                     phone: repPhone.isEmpty ? nil : repPhone, firstName: repName.isEmpty ? nil : repName, role: nil)
        }
    }

    private func save(_ what: String, _ work: (DistributeAPI) async throws -> Void) async {
        guard let api = state.api else { return }
        saving = what; error = nil
        do { try await work(api) } catch { self.error = error.localizedDescription }
        saving = nil
    }
}

/// v2's settings row: title and purpose, then the fields in a card.
private struct SettingsSection<Content: View>: View {
    let title: String
    let purpose: String
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.system(size: 13, weight: .semibold)).foregroundStyle(K.fg1)
            Text(purpose).font(K.meta).foregroundStyle(K.fg3)
            KCard { VStack(alignment: .leading, spacing: 10) { content }.padding(12).frame(maxWidth: .infinity, alignment: .leading) }
        }
        .padding(.bottom, 6)
    }
}

/// A value that reads as text and saves when you leave it (v2: no Save button on a native value).
private struct EditLine: View {
    let label: String
    @Binding var text: String
    let saving: Bool
    let commit: () async -> Void
    @Environment(\.isSnapshot) private var snapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack { KLabel(label); if saving { ProgressView().controlSize(.mini) } }
            if snapshot {
                Text(text.isEmpty ? "—" : text).font(K.body).foregroundStyle(text.isEmpty ? K.fg4 : K.fg1)
            } else {
                TextField("—", text: $text).textFieldStyle(.plain).font(K.body).foregroundStyle(K.fg1)
                    .onSubmit { Task { await commit() } }
            }
        }
    }
}

private struct InfoLine: View {
    let label: String
    let value: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            KLabel(label)
            Text(value ?? "—").font(K.body).foregroundStyle(value == nil ? K.fg4 : K.fg1).lineLimit(1).truncationMode(.middle).textSelection(.enabled)
        }
    }
}

// MARK: - Billing (v2 `billing-page.tsx`, prepaid)

struct BillingPanel: View {
    @EnvironmentObject var state: AppState
    @State private var account: Load<BillingAccount> = .idle
    @State private var payments: Load<[Payment]> = .idle
    @State private var error: String?

    var body: some View {
        if let error { EmptyNote(text: error, isError: true) }
        LoadView(load: account) { a in
            KCard {
                HStack(spacing: 0) {
                    Figure(label: "Available", value: dollars(cents: Double(a.balance_cents))).padding(12)
                    Figure(label: "Total credited", value: dollars(cents: Double(a.credited_cents))).padding(12)
                }
            }
            HStack(spacing: 6) {
                ForEach([50, 100, 250], id: \.self) { usd in
                    Button("Add $\(usd)") { Task { await state.topUp(cents: usd * 100) } }.buttonStyle(KButtonStyle(strong: usd == 100))
                }
            }
            if a.has_payment_method {
                InfoLineBilling(label: "Card", value: [a.card_brand?.capitalized, a.card_last4.map { "•••• \($0)" }].compactMap { $0 }.joined(separator: " "))
                if a.auto_reload_supported != false {
                    Toggle(isOn: Binding(get: { a.has_auto_topup }, set: { on in Task { await setAuto(on) } })) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Auto top-up").font(K.body)
                            Text("Adds $50 when credit falls under $5, so sending never stops.").font(K.meta).foregroundStyle(K.fg3)
                        }
                    }
                    .toggleStyle(.switch).controlSize(.small)
                }
            }
        }
        Text("Payments").font(.system(size: 13, weight: .semibold)).padding(.top, 6)
        LoadView(load: payments) { list in
            let ok = list.filter { $0.status == "succeeded" }.sorted { $0.created > $1.created }
            if ok.isEmpty { EmptyNote(text: "No payment yet.") }
            ForEach(ok) { p in
                HStack {
                    Text(Date(timeIntervalSince1970: p.created).formatted(date: .abbreviated, time: .omitted)).font(K.body).foregroundStyle(K.fg2)
                    Spacer()
                    Text(dollars(cents: Double(p.amount))).font(K.body).monospacedDigit().foregroundStyle(K.fg1)
                }
                .padding(.horizontal, 10).frame(height: 32)
            }
        }
        .task(id: state.selectedOrg?.id) { await load() }
    }

    private func load() async {
        guard let api = state.api, let org = state.selectedOrg else { return }
        account = .loading; payments = .loading
        do { account = .loaded(try await api.billingAccount(orgId: org.id)) } catch { account = .failed(error.localizedDescription) }
        do { payments = .loaded(try await api.payments(orgId: org.id)) } catch { payments = .failed(error.localizedDescription) }
    }

    private func setAuto(_ on: Bool) async {
        guard let api = state.api, let org = state.selectedOrg else { return }
        do { try await api.setAutoTopUp(orgId: org.id, on: on); await load() } catch { self.error = error.localizedDescription }
    }
}

private struct InfoLineBilling: View {
    let label: String
    let value: String
    var body: some View {
        HStack { KLabel(label); Spacer(); Text(value.isEmpty ? "—" : value).font(K.body).foregroundStyle(K.fg1) }
    }
}

// MARK: - A brand and an offer, without the web onboarding

struct AddBrandView: View {
    @EnvironmentObject var state: AppState
    @State private var url = ""
    @State private var busy = false
    @State private var error: String?
    @Environment(\.isSnapshot) private var snapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Add your brand").font(.system(size: 22, weight: .semibold)).foregroundStyle(K.fg1)
            Text("Paste your website. We read it and set up your brand.").font(K.body).foregroundStyle(K.fg3)
            HStack(spacing: 8) {
                if snapshot {
                    Text("yourcompany.com").font(K.body).foregroundStyle(K.fg4).frame(maxWidth: 320, alignment: .leading)
                } else {
                    TextField("yourcompany.com", text: $url).textFieldStyle(.roundedBorder).frame(maxWidth: 320).onSubmit(add)
                }
                Button(busy ? "Adding…" : "Add brand", action: add).buttonStyle(KButtonStyle(strong: true)).disabled(url.isEmpty || busy)
            }
            if let error { EmptyNote(text: error, isError: true) }
        }
    }

    private func add() {
        busy = true; error = nil
        let u = url.hasPrefix("http") ? url : "https://\(url)"
        Task {
            do { try await state.addBrand(url: u) } catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}

struct CreateOfferView: View {
    @EnvironmentObject var state: AppState
    @State private var description = ""
    @State private var proposals: OfferProposals?
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Create your offer").font(.system(size: 18, weight: .semibold)).foregroundStyle(K.fg1)
            Text("Say in one line what you sell. We propose offers to pick from.").font(K.meta).foregroundStyle(K.fg3)
            TextField("We help dentists fill their calendar", text: $description, axis: .vertical).textFieldStyle(.roundedBorder).lineLimit(1...3)
            Button(busy ? "Thinking… (up to two minutes)" : "Propose offers") { Task { await propose() } }
                .buttonStyle(KButtonStyle(strong: true)).disabled(description.isEmpty || busy)
            if let error { EmptyNote(text: error, isError: true) }
            if let p = proposals {
                ForEach(Array(p.offers.enumerated()), id: \.offset) { i, o in
                    Button { Task { await confirm(p, i) } } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(o.name).font(.system(size: 13, weight: .semibold)).foregroundStyle(K.fg1)
                            Text(o.description).font(K.meta).foregroundStyle(K.fg2).multilineTextAlignment(.leading)
                        }
                        .padding(10).frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 10).fill(i == p.mainOfferIndex ? K.accentSoft : K.raised))
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(K.line, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func propose() async {
        guard let api = state.api, let b = state.selectedBrand else { return }
        busy = true; error = nil
        do { proposals = try await api.proposeOffers(brandId: b.id, description: description) } catch { self.error = error.localizedDescription }
        busy = false
    }

    private func confirm(_ p: OfferProposals, _ i: Int) async {
        guard let api = state.api, let b = state.selectedBrand else { return }
        busy = true
        do { await state.offerCreated(try await api.confirmOffer(brandId: b.id, offers: p.offers, chosen: i)) } catch { self.error = error.localizedDescription }
        busy = false
    }
}
