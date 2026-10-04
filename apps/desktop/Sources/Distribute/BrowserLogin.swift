import Foundation
import Network
import AppKit

/// Browser sign-in, the `gh auth login` / RFC 8252 loopback pattern. The app listens on
/// 127.0.0.1:<random port>, opens `dashboard.distribute.you/desktop/connect?port=&state=`,
/// the user signs in with Google or email there, and the page navigates to
/// `http://127.0.0.1:<port>/callback?state=&key=`. A key is accepted only with OUR state.
/// Protocol and its tests on the web side: `apps/dashboard/src/lib/desktop-connect.ts`.
final class BrowserLogin {
    private var listener: NWListener?
    private let state: String = {
        var bytes = [UInt8](repeating: 0, count: 24)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return Data(bytes).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }()

    /// Starts listening, opens the browser, and calls `onKey` once with the key (or an error).
    func start(onResult: @escaping (Result<String, Error>) -> Void) {
        stop()
        do {
            let params = NWParameters.tcp
            params.requiredLocalEndpoint = NWEndpoint.hostPort(host: "127.0.0.1", port: .any)
            let listener = try NWListener(using: params)
            self.listener = listener
            var delivered = false
            let deliver: (Result<String, Error>) -> Void = { result in
                DispatchQueue.main.async {
                    guard !delivered else { return }
                    delivered = true
                    onResult(result)
                }
            }
            listener.stateUpdateHandler = { [weak self] st in
                switch st {
                case .ready:
                    guard let self, let port = listener.port?.rawValue else { return }
                    var comps = URLComponents(url: dashboardURL.appendingPathComponent("desktop/connect"), resolvingAgainstBaseURL: false)!
                    comps.queryItems = [URLQueryItem(name: "port", value: String(port)), URLQueryItem(name: "state", value: self.state)]
                    DispatchQueue.main.async { NSWorkspace.shared.open(comps.url!) }
                case .failed(let err):
                    deliver(.failure(APIError(message: "Could not listen for the browser sign-in: \(err)")))
                default: break
                }
            }
            listener.newConnectionHandler = { [weak self] conn in
                conn.start(queue: .global())
                conn.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { data, _, _, _ in
                    guard let self else { conn.cancel(); return }
                    let request = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                    let key = self.key(from: request)
                    let body = key != nil
                        ? "<h2>distribute for Mac is connected.</h2><p>You can close this tab and go back to the app.</p>"
                        : "<h2>This sign-in link is not for this app.</h2><p>Go back to distribute for Mac and click Continue again.</p>"
                    let html = "<!doctype html><meta charset=utf-8><title>distribute</title><body style=\"font-family:-apple-system,sans-serif;padding:48px;color:#101012\">\(body)</body>"
                    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: \(html.utf8.count)\r\nConnection: close\r\n\r\n\(html)"
                    conn.send(content: Data(response.utf8), completion: .contentProcessed { _ in conn.cancel() })
                    if let key {
                        deliver(.success(key))
                        self.stop()
                    }
                }
            }
            listener.start(queue: .global())
        } catch {
            onResult(.failure(error))
        }
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    /// `GET /callback?state=…&key=… HTTP/1.1` with OUR state, else nil.
    private func key(from request: String) -> String? {
        guard let line = request.split(separator: "\r\n").first else { return nil }
        let parts = line.split(separator: " ")
        guard parts.count >= 2, parts[0] == "GET",
              let comps = URLComponents(string: "http://127.0.0.1" + parts[1]),
              comps.path == "/callback" else { return nil }
        let items = comps.queryItems ?? []
        guard items.first(where: { $0.name == "state" })?.value == state,
              let key = items.first(where: { $0.name == "key" })?.value, !key.isEmpty else { return nil }
        return key
    }
}
