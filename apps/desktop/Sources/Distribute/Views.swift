import SwiftUI
import AppKit

let accent = Color(red: 0.16, green: 0.38, blue: 0.95)

struct RootView: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        Group {
            if state.apiKey == nil {
                ConnectView()
            } else if state.cliChecked && state.cli == nil {
                ClaudeMissingView()
            } else {
                NavigationSplitView {
                    SidebarView()
                        .navigationSplitViewColumnWidth(min: 220, ideal: 250, max: 320)
                } detail: {
                    HStack(spacing: 0) {
                        ChatView()
                        if state.showChannel {
                            Divider()
                            ChannelPanel().frame(width: 380)
                        }
                    }
                }
            }
        }
        .frame(minWidth: 900, minHeight: 600)
        .task { await state.boot() }
    }
}

// MARK: - Onboarding

struct ConnectView: View {
    @EnvironmentObject var state: AppState
    @State private var key = ""
    @State private var busy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("distribute").font(.system(size: 28, weight: .semibold))
            Text("Revenue made easy.").font(.title3).foregroundStyle(.secondary)
            Text("Paste your distribute API key to connect your brands.")
            SecureField("distrib.usr_…", text: $key)
                .textFieldStyle(.roundedBorder)
                .onSubmit(connect)
            HStack {
                Button(busy ? "Connecting…" : "Connect", action: connect)
                    .keyboardShortcut(.defaultAction)
                    .disabled(key.isEmpty || busy)
                Link("Get an API key", destination: dashboardURL.appendingPathComponent("api-keys"))
            }
            if let err = state.loadError {
                Text(err).foregroundStyle(.red).font(.callout).textSelection(.enabled)
            }
        }
        .padding(40)
        .frame(maxWidth: 520)
    }

    private func connect() {
        busy = true
        Task {
            await state.connect(key: key)
            busy = false
        }
    }
}

struct ClaudeMissingView: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Claude Code not found").font(.title2.weight(.semibold))
            Text("The chat runs on your own Claude subscription. Install Claude Code, log in once, then retry.")
            Text("npm install -g @anthropic-ai/claude-code\nclaude")
                .font(.system(.body, design: .monospaced))
                .padding(10)
                .background(Color.secondary.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
                .textSelection(.enabled)
            Button("Retry") {
                state.cliChecked = false
                Task { await state.boot() }
            }
        }
        .padding(40)
        .frame(maxWidth: 520)
    }
}

// MARK: - Sidebar

struct SidebarView: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        List {
            Section {
                brandMenu
            }
            Section("Channels") {
                Button {
                    state.showChannel.toggle()
                } label: {
                    HStack {
                        Image(systemName: "envelope")
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Cold email")
                            Text(campaignCount).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if state.showChannel { Image(systemName: "chevron.right").foregroundStyle(.secondary) }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, 2)
            }
            Section("Credits") {
                CreditsView()
            }
        }
        .listStyle(.sidebar)
        .safeAreaInset(edge: .bottom) {
            HStack {
                if let email = state.me?.user?.email { Text(email).font(.caption).foregroundStyle(.secondary).lineLimit(1) }
                Spacer()
                Button("Sign out") { state.signOut() }.buttonStyle(.link).font(.caption)
            }
            .padding(10)
        }
    }

    private var campaignCount: String {
        state.rows.count == 1 ? "1 campaign" : "\(state.rows.count) campaigns"
    }

    private var brandMenu: some View {
        Menu {
            ForEach(state.me?.organizations ?? []) { org in
                if !org.brands.isEmpty {
                    Section(org.name ?? org.id) {
                        ForEach(org.brands) { brand in
                            Button(brand.label) { state.select(brand: brand, in: org) }
                        }
                    }
                }
            }
        } label: {
            Label(state.selectedBrand?.label ?? "Choose a brand", systemImage: "building.2")
        }
        .menuStyle(.borderlessButton)
    }
}

struct CreditsView: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let b = state.balance {
                Text(dollars(cents: Double(b.balance_cents)))
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(b.depleted ? .red : .primary)
                if b.depleted { Text("Out of credit: sending is on hold.").font(.caption).foregroundStyle(.red) }
            } else {
                Text("…").foregroundStyle(.secondary)
            }
            Text("Top up").font(.caption).foregroundStyle(.secondary)
            HStack(spacing: 6) {
                ForEach([50, 100, 250], id: \.self) { usd in
                    Button("$\(usd)") { Task { await state.topUp(cents: usd * 100) } }
                }
            }
            .controlSize(.small)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Channel panel

struct ChannelPanel: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Cold email").font(.headline)
                Spacer()
                if state.channelLoading { ProgressView().controlSize(.small) }
                Button { Task { await state.refreshChannel() } } label: { Image(systemName: "arrow.clockwise") }
                    .buttonStyle(.borderless)
                Button { state.showChannel = false } label: { Image(systemName: "xmark") }
                    .buttonStyle(.borderless)
            }
            .padding(14)
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let err = state.channelError {
                        Text(err).foregroundStyle(.red).font(.callout).textSelection(.enabled)
                    }
                    if state.rows.isEmpty && !state.channelLoading && state.channelError == nil {
                        Text("No cold email campaign on this brand yet. Ask in the chat to start one.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(state.rows) { CampaignCard(row: $0) }
                }
                .padding(14)
            }
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

