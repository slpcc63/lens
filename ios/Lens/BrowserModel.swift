import WebKit
import Combine
import LocalAuthentication

@MainActor final class BrowserModel: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    let webView: WKWebView
    @Published var address = ""
    @Published var loading = false
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var error: String?
    @Published var notice: String?
    private var observations: [NSKeyValueObservation] = []

    init(url: URL) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        observations = [
            webView.observe(\.url, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.refresh() } },
            webView.observe(\.isLoading, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.refresh() } },
            webView.observe(\.canGoBack, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.refresh() } },
            webView.observe(\.canGoForward, options: [.new]) { [weak self] _, _ in Task { @MainActor in self?.refresh() } }
        ]
        webView.load(URLRequest(url: url))
    }

    var origin: String? { webView.url.flatMap(SiteAddress.origin) }

    private func refresh() {
        address = webView.url?.absoluteString ?? ""
        loading = webView.isLoading
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
    }

    func navigate(_ text: String) {
        do { error = nil; webView.load(URLRequest(url: try SiteAddress.parse(text))) }
        catch { self.error = error.localizedDescription }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        let scheme = url.scheme?.lowercased()
        if scheme == "https" || (scheme == "about" && action.targetFrame?.isMainFrame == false) {
            decisionHandler(.allow)
        } else {
            if action.targetFrame?.isMainFrame != false { error = "This destination cannot open in Lens. Only secure HTTPS pages are supported." }
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if action.targetFrame == nil, let url = action.request.url, SiteAddress.origin(url) != nil {
            webView.load(action.request)
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { error = "The page stopped responding. Tap Reload to try again." }
    private func failed(_ error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { self.error = "The page could not open. Check your connection or try another site. " + error.localizedDescription }
    }

    func fillLogin(for expectedOrigin: String) async {
        do {
            guard origin == expectedOrigin else { throw AppIssue.message("The website changed. Open login controls again for the current page.") }
            let context = LAContext()
            guard try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Fill the login saved for \(expectedOrigin)") else { return }
            guard origin == expectedOrigin, let login = try LoginVault.read(origin: expectedOrigin) else {
                throw AppIssue.message("No saved login was found for this exact website address.")
            }
            let result = try await webView.callAsyncJavaScript(Self.fillScript,
                arguments: ["expectedOrigin": expectedOrigin, "username": login.username, "password": login.password],
                in: nil, contentWorld: .page)
            guard (result as? Bool) == true else {
                throw AppIssue.message("Lens could not safely identify one visible login form. Sign in directly on the website instead.")
            }
            notice = "Login filled. Check the website address, then submit using the site's own button."
        } catch { self.error = error.localizedDescription }
    }

    // Explicit action only. No form capture, background credential injection, or auto-submit.
    static let fillScript = """
    if (window.top !== window || location.origin !== expectedOrigin || location.protocol !== 'https:') return false;
    const visible = e => !e.disabled && !e.readOnly && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
    const passwords = [...document.querySelectorAll('input[type="password"]')].filter(visible);
    if (passwords.length !== 1) return false;
    const p = passwords[0], form = p.form;
    if (!form || (p.autocomplete || '').includes('new-password')) return false;
    if (new URL(form.action || location.href, location.href).origin !== expectedOrigin) return false;
    const users = [...form.querySelectorAll('input')].filter(e => visible(e) && (e.autocomplete === 'username' || e.type === 'email' || (e.type === 'text' && /user|email|login/i.test(e.name + ' ' + e.id))));
    if (users.length !== 1) return false;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const [e, value] of [[users[0], username], [p, password]]) {
      set.call(e, value); e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true}));
    }
    return true;
    """
}
