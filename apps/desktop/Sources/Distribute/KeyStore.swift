import Foundation
import Security

/// The user's distribute API key, in a file only this user can read
/// (`~/Library/Application Support/Distribute/api-key`, mode 600).
///
/// Not the login Keychain (owner 2026-11-16): a Keychain item is tied to the app's
/// signature, and the app is ad-hoc signed, so every update asked for the Mac password
/// again before the runner could start. The same trade-off as `gh` or `claude` config files.
enum KeyStore {
    private static var fileURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Application Support")
        return base.appendingPathComponent("Distribute/api-key")
    }

    static func read() -> String? {
        if let text = try? String(contentsOf: fileURL, encoding: .utf8) {
            let key = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !key.isEmpty { return key }
        }
        // A key saved by an older build: move it over once (the last Keychain prompt).
        guard let old = LegacyKeychain.read() else { return nil }
        save(old)
        LegacyKeychain.delete()
        return old
    }

    static func save(_ key: String) {
        let url = fileURL
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Data(key.utf8).write(to: url, options: .atomic)
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
        } catch {
            NSLog("[desktop] could not save the distribute key: \(error.localizedDescription)")
        }
    }

    static func delete() {
        try? FileManager.default.removeItem(at: fileURL)
        LegacyKeychain.delete()
    }
}

/// Where builds before 2026-11-16 kept the key. Read once to migrate, then removed.
private enum LegacyKeychain {
    private static let service = "you.distribute.desktop"
    private static let account = "api-key"

    static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
        ]
        var out: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess,
              let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
