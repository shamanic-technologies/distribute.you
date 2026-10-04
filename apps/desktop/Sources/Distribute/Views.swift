import SwiftUI
import AppKit


struct RootView: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        Group {
            if state.apiKey == nil {
                ConnectView()
            } else if state.cliChecked && state.cli == nil {
                ClaudeMissingView()
            } else {
                // v2's frame: the sidebar on the canvas, the work in one raised panel.
                HStack(spacing: 0) {
                    SidebarView()
                    HStack(spacing: 0) {
                        ChatView().frame(minWidth: 420)
                        if let pane = state.pane {
                            Rectangle().fill(K.lineSubtle).frame(width: 1)
                            PanelView(pane: pane).frame(width: 400)
                        }
                    }
                    .background(K.raised)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(K.lineSubtle, lineWidth: 1))
                    .padding([.top, .bottom, .trailing], 8)
                }
                .background(K.canvas)
            }
        }
        .frame(minWidth: 1080, minHeight: 640)
        .environment(\.colorScheme, .light)
        .task { await state.boot() }
    }
}

// MARK: - Onboarding

struct ConnectView: View {
    @EnvironmentObject var state: AppState
    @State private var key = ""
    @State private var busy = false
    @State private var pasting = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("distribute").font(.system(size: 28, weight: .semibold))
            Text("Revenue made easy.").font(.title3).foregroundStyle(.secondary)
            Text("Sign in with Google or email to connect your brands.")
            if state.signingIn {
                HStack(spacing: 10) {
                    ProgressView().controlSize(.small)
                    Text("Finish signing in in your browser.").foregroundStyle(.secondary)
                    Button("Cancel") { state.cancelBrowserSignIn() }.buttonStyle(.link)
                }
            } else {
                Button("Continue in your browser") { state.signInWithBrowser() }
                    .keyboardShortcut(.defaultAction)
                    .controlSize(.large)
            }
            if pasting {
                SecureField("distrib.usr_…", text: $key)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit(connect)
                Button(busy ? "Connecting…" : "Connect", action: connect)
                    .disabled(key.isEmpty || busy)
            } else {
                Button("Paste an API key instead") { pasting = true }
                    .buttonStyle(.link)
                    .font(.callout)
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

// MARK: - Chat

struct ChatView: View {
    @EnvironmentObject var state: AppState
    @FocusState private var focused: Bool
    @Environment(\.isSnapshot) private var snapshot

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text("Chat").font(.system(size: 14, weight: .semibold)).foregroundStyle(K.fg1)
                if let p = state.pane {
                    Text("looking at \(p.title)").font(K.meta).foregroundStyle(K.fg3)
                }
                Spacer()
                Button("New chat") { state.newChat() }.buttonStyle(KButtonStyle(ghost: true)).disabled(state.chatBusy)
            }
            .padding(.horizontal, 16).frame(height: 48)
            Rectangle().fill(K.lineSubtle).frame(height: 1)
            ScrollViewReader { proxy in
                KScroll {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if state.selectedBrand == nil && state.me != nil { noBrandState }
                        else if state.chat.isEmpty { emptyState }
                        ForEach(state.chat) { item in
                            ChatBubble(item: item).id(item.id)
                        }
                        if state.chatBusy {
                            HStack(spacing: 6) { ProgressView().controlSize(.small); Text("Working…").font(K.body).foregroundStyle(K.fg3) }
                                .id("busy")
                        }
                    }
                    .padding(20)
                    .frame(maxWidth: 760, alignment: .leading)
                    .frame(maxWidth: .infinity)
                }
                .onChange(of: state.chat.count) {
                    withAnimation { proxy.scrollTo(state.chatBusy ? AnyHashable("busy") : AnyHashable(state.chat.last?.id), anchor: .bottom) }
                }
            }
            HStack(alignment: .bottom, spacing: 8) {
                if snapshot {
                    Text("Ask about your results, or tell it what to change").font(.system(size: 14)).foregroundStyle(K.fg4)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 4)
                } else {
                    TextField("Ask about your results, or tell it what to change", text: $state.draft, axis: .vertical)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14))
                        .lineLimit(1...8)
                        .focused($focused)
                        .onSubmit(send)
                        .padding(.vertical, 4)
                }
                if state.chatBusy {
                    Button("Stop") { state.stopChat() }.buttonStyle(KButtonStyle())
                } else {
                    Button(action: send) { Image(systemName: "arrow.up").font(.system(size: 12, weight: .semibold)) }
                        .buttonStyle(KButtonStyle(strong: true))
                        .keyboardShortcut(.return, modifiers: .command)
                        .disabled(state.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 12).fill(K.raised))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(focused ? K.accent.opacity(0.5) : K.line, lineWidth: 1))
            .shadow(color: .black.opacity(0.05), radius: 6, y: 2)
            .padding(16)
            .frame(maxWidth: 760)
        }
        .onChange(of: state.draft) { focused = true }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("What should we look at?").font(.system(size: 22, weight: .semibold)).foregroundStyle(K.fg1)
            Text(state.selectedBrand.map { "\($0.label)\(state.selectedOffer.map { ", \($0.name)" } ?? "")" } ?? "")
                .font(K.body).foregroundStyle(K.fg3)
            VStack(alignment: .leading, spacing: 6) {
                ForEach(["How is it going this week?",
                         "Who replied with interest, and what do I answer?",
                         "Which audience works best, and should we add one?",
                         "Pause sending for this brand."], id: \.self) { s in
                    Button(s) { state.draft = s }.buttonStyle(KButtonStyle())
                }
            }
            .padding(.top, 6)
        }
        .padding(.vertical, 24)
    }

    private var noBrandState: some View { AddBrandView().padding(.vertical, 24) }

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
            HStack {
                Spacer(minLength: 80)
                Text(text).font(.system(size: 14)).foregroundStyle(K.fg1).textSelection(.enabled)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 12).fill(K.accentSoft))
            }
        case .assistant(_, let text):
            Text((try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text))
                .font(.system(size: 14)).foregroundStyle(K.fg1).lineSpacing(3)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        case .tool(_, let label):
            HStack(spacing: 6) {
                Circle().fill(K.fg4).frame(width: 5, height: 5)
                Text(label).font(K.meta).foregroundStyle(K.fg3).lineLimit(1)
            }
        case .error(_, let text):
            EmptyNote(text: text, isError: true)
        }
    }
}
