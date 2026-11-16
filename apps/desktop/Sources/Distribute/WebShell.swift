import SwiftUI
import WebKit
import UniformTypeIdentifiers

/// The window IS the web dashboard: the real pages, so the app can never drift from the web.
///
/// Sign-in happens inside this view with the dashboard's own screens. The app also needs the
/// user's distribute key (for the local runner): it loads the dashboard's
/// `/desktop/connect?port=&state=` page here, which mints the key and navigates to
/// `http://127.0.0.1:<port>/callback?state=&key=`. Nothing listens on that port: the
/// navigation is caught below and cancelled, and the key is accepted only with OUR state.
/// Protocol and its tests on the web side: `apps/dashboard/src/lib/desktop-connect.ts`.
struct WebShell: NSViewRepresentable {
    @ObservedObject var session: Session

    func makeCoordinator() -> Coordinator { Coordinator(session: session) }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Persistent store: the dashboard session survives a relaunch.
        config.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: config)
        // Google refuses its sign-in screen to an embedded web view's default user agent.
        view.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15"
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        context.coordinator.begin(in: view)
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {
        context.coordinator.restartIfAsked(in: view, tick: session.reloadTick)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
        private let session: Session
        private var seenTick = 0
        /// Any unprivileged port: the page only needs a well-formed loopback callback.
        private let callbackPort = 49231
        private var connectState = Coordinator.randomState()

        init(session: Session) { self.session = session }

        private static func randomState() -> String {
            var bytes = [UInt8](repeating: 0, count: 24)
            _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
            return Data(bytes).base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
        }

        func begin(in view: WKWebView) {
            if session.apiKey == nil {
                connectState = Coordinator.randomState()
                var parts = URLComponents(url: dashboardURL.appendingPathComponent("desktop/connect"), resolvingAgainstBaseURL: false)!
                parts.queryItems = [
                    URLQueryItem(name: "port", value: String(callbackPort)),
                    URLQueryItem(name: "state", value: connectState),
                ]
                view.load(URLRequest(url: parts.url!))
            } else {
                view.load(URLRequest(url: dashboardURL))
            }
        }

        /// Sign-out from the menu bar: forget the web session too, then start over.
        func restartIfAsked(in view: WKWebView, tick: Int) {
            guard tick != seenTick else { return }
            seenTick = tick
            let store = view.configuration.websiteDataStore
            store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) { [weak self, weak view] in
                guard let self, let view else { return }
                self.begin(in: view)
            }
        }

        // MARK: Navigation

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url, url.host == "127.0.0.1", url.path == "/callback" {
                decisionHandler(.cancel)
                let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
                let state = items.first { $0.name == "state" }?.value
                let key = items.first { $0.name == "key" }?.value
                if state == connectState, let key, !key.isEmpty {
                    session.setKey(key)
                } else {
                    NSLog("[desktop] sign-in callback refused: state mismatch or no key")
                }
                webView.load(URLRequest(url: dashboardURL))
                return
            }
            if navigationAction.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
        }

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
        }

        // MARK: Downloads (CSV exports)

        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
            let folder = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
                ?? URL(fileURLWithPath: NSTemporaryDirectory())
            var target = folder.appendingPathComponent(suggestedFilename)
            var n = 1
            while FileManager.default.fileExists(atPath: target.path) {
                let base = (suggestedFilename as NSString).deletingPathExtension
                let ext = (suggestedFilename as NSString).pathExtension
                target = folder.appendingPathComponent(ext.isEmpty ? "\(base) \(n)" : "\(base) \(n).\(ext)")
                n += 1
            }
            completionHandler(target)
        }

        func downloadDidFinish(_ download: WKDownload) {
            if let folder = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first {
                NSWorkspace.shared.open(folder)
            }
        }

        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            NSLog("[desktop] download failed: \(error.localizedDescription)")
        }

        // MARK: What a browser tab does and a bare web view does not

        /// `target="_blank"` and `window.open` (payment page, account connections): same view.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = NSAlert()
            alert.messageText = message
            alert.runModal()
            completionHandler()
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = NSAlert()
            alert.messageText = message
            alert.addButton(withTitle: "OK")
            alert.addButton(withTitle: "Cancel")
            completionHandler(alert.runModal() == .alertFirstButtonReturn)
        }

        /// File inputs (CSV upload, offer documents).
        func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
            let panel = NSOpenPanel()
            panel.allowsMultipleSelection = parameters.allowsMultipleSelection
            panel.canChooseDirectories = false
            completionHandler(panel.runModal() == .OK ? panel.urls : nil)
        }
    }
}
