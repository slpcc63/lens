import SwiftUI
import WebKit

struct SmokeTestView: View {
    @State private var result = "Running Lens checks…"
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
            let fixtureOne = """
            <main><h1>Fixture Grid</h1><section>
              <article><h2>Alex</h2><dl><dt>Age</dt><dd>34</dd><dt>Position</dt><dd>Vers Top 🍆</dd></dl></article>
              <article><h2>Blair</h2><dl><dt>Age</dt><dd>42</dd><dt>Position</dt><dd>Bottom 🍑</dd></dl></article>
            </section></main>
            """
            let fixtureTwo = """
            <main><h1>Fixture List</h1><div class='listing'>
              <div class='person-tile'><h3>Casey</h3><p data-label='Build' data-value='Athletic'>Athletic</p><p><span>Last seen</span><span>Online</span></p></div>
              <div class='person-tile'><h3>Drew</h3><p data-label='Build' data-value='Slim'>Slim</p><p><span>Last seen</span><span>12 minutes</span></p></div>
            </div></main>
            """
            let (firstScan, previewWeb) = try await scanFixture(fixtureOne)
            let (secondScan, _) = try await scanFixture(fixtureTwo)
            try require(firstScan.profiles.count == 2 && secondScan.profiles.count == 2, "Generic scanner reads two differently structured visible listings")
            try require(firstScan.proposedMappings.contains { $0.lensField == .age } && firstScan.proposedMappings.contains { $0.lensField == .position }, "Scanner suggests age and emoji position mappings from visible evidence")
            try require(secondScan.proposedMappings.contains { $0.lensField == .bodyType } && secondScan.proposedMappings.contains { $0.lensField == .activity }, "Scanner suggests fields without a site-specific adapter")
            let markerGrid = """
            <main><h1>Map</h1><div class='map-layer'>
              <a class='map-marker' style='display:inline-block;width:32px;height:32px' data-profile-id='alpha123' href='/profile/alpha123?token=fixture' aria-label='Profile marker, 34, 6&#39;2&quot;, muscular, top'></a>
              <a class='map-marker' style='display:inline-block;width:32px;height:32px' data-profile-id='bravo456' href='https://other.example/profile/bravo456' aria-label='Profile marker, 42, 210 lb, bottom'></a>
            </div></main>
            """
            let detailProfile = """
            <main class='open-profile'><h1>Profile</h1><p>32, 6'3", 220 lb, 8.5" uncut, muscular, dom top</p>
              <ul><li><span>Looking for</span><span>Dates</span></li><li><span>Status</span><span>Online</span></li></ul>
            </main>
            """
            let (gridScan, gridWeb) = try await scanFixture(markerGrid, baseURL: URL(string: "https://fixture.example/map")!)
            let (detailScan, _) = try await scanFixture(detailProfile, baseURL: URL(string: "https://fixture.example/profile/alpha123")!)
            try require(gridScan.kind == .collection && gridScan.visibleReferenceCount == 2 && gridScan.proposedMappings.isEmpty, "Map scan reports references without treating rich marker labels as profile fields")
            try require(gridScan.mapObservations?.first?.fields.contains { $0.key == "position" } == true, "Readable map fields are reported separately from collected profile fields")
            try require(gridScan.profileLinks?.map(\.absoluteString) == ["https://fixture.example/profile/alpha123"], "Automatic profile navigation uses explicit same-site profile links without query data")
            try require(detailScan.kind == .detail && detailScan.profiles.count == 1 && detailScan.profiles[0].id == "profile-alpha123", "Open profile is collected once instead of treating its repeated rows as profiles")
            try require([WizardLensField.age, .height, .weight, .endowment, .bodyType, .position].allSatisfy { field in detailScan.proposedMappings.contains { $0.lensField == field } }, "Open profile derives the expected filter-field proposals")
            let wizardDirectory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            defer { try? FileManager.default.removeItem(at: wizardDirectory) }
            let wizardStore = WizardStore(directory: wizardDirectory), wizardSiteID = UUID()
            var wizardConfiguration = WizardConfiguration(siteID: wizardSiteID, mappings: firstScan.proposedMappings, collectedProfiles: detailScan.profiles)
            let height = WizardProfileSample.Field(key: "height", label: "Height", value: "5'2″", source: "Height")
            let mismatch = WizardProfileSample.Field(key: "height", label: "Height", value: "🍑", source: "Height")
            let positionMismatch = WizardProfileSample.Field(key: "position", label: "Position", value: "47", source: "Position")
            try require(GuidedFilterSetup.usableField(height) == .height && GuidedFilterSetup.usableField(mismatch) == nil && GuidedFilterSetup.usableField(positionMismatch) == nil, "Only mismatched values require a field check")
            let cm = GuidedPreferencesView.convert(WizardFilter(field: .height, minimum: 62, unit: "ft / in"), to: "cm")
            try require(abs((cm.minimum ?? 0) - 157.48) < 0.001, "Changing display units preserves the actual preference")
            wizardConfiguration.mappings[0].state = .confirmed
            wizardConfiguration.previewMode = .dim
            try wizardStore.save(wizardConfiguration)
            let reopenedWizard = try wizardStore.load(siteID: wizardSiteID)
            try require(reopenedWizard.siteID == wizardSiteID && reopenedWizard.mappings[0].state == .confirmed && reopenedWizard.previewMode == .dim && reopenedWizard.collectedProfiles == detailScan.profiles, "Per-site wizard mappings, collected samples, and preview choice save and reopen separately")
            _ = try await gridWeb.callAsyncJavaScript(BrowserModel.wizardPreviewScript,
                arguments: ["mode": "dim", "reasons": ["profile-alpha123": "Age is outside the selected range."]], in: nil, contentWorld: .page)
            let markerDimmed = try await gridWeb.evaluateJavaScript("document.querySelector('[data-profile-id=alpha123]').hasAttribute('data-lens-would-block')")
            try require(markerDimmed as? Bool == true, "Collected profile identity links preview decisions back to matching grid markers")
            _ = try await previewWeb.callAsyncJavaScript(BrowserModel.wizardPreviewScript,
                arguments: ["mode": "dim", "reasons": ["scan-1": "Age is outside the selected range."]], in: nil, contentWorld: .page)
            let dimmed = try await previewWeb.evaluateJavaScript("document.querySelector('[data-lens-profile-id=scan-1]').hasAttribute('data-lens-would-block')")
            try require(dimmed as? Bool == true, "Preview dims only evaluated blocked profiles")
            _ = try await previewWeb.callAsyncJavaScript(BrowserModel.wizardPreviewScript,
                arguments: ["mode": "showAll", "reasons": ["scan-1": "Age is outside the selected range."]], in: nil, contentWorld: .page)
            let restoredPreview = try await previewWeb.evaluateJavaScript("!document.querySelector('[data-lens-profile-id=scan-1]').hasAttribute('data-lens-would-block') && !document.querySelector('[data-lens-profile-id=scan-1]').hasAttribute('data-lens-original-title')")
            try require(restoredPreview as? Bool == true, "Show all reverses preview attributes and explanations")
            if ProcessInfo.processInfo.arguments.contains("--sync-preview-test") { checks += try await NativePreviewCheck.run() }
            result = checks.joined(separator: "\n") + "\n\nAll local checks passed. Synthetic listing checks are not actual-site or owner acceptance."
        } catch { result = checks.joined(separator: "\n") + "\n" + error.localizedDescription }
        let file = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("stage-one-smoke.txt")
        try? result.write(to: file, atomically: true, encoding: .utf8)
    }

    @MainActor private func scanFixture(_ html: String, baseURL: URL = URL(string: "https://fixture.example")!) async throws -> (WizardScanResult, WKWebView) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        let web = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 700), configuration: configuration)
        let navigation = ReadyNavigation()
        web.navigationDelegate = navigation
        web.loadHTMLString(html, baseURL: baseURL)
        for _ in 0..<100 {
            if navigation.finished { break }
            try await Task.sleep(for: .milliseconds(50))
        }
        guard navigation.finished else { throw AppIssue.message("Synthetic wizard fixture did not load.") }
        let value = try await web.callAsyncJavaScript(BrowserModel.wizardScanScript,
            arguments: ["expectedOrigin": "https://fixture.example"], in: nil, contentWorld: .page)
        guard let json = value as? String else { throw AppIssue.message("Synthetic wizard fixture did not return JSON.") }
        return (try WizardDetector.decode(json), web)
    }
}

@MainActor final class ReadyNavigation: NSObject, WKNavigationDelegate {
    var finished = false
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { finished = true }
}
