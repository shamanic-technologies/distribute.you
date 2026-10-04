import Foundation
import AppKit

/// One row of the channel panel: a campaign joined to ITS served figures by campaign id.
struct CampaignRow: Identifiable {
    let campaign: Campaign
    let figures: RevenueGroup?
    var id: String { campaign.id }
}

@MainActor
final class AppState: ObservableObject {
    @Published var apiKey: String? = Keychain.read()
    @Published var me: Me?
    @Published var loadError: String?
    @Published var selectedBrand: MeBrand?
    @Published var selectedOrg: MeOrg?
    @Published var showChannel = true

    @Published var balance: Balance?
    @Published var rows: [CampaignRow] = []
    @Published var channelError: String?
    @Published var channelLoading = false

    @Published var cli: ClaudeCLI.Located?
    @Published var cliChecked = false
    @Published var chat: [ChatItem] = []
    @Published var chatBusy = false
    @Published var draft = ""
    private let session = ClaudeSession()
    private let browserLogin = BrowserLogin()
    @Published var signingIn = false

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

    var api: DistributeAPI? { apiKey.map(DistributeAPI.init(apiKey:)) }

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
        apiKey = nil; me = nil; selectedBrand = nil; selectedOrg = nil
        rows = []; balance = nil; chat = []
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

    func select(brand: MeBrand, in org: MeOrg) {
        guard brand.id != selectedBrand?.id else { return }
        selectedBrand = brand
        selectedOrg = org
        session.reset()
        chat = []
        Task { await refreshChannel() }
    }

    func refreshChannel() async {
        guard let api, let brand = selectedBrand, let org = selectedOrg else { return }
        channelLoading = true
        channelError = nil
        defer { channelLoading = false }
        do {
            async let balance = api.balance(orgId: org.id)
            async let campaigns = api.campaigns(brandId: brand.id)
            async let revenue = api.coldEmailRevenue(brandId: brand.id)
            let (b, c, r) = try await (balance, campaigns, revenue)
            self.balance = b
            let byId = Dictionary(r.map { ($0.campaignId, $0) }, uniquingKeysWith: { a, _ in a })
            rows = c.filter { $0.featureSlug == coldEmailFeatureSlug }
                .map { CampaignRow(campaign: $0, figures: byId[$0.id]) }
        } catch {
            channelError = error.localizedDescription
        }
    }

    func topUp(cents: Int) async {
        guard let api, let org = selectedOrg else { return }
        do {
            NSWorkspace.shared.open(try await api.topUpCheckout(orgId: org.id, amountCents: cents))
        } catch {
            channelError = error.localizedDescription
        }
    }

    func send(_ text: String) {
        guard let cli, let apiKey, let brand = selectedBrand, let org = selectedOrg, !chatBusy else { return }
        chat.append(.user(id: UUID(), text: text))
        chatBusy = true
        let ctx = SessionContext(apiKey: apiKey, orgId: org.id, brandId: brand.id, brandName: brand.label)
        session.send(text, cli: cli, context: ctx, onItem: { [weak self] item in
            self?.chat.append(item)
        }, onDone: { [weak self] in
            guard let self else { return }
            self.chatBusy = false
            // The chat may have changed a budget or paused sending: re-read what it touched.
            Task { await self.refreshChannel() }
        })
    }

    func stopChat() { session.stop() }

    func newChat() {
        session.reset()
        chat = []
    }
}
