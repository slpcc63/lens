import SwiftUI
import WebKit

struct SiteSnapshot: Codable {
    var schemaVersion = 1
    let sites: [SavedSite]
}

struct AccountSyncScreen: View {
    @ObservedObject var store: SiteStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var model: AccountSyncModel
    private let recipe: SharedSiteRecipe?

    init(store: SiteStore, recipe: SharedSiteRecipe? = nil) {
        self.store = store
        self.recipe = recipe
        _model = StateObject(wrappedValue: AccountSyncModel(accountDataStore: nil, recipeMode: recipe != nil))
    }
    var body: some View {
        NavigationStack {
            Group {
                if model.configured {
                    VStack(spacing: 0) {
                        if let recipe {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Share how Lens reads Sniffies").font(.headline)
                                Text("Sign in to Doxle to count one contribution. Lens will send only the field names below and where it found them. Your profile samples and preferences stay on this device.").font(.footnote)
                                Text(recipe.summary).font(.footnote)
                                Button("Send site recipe") { model.shareRecipe(recipe) }
                                    .buttonStyle(.borderedProminent).disabled(model.sendingRecipe)
                            }.padding().frame(maxWidth: .infinity, alignment: .leading).background(.regularMaterial)
                        } else {
                            Text("Preview account sync · Separate test account settings")
                                .font(.footnote).padding(8).frame(maxWidth: .infinity).background(.regularMaterial)
                        }
                        AccountPortal(model: model, store: store)
                    }
                } else {
                    ContentUnavailableView("Account sync is not available yet", systemImage: "icloud", description: Text("Your sites remain on this device. The shared Doxle account connection must be enabled before you can sync them."))
                }
            }.safeAreaInset(edge: .bottom) {
                if let message = model.message { Text(message).font(.callout).padding().frame(maxWidth: .infinity).background(.regularMaterial) }
            }.navigationTitle(recipe == nil ? "Doxle account" : "Share site recipe").navigationBarTitleDisplayMode(.inline)
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
    @Published private(set) var sendingRecipe = false
    private(set) var pendingDownload: SiteSnapshot?
    private var pendingGeneration: UUID?
    private var uploadAccount: String?
    private var uploadRevision: Int?
    weak var store: SiteStore?
    private let endpoint: URL?
    private let accountDataStore: WKWebsiteDataStore
    private(set) var web: WKWebView?
    var configured: Bool { endpoint != nil }
    override convenience init() { self.init(accountDataStore: nil) }
    init(accountDataStore: WKWebsiteDataStore?, recipeMode: Bool = false) {
        self.accountDataStore = accountDataStore ?? WKWebsiteDataStore(forIdentifier: UUID(uuidString: "C7A7E916-15F5-41B0-98B3-AFF88FB9C916")!)
        // This internal beta uses only the exact tested preview deployment.
        if recipeMode, let recipeEndpoint = SharedSiteRecipe.endpoint {
            endpoint = recipeEndpoint.deletingLastPathComponent()
        } else if !recipeMode, let raw = Bundle.main.object(forInfoDictionaryKey: "LensAccountSyncURL") as? String,
           let url = URL(string: raw), url.scheme == "https", url.host == "hosted-saas-b3im5yh15-slpcc63-8889s-projects.vercel.app",
           url.path == "/api/lens", url.query == nil, url.fragment == nil, url.port == nil,
           url.user == nil, url.password == nil { endpoint = url } else { endpoint = nil }
        super.init()
    }
    func makeWebView() -> WKWebView {
        if let web { return web }
        let config = WKWebViewConfiguration()
        // Keep the first-party account session isolated from visited websites.
        config.websiteDataStore = accountDataStore
        config.defaultWebpagePreferences.preferredContentMode = .mobile
        // Adapt the existing shared sign-in page to the native sheet without
        // changing the shared website or running code on external origins.
        if let host = endpoint?.host {
            let mobileSignIn = """
            if (location.origin === 'https://\(host)' && ['/sign-in','/app/sign-in'].includes(location.pathname)) {
              let viewport = document.querySelector('meta[name="viewport"]');
              if (!viewport) { viewport = document.createElement('meta'); viewport.name = 'viewport'; document.head.appendChild(viewport); }
              viewport.content = 'width=device-width, initial-scale=1';
              const style = document.createElement('style');
              style.textContent = 'html,body{width:100%;min-width:0} .shell{width:100%;max-width:100%;padding-inline:16px;box-sizing:border-box} .auth-grid{display:block;min-width:0} .auth-card{min-width:0;max-width:100%;box-sizing:border-box} .auth-card h1{font-size:28px;overflow-wrap:anywhere} .auth-card p{overflow-wrap:anywhere} .auth-form input{width:100%;min-width:0;box-sizing:border-box} .auth-grid>aside{display:none}';
              document.head.appendChild(style);
            }
            """
            config.userContentController.addUserScript(WKUserScript(source: mobileSignIn, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
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
                do { _ = try await web.callAsyncJavaScript("if (location.origin !== expectedOrigin || location.pathname !== expectedPath) throw new Error('Account page changed'); await window.lensUploadDevice(snapshot, revision, account)", arguments: ["snapshot": object, "revision": revision, "account": account, "expectedOrigin": "https://" + (endpoint.host ?? ""), "expectedPath": endpoint.path], in: nil, contentWorld: .page) }
                catch { message = "Sync did not finish. Refresh the account page and try again." }
            }
            message = nil
        } catch { message = error.localizedDescription }
    }
    func shareRecipe(_ recipe: SharedSiteRecipe) {
        guard !sendingRecipe, recipe.valid, let web, let endpoint,
              let recipeEndpoint = SharedSiteRecipe.endpoint,
              recipeEndpoint.deletingLastPathComponent() == endpoint,
              web.url == endpoint else {
            message = "Sign in to Doxle, then tap Send site recipe."
            return
        }
        sendingRecipe = true
        message = nil
        Task {
            defer { sendingRecipe = false }
            do {
                let result = try await web.callAsyncJavaScript(
                    """
                    if (location.origin !== expectedOrigin || location.pathname !== expectedPath) return 401;
                    const response = await fetch('/api/lens/recipes', {
                      method:'POST', redirect:'error', cache:'no-store',
                      headers:{'Content-Type':'application/json'}, body:JSON.stringify(recipe)
                    });
                    return response.status;
                    """,
                    arguments: ["expectedOrigin": "https://" + (endpoint.host ?? ""), "expectedPath": endpoint.path,
                                "recipe": ["site": recipe.site, "version": recipe.version, "fields": recipe.fields]],
                    in: nil, contentWorld: .defaultClient)
                switch result as? Int {
                case 200: message = "Site recipe shared. Each verified Doxle account counts once."
                case 401, 403: message = "Sign in with a verified Doxle account, then try again."
                default: message = "Recipe sharing is unavailable. Your filters still work on this device."
                }
            } catch { message = "Recipe sharing is unavailable. Your filters still work on this device." }
        }
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
