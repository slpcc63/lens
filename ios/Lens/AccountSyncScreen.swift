import SwiftUI
import WebKit

struct SiteSnapshot: Codable {
    var schemaVersion = 1
    let sites: [SavedSite]
}

struct AccountSyncScreen: View {
    @ObservedObject var store: SiteStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model = AccountSyncModel()
    var body: some View {
        NavigationStack {
            Group {
                if model.configured {
                    AccountPortal(model: model, store: store)
                } else {
                    ContentUnavailableView("Account sync is not available yet", systemImage: "icloud", description: Text("Your sites remain on this device. The shared Doxle account connection must be enabled before you can sync them."))
                }
            }.safeAreaInset(edge: .bottom) {
                if let message = model.message { Text(message).font(.callout).padding().frame(maxWidth: .infinity).background(.regularMaterial) }
            }.navigationTitle("Doxle account").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
                .confirmationDialog("Replace sites on this device with the account copy? A local backup will be kept.", isPresented: $model.confirmDownload, titleVisibility: .visible) {
                    Button("Use account settings") { model.applyDownload(to: store) }
                } message: { Text("This replaces \(store.sites.count) device sites with \(model.pendingDownload?.sites.count ?? 0) account sites. Website sessions are unchanged.") }
                .confirmationDialog("Replace the account's sites with this device's settings?", isPresented: $model.confirmUpload, titleVisibility: .visible) {
                    Button("Upload this device's settings") { model.upload(from: store) }
                } message: { Text("Your saved website addresses, names and preferred usernames will be sent to your signed-in Doxle account. No website passwords, cookies or history are included.") }
        }.tint(Family.action)
    }
}

@MainActor final class AccountSyncModel: NSObject, ObservableObject, WKScriptMessageHandler, WKNavigationDelegate {
    @Published var message: String?
    @Published var confirmDownload = false
    @Published var confirmUpload = false
    private(set) var pendingDownload: SiteSnapshot?
    private var pendingGeneration: UUID?
    private var uploadAccount: String?
    private var uploadRevision: Int?
    weak var store: SiteStore?
    private let endpoint: URL?
    private(set) var web: WKWebView?
    var configured: Bool { endpoint != nil }
    override init() {
        // Enable only after the reviewed server integration is deployed and accepted.
        if let raw = Bundle.main.object(forInfoDictionaryKey: "LensAccountSyncURL") as? String,
           let url = URL(string: raw), url.scheme == "https", url.host == "app.slpcc63.com",
           url.path == "/api/lens", url.query == nil, url.fragment == nil, url.port == nil,
           url.user == nil, url.password == nil { endpoint = url } else { endpoint = nil }
        super.init()
    }
    func makeWebView() -> WKWebView {
        if let web { return web }
        let config = WKWebViewConfiguration()
        // Keep the first-party account session isolated from visited websites.
        config.websiteDataStore = WKWebsiteDataStore(forIdentifier: UUID(uuidString: "C7A7E916-15F5-41B0-98B3-AFF88FB9C916")!)
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        config.userContentController.add(WeakAccountHandler(self), name: "lensSync")
        self.web = web
        if let endpoint { web.load(URLRequest(url: endpoint)) }
        return web
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive event: WKScriptMessage) {
        guard let endpoint, event.frameInfo.isMainFrame,
              event.frameInfo.securityOrigin.protocol == "https",
              event.frameInfo.securityOrigin.host == endpoint.host,
              event.frameInfo.securityOrigin.port == 443 || event.frameInfo.securityOrigin.port == 0,
              event.frameInfo.request.url?.path == endpoint.path,
              web?.url?.host == endpoint.host, web?.url?.path == endpoint.path,
              let body = event.body as? [String: Any], let type = body["type"] as? String,
              let account = body["userId"] as? String, !account.isEmpty else { return }
        if type == "download", let snapshot = body["snapshot"], let store {
            do {
                let data = try JSONSerialization.data(withJSONObject: snapshot)
                guard data.count <= 1048576 else { throw AppIssue.message("Account settings are too large.") }
                let value = try JSONDecoder().decode(SiteSnapshot.self, from: data)
                guard value.schemaVersion == 1 else { throw AppIssue.message("These settings require a newer Lens version.") }
                pendingDownload = value; pendingGeneration = store.generation; confirmDownload = true
            } catch { message = "Account settings could not be read. Your device copy is unchanged." }
        } else if type == "requestUpload", let revision = body["revision"] as? Int, revision >= 0 {
            uploadAccount = account; uploadRevision = revision; confirmUpload = true
        }
    }
    func applyDownload(to store: SiteStore) {
        guard let snapshot = pendingDownload, store.generation == pendingGeneration else { message = "Your sites changed during sync. Review the account copy again."; return }
        do { try store.replaceWithBackup(with: snapshot.sites); message = "Account settings saved on this device. Website sign-ins are unchanged."; pendingDownload = nil }
        catch { message = error.localizedDescription }
    }
    func upload(from store: SiteStore) {
        guard let web, let endpoint, web.url?.scheme == "https", web.url?.host == endpoint.host,
              web.url?.path == endpoint.path, web.url?.port == nil,
              let account = uploadAccount, let revision = uploadRevision else { message = "Account page changed. Reopen account sync before uploading."; return }
        do {
            let data = try JSONEncoder().encode(SiteSnapshot(sites: store.sites))
            guard data.count <= 1048576, let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw AppIssue.message("Settings are too large to sync.") }
            Task {
                do { _ = try await web.callAsyncJavaScript("if (location.origin !== expectedOrigin || location.pathname !== expectedPath) throw new Error('Account page changed'); await window.lensUploadDevice(snapshot, revision, account)", arguments: ["snapshot": object, "revision": revision, "account": account, "expectedOrigin": "https://app.slpcc63.com", "expectedPath": "/api/lens"], in: nil, contentWorld: .page) }
                catch { message = "Sync did not finish. Refresh the account page and try again." }
            }
            message = nil
        } catch { message = error.localizedDescription }
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(action.request.url?.scheme == "https" ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { message = "Account sync could not open. Check your connection and try again." }
    }
}

private final class WeakAccountHandler: NSObject, WKScriptMessageHandler {
    weak var target: AccountSyncModel?
    init(_ target: AccountSyncModel) { self.target = target }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) { target?.userContentController(userContentController, didReceive: message) }
}

private struct AccountPortal: UIViewRepresentable {
    @ObservedObject var model: AccountSyncModel
    let store: SiteStore
    func makeUIView(context: Context) -> WKWebView { model.store = store; return model.makeWebView() }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
