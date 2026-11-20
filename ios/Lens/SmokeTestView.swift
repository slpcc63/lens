import SwiftUI
import WebKit

struct SmokeTestView: View {
    @State private var result = "Running stage-one checks…"
    var body: some View {
        ScrollView { Text(result).font(.body.monospaced()).padding() }
            .task { await run() }
    }

    @MainActor private func run() async {
        var checks: [String] = []
        do {
            func require(_ value: Bool, _ name: String) throws {
                if !value { throw AppIssue.message("FAIL: " + name) }
                checks.append("PASS: " + name)
            }
            try require(try SiteAddress.parse("example.com/path?token=private#section").absoluteString == "https://example.com/path", "URL normalization removes saved tokens")
            for address in ["http://example.com", "javascript:alert(1)", "https://user:password@example.com", "file:///tmp/a"] {
                var rejected = false
                do { _ = try SiteAddress.parse(address) } catch { rejected = true }
                try require(rejected, "Reject unsafe saved address")
            }
            let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".json")
            defer { try? FileManager.default.removeItem(at: file) }
            let store = SiteStore(file: file)
            try store.add(name: "Example", address: "example.com")
            let restored = SiteStore(file: file)
            try require(restored.sites.count == 1 && restored.sites.first?.name == "Example", "Saved sites survive store recreation")
            var duplicateRejected = false
            do { try store.add(name: "Duplicate", address: "example.com") } catch { duplicateRejected = true }
            try require(duplicateRejected, "Duplicate site rejected")
            let stableID = store.sites[0].id
            try store.update(id: stableID, name: "Updated", address: "alias.example.com/path?token=private", preferredUsername: "preferred")
            try require(store.sites[0].id == stableID && store.sites[0].url.absoluteString == "https://alias.example.com/path", "Editing URL preserves stable identity and strips tokens")
            try require(store.sites[0].preferredUsername == "preferred", "Preferred account reminder persists")
            try store.add(name: "Second", address: "second.example.com")
            var collisionRejected = false
            do { try store.update(id: stableID, name: "Collision", address: "second.example.com", preferredUsername: "") } catch { collisionRejected = true }
            try require(collisionRejected && store.sites[0].id == stableID, "Edit rejects URL collision without reordering sites")
            let oldFormat = "[{\"id\":\"\(UUID().uuidString)\",\"name\":\"Old site\",\"url\":\"https://legacy.example.com\"}]"
            let migrated = try JSONDecoder().decode([SavedSite].self, from: Data(oldFormat.utf8))
            try require(migrated.first?.preferredUsername == nil, "Existing build-one saved sites decode without losing data")
            let previousGeneration = store.generation
            try store.replaceWithBackup(with: migrated)
            try require(store.generation != previousGeneration && store.sites == migrated, "Account download applies validated settings and updates generation")
            var invalidSnapshotRejected = false
            do { try store.replace(with: [SavedSite(name: "Unsafe", url: URL(string: "http://unsafe.example")!)]) } catch { invalidSnapshotRejected = true }
            try require(invalidSnapshotRejected && store.sites == migrated, "Invalid account snapshot cannot overwrite local sites")
            let emptyInbox = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            defer { try? FileManager.default.removeItem(at: emptyInbox) }
            store.importSharedSites(from: emptyInbox)
            store.importSharedSites(from: emptyInbox)
            try require(store.error == nil && store.sites == migrated, "Missing and empty share inboxes preserve sites without an error")
            let shareHost = "share-" + UUID().uuidString.lowercased() + ".invalid"
            try SharedSiteInbox.save(name: "Shared", url: URL(string: "https://" + shareHost + "/path?token=private#secret")!)
            store.importSharedSites()
            try require(store.sites.contains { $0.url.absoluteString == "https://" + shareHost + "/path" }, "Share inbox imports a sanitized HTTPS shortcut")
            let origin = "https://smoke-\(UUID().uuidString).invalid"
            defer { try? LoginVault.delete(origin: origin) }
            try LoginVault.save(SiteLogin(username: "synthetic", password: "test-only"), origin: origin)
            try require(try LoginVault.read(origin: origin)?.password == "test-only", "Keychain round trip")
            try require(try LoginVault.read(origin: origin + ":8443") == nil, "Keychain exact-origin isolation")
            try LoginVault.save(SiteLogin(username: "updated", password: "changed"), origin: origin)
            try require(try LoginVault.read(origin: origin)?.username == "updated", "Keychain update")
            try LoginVault.delete(origin: origin)
            try require(try LoginVault.read(origin: origin) == nil, "Keychain delete")
            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .default()
            let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 700), configuration: configuration)
            let navigation = ReadyNavigation()
            web.navigationDelegate = navigation
            web.loadHTMLString("<html><body><form><input name='username'><input type='password'></form></body></html>", baseURL: URL(string: "https://example.test"))
            for _ in 0..<100 {
                if navigation.finished { break }
                try await Task.sleep(for: .milliseconds(100))
            }
            try require(navigation.finished, "WebKit renders a synthetic login page")
            let args: [String: Any] = ["expectedOrigin": "https://wrong.test", "username": "test", "password": "test"]
            let refused = try await web.callAsyncJavaScript(BrowserModel.fillScript, arguments: args, in: nil, contentWorld: .page)
            try require(refused as? Bool == false, "Credential fill refuses origin mismatch")
            let allInputValues = try await web.evaluateJavaScript("[...document.querySelectorAll('input')].every(e=>e.value==='')")
            try require(allInputValues as? Bool == true, "Rejected fill leaves page fields untouched")
            if ProcessInfo.processInfo.arguments.contains("--sync-preview-test") { checks += try await NativePreviewCheck.run() }
            result = checks.joined(separator: "\n") + "\n\nAll local checks passed. Real website sign-in and device authentication still need iPhone QA."
        } catch { result = checks.joined(separator: "\n") + "\n" + error.localizedDescription }
        let file = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("stage-one-smoke.txt")
        try? result.write(to: file, atomically: true, encoding: .utf8)
    }
}

@MainActor final class ReadyNavigation: NSObject, WKNavigationDelegate {
    var finished = false
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { finished = true }
}
