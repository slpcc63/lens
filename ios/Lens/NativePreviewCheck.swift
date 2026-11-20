import Foundation
import WebKit

@MainActor enum NativePreviewCheck {
    static func run() async throws -> [String] {
        var checks: [String] = []
        func require(_ value: Bool, _ name: String) throws {
            guard value else { throw AppIssue.message("FAIL: " + name) }
            checks.append("PASS: " + name)
        }
        func wait(_ name: String, until ready: () async throws -> Bool) async throws {
            for _ in 0..<400 {
                if try await ready() { return }
                try await Task.sleep(for: .milliseconds(100))
            }
            throw AppIssue.message("Timed out: " + name)
        }
        let a = AccountSyncModel(accountDataStore: .nonPersistent())
        let b = AccountSyncModel(accountDataStore: .nonPersistent())
        try require(a.configured && b.configured, "Beta sync endpoint is configured")
        let wa = a.makeWebView(), wb = b.makeWebView()
        for web in [wa, wb] {
            try await wait("Preview sign-in page") { !web.isLoading && web.url?.path == "/sign-in" }
        }
        let email = "lens-native-" + UUID().uuidString.lowercased() + "@example.test"
        let password = UUID().uuidString + UUID().uuidString
        let signup = "const r = await fetch('/api/auth/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,name:'Synthetic native QA'})}); return r.status;"
        let signin = "const r = await fetch('/api/auth/sign-in/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}); return r.status;"
        let args: [String: Any] = ["email": email, "password": password]
        try require(try await wa.callAsyncJavaScript(signup, arguments: args, in: nil, contentWorld: .page) as? Int == 200, "First WebKit client creates a preview account")
        try require(try await wb.callAsyncJavaScript(signin, arguments: args, in: nil, contentWorld: .page) as? Int == 200, "Independent WebKit client signs in to the same account")
        let endpoint = URL(string: "https://hosted-saas-b3im5yh15-slpcc63-8889s-projects.vercel.app/api/lens")!
        for web in [wa, wb] {
            web.load(URLRequest(url: endpoint))
            try await wait("Account portal ready") {
                guard !web.isLoading, web.url?.path == endpoint.path else { return false }
                return (try? await web.evaluateJavaScript("document.getElementById('upload')?.disabled === false")) as? Bool == true
            }
        }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let sa = SiteStore(file: directory.appendingPathComponent("a.json"))
        let sb = SiteStore(file: directory.appendingPathComponent("b.json"))
        a.store = sa; b.store = sb
        try sa.add(name: "Native preview test", address: "https://example.org")
        let originalID = sa.sites[0].id
        _ = try await wa.evaluateJavaScript("document.getElementById('upload').click()")
        try await wait("Native upload confirmation") { a.confirmUpload }
        a.upload(from: sa)
        try await wait("First native upload") { (try? await wa.evaluateJavaScript("document.getElementById('status').textContent.includes('Device settings saved')")) as? Bool == true }
        _ = try await wb.evaluateJavaScript("document.getElementById('refresh').click()")
        try await wait("Other client account copy") { (try? await wb.evaluateJavaScript("document.getElementById('count').textContent.startsWith('1 ')")) as? Bool == true }
        _ = try await wb.evaluateJavaScript("document.getElementById('download').click()")
        try await wait("Native download confirmation") { b.confirmDownload }
        b.applyDownload(to: sb)
        try require(sb.sites == sa.sites && sb.sites[0].id == originalID, "Native bridge transfers settings between independent clients")
        try sb.update(id: originalID, name: "Edited by second client", address: "https://example.com/alias", preferredUsername: "synthetic-reminder")
        _ = try await wb.evaluateJavaScript("document.getElementById('upload').click()")
        try await wait("Second native upload confirmation") { b.confirmUpload }
        b.upload(from: sb)
        try await wait("Second native upload") { (try? await wb.evaluateJavaScript("document.getElementById('status').textContent.includes('Device settings saved')")) as? Bool == true }
        _ = try await wa.evaluateJavaScript("document.getElementById('refresh').click()")
        try await wait("Updated account copy") { (try? await wa.evaluateJavaScript("current?.snapshot.sites[0]?.name === 'Edited by second client'")) as? Bool == true }
        _ = try await wa.evaluateJavaScript("document.getElementById('download').click()")
        try await wait("Return download confirmation") { a.confirmDownload }
        a.applyDownload(to: sa)
        try require(sa.sites == sb.sites && sa.sites[0].id == originalID, "Reverse native transfer preserves edits and stable identity")
        try require(try FileManager.default.contentsOfDirectory(atPath: directory.path).filter { $0.hasPrefix("sites-before-sync-") }.count == 2, "Both native downloads preserve a local backup")
        for web in [wa, wb] {
            let status = try await web.callAsyncJavaScript("const r = await fetch('/api/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}); return r.status;", arguments: [:], in: nil, contentWorld: .page)
            try require(status as? Int == 200, "Synthetic WebKit session signs out")
        }
        return checks
    }
}