struct CampaignCard: View {
    @EnvironmentObject var state: AppState
    let row: CampaignRow

    var body: some View {
        let o = row.figures?.outcomes
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(row.campaign.name).font(.subheadline.weight(.semibold)).lineLimit(2)
                Spacer()
                Text(row.campaign.status.capitalized)
                    .font(.caption2.weight(.medium))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(statusColor.opacity(0.15), in: Capsule())
                    .foregroundStyle(statusColor)
            }
            Grid(alignment: .leading, horizontalSpacing: 14, verticalSpacing: 6) {
                GridRow {
                    Stat(label: "Sent", value: count(o?.sending?.recipientsSent))
                    Stat(label: "Clicks", value: count(o?.recipientsClicked))
                    Stat(label: "Positive replies", value: count(o?.recipientsRepliesPositive))
                }
                GridRow {
                    Stat(label: "Spent", value: row.figures?.costEconomics.committedCostUsd.map { dollars(cents: $0 * 100) } ?? "—")
                    Stat(label: "Per positive reply", value: costPerPositiveReply(o))
                    Stat(label: "Reply rate", value: o?.sending?.replyRatePct.map { String(format: "%.1f%%", $0) } ?? "—")
                }
            }
            Button("Adjust in chat") {
                state.draft = "About my campaign \"\(row.campaign.name)\" (id \(row.campaign.id)): "
            }
            .buttonStyle(.link)
            .font(.caption)
        }
        .padding(12)
        .background(Color.secondary.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.secondary.opacity(0.15), lineWidth: 1))
    }

    private var statusColor: Color {
        row.campaign.status == "ongoing" ? .green : .secondary
    }

    /// At zero positive replies the served cost is not a price yet: "Learning".
    private func costPerPositiveReply(_ o: RevenueGroup.Outcomes?) -> String {
        guard let o else { return "—" }
        guard let replies = o.recipientsRepliesPositive, replies > 0, let cents = o.cpprCents else { return "Learning" }
        return dollars(cents: cents)
    }
}

struct Stat: View {
    let label: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(.callout.weight(.semibold)).monospacedDigit()
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
    }
}

// MARK: - Chat

struct ChatView: View {
    @EnvironmentObject var state: AppState
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(state.selectedBrand?.label ?? "").font(.headline)
                Spacer()
                Button("New chat") { state.newChat() }.buttonStyle(.borderless).disabled(state.chatBusy)
            }
            .padding(14)
            Divider()
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 10) {
                        if state.chat.isEmpty { emptyState }
                        ForEach(state.chat) { item in
                            ChatBubble(item: item).id(item.id)
                        }
                        if state.chatBusy {
                            HStack(spacing: 6) { ProgressView().controlSize(.small); Text("Working…").foregroundStyle(.secondary) }
                                .id("busy")
                        }
                    }
                    .padding(16)
                }
                .onChange(of: state.chat.count) {
                    withAnimation { proxy.scrollTo(state.chatBusy ? AnyHashable("busy") : AnyHashable(state.chat.last?.id), anchor: .bottom) }
                }
            }
            Divider()
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Ask about your results, or tell it what to change…", text: $state.draft, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...6)
                    .focused($focused)
                    .onSubmit(send)
                if state.chatBusy {
                    Button("Stop") { state.stopChat() }
                } else {
                    Button("Send", action: send)
                        .keyboardShortcut(.return, modifiers: .command)
                        .disabled(state.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .padding(12)
        }
        .onChange(of: state.draft) { focused = true }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("What should we look at?").font(.title3.weight(.semibold))
            ForEach(["How is cold email doing this week?",
                     "Which campaign gets the cheapest positive reply?",
                     "Pause sending for this brand."], id: \.self) { s in
                Button(s) { state.draft = s }.buttonStyle(.link)
            }
        }
        .padding(.vertical, 20)
    }

    private func send() {
        let text = state.draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !state.chatBusy else { return }
        state.draft = ""
        state.send(text)
    }
}

struct ChatBubble: View {
    let item: ChatItem

    var body: some View {
        switch item {
        case .user(_, let text):
            HStack { Spacer(minLength: 60); Text(text).textSelection(.enabled).padding(10).background(accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 10)) }
        case .assistant(_, let text):
            Text((try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text))
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .tool(_, let label):
            Label(label, systemImage: "wrench.and.screwdriver").font(.caption).foregroundStyle(.secondary).lineLimit(1)
        case .error(_, let text):
            Text(text).foregroundStyle(.red).font(.callout).textSelection(.enabled)
        }
    }
}

func count(_ v: Double?) -> String {
    guard let v else { return "—" }
    return Int(v).formatted()
}

func dollars(cents: Double?) -> String {
    guard let cents else { return "—" }
    return (cents / 100).formatted(.currency(code: "USD"))
}
