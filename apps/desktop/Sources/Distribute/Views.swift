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
                    .overlay {
                        if state.menu != nil {
                            Color.black.opacity(0.001).onTapGesture { state.menu = nil }
                        }
                    }
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
                    Text("looking at \(state.title(of: p))").font(K.meta).foregroundStyle(K.fg3)
                }
                Spacer()
                Button("New chat") { state.newChat() }.buttonStyle(KButtonStyle(ghost: true)).disabled(state.chatBusy)
            }
            .padding(.horizontal, 16).frame(height: 48)
            Rectangle().fill(K.lineSubtle).frame(height: 1)
            ScrollViewReader { proxy in
                KScroll {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if (state.selectedBrand == nil && state.me != nil) || state.addingBrand { noBrandState }
                        else if state.chat.isEmpty { emptyState }
                        ForEach(state.chat) { item in
                            ChatBubble(item: item, isLast: item.id == state.chat.last?.id).id(item.id)
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
        .onChange(of: state.focusTick) { focused = true }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("What should we look at?").font(.system(size: 22, weight: .semibold)).foregroundStyle(K.fg1)
            Text(state.selectedBrand.map { "\($0.label)\(state.selectedOffer.map { ", \($0.name)" } ?? "")" } ?? "")
                .font(K.body).foregroundStyle(K.fg3)
            if let n = state.counts.needsCall, n > 0 {
                HStack(spacing: 10) {
                    Image(systemName: "bell.badge.fill").foregroundStyle(K.run)
                        .frame(width: 28, height: 28).background(RoundedRectangle(cornerRadius: 8).fill(K.run.opacity(0.12)))
                    Text(n == 1 ? "1 person is waiting on you." : "\(n) people are waiting on you.").font(.system(size: 14, weight: .medium)).foregroundStyle(K.fg1)
                    Spacer()
                    Button("Brief me") {
                        state.send("Give me my brief: who replied with interest and is waiting on me, what each one said, and what I should answer each one.")
                    }
                    .buttonStyle(KButtonStyle(strong: true))
                }
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(K.raised))
                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(K.line, lineWidth: 1))
                .padding(.top, 6)
            }
            VStack(alignment: .leading, spacing: 6) {
                ForEach(["How is it going since we started?",
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
    @EnvironmentObject var state: AppState
    let item: ChatItem
    var isLast = false

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
            let parts = splitActions(text)
            VStack(alignment: .leading, spacing: 10) {
                MarkdownText(text: parts.body)
                ForEach(parts.actions, id: \.self) { a in
                    ActionCard(text: a, live: isLast && !state.chatBusy)
                }
            }
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

// MARK: - Chat rendering

/// `ACTION: …` lines are the model's request to write (see the system prompt): they
/// become Approve / Cancel cards instead of text.
func splitActions(_ text: String) -> (body: String, actions: [String]) {
    var body: [String] = [], actions: [String] = []
    for line in text.components(separatedBy: "\n") {
        let t = line.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "`", with: "")
        if t.uppercased().hasPrefix("ACTION:") {
            actions.append(String(t.dropFirst(7)).trimmingCharacters(in: .whitespaces))
        } else {
            body.append(line)
        }
    }
    return (body.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines), actions)
}

struct ActionCard: View {
    @EnvironmentObject var state: AppState
    let text: String
    let live: Bool
    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: "bolt.fill").font(.system(size: 12)).foregroundStyle(K.amber)
                .frame(width: 26, height: 26).background(RoundedRectangle(cornerRadius: 7).fill(K.amber.opacity(0.14)))
            Text(text).font(.system(size: 13, weight: .medium)).foregroundStyle(K.fg1).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            if live {
                Button("Cancel") { state.send("No, cancel that.") }.buttonStyle(KButtonStyle(ghost: true))
                Button("Approve") { state.send("Yes, approved. Go ahead.") }.buttonStyle(KButtonStyle(strong: true))
            } else {
                Text("Answered").font(K.meta).foregroundStyle(K.fg3)
            }
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 12).fill(K.raised))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(live ? K.amber.opacity(0.45) : K.line, lineWidth: 1))
    }
}

/// Enough Markdown for a chat: headings, bullet and numbered lists, inline bold/italic/code/links.
struct MarkdownText: View {
    let text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                lineView(line)
            }
        }
        .textSelection(.enabled)
    }

    private var lines: [String] { text.components(separatedBy: "\n") }

    @ViewBuilder private func lineView(_ raw: String) -> some View {
        let line = raw.trimmingCharacters(in: .whitespaces)
        if line.isEmpty {
            Color.clear.frame(height: 2)
        } else if line.hasPrefix("#") {
            inline(line.drop { $0 == "#" }.trimmingCharacters(in: .whitespaces)).font(.system(size: 15, weight: .semibold))
        } else if line.hasPrefix("- ") || line.hasPrefix("* ") || line.hasPrefix("• ") {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("•").foregroundStyle(K.fg3)
                inline(String(line.dropFirst(2)))
            }
            .padding(.leading, raw.hasPrefix("  ") ? 16 : 0)
        } else if let r = line.range(of: #"^\d+[.)] "#, options: .regularExpression) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(line[r].trimmingCharacters(in: .whitespaces)).monospacedDigit().foregroundStyle(K.fg3)
                inline(String(line[r.upperBound...]))
            }
        } else {
            inline(line)
        }
    }

    private func inline(_ s: String) -> Text {
        let a = (try? AttributedString(markdown: s, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(s)
        return Text(a).font(.system(size: 14)).foregroundColor(K.fg1)
    }
}
