import SwiftUI
import WebKit

@main struct LensApp: App {
    var body: some Scene {
        WindowGroup {
            if ProcessInfo.processInfo.arguments.contains("--self-test") { SmokeTestView() }
            else { HomeView() }
        }
    }
}

enum Family {
    static let action = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.72, green: 0.78, blue: 1, alpha: 1)
        : UIColor(red: 0.21, green: 0.29, blue: 0.78, alpha: 1) })
    static let onAction = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.067, green: 0.102, blue: 0.212, alpha: 1) : .white })
    static let siteReturn = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.77, green: 0.68, blue: 1, alpha: 1)
        : UIColor(red: 0.38, green: 0.20, blue: 0.71, alpha: 1) })
    static let canvas = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.043, green: 0.063, blue: 0.137, alpha: 1)
        : UIColor(red: 0.969, green: 0.973, blue: 0.988, alpha: 1) })
}

struct HomeView: View {
    @StateObject private var store = SiteStore()
    @State private var adding = false
    @State private var removing: SavedSite?
    @State private var editing: SavedSite?
    @State private var account = false
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    HStack(spacing: 16) {
                        Image("LensMark").resizable().scaledToFit().frame(width: 56, height: 56).accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Your sites, together").font(.title2.bold())
                            Text("Save a website, open it, and sign in.").foregroundStyle(.secondary)
                        }
                    }.padding(.top)
                    if let error = store.error { Text(error).foregroundStyle(.red).accessibilityIdentifier("storeError") }
                    if store.sites.isEmpty {
                        ContentUnavailableView { Label { Text("Start with a website") } icon: { Image("globe").resizable().scaledToFit().frame(width: 56, height: 56) } } description: { Text("Add the websites you want to keep close.") }
                    } else {
                        ForEach(store.sites) { site in
                            NavigationLink { BrowserScreen(initialSite: site, store: store) } label: {
                                HStack {
                                    FamilyIcon(name: "globe").frame(width: 40)
                                    VStack(alignment: .leading) {
                                        Text(site.name).font(.headline).foregroundStyle(.primary)
                                        Text(site.url.host ?? "").font(.subheadline).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right").accessibilityHidden(true)
                                }.padding(20).frame(maxWidth: .infinity, minHeight: 72)
                                    .background(.background, in: RoundedRectangle(cornerRadius: 16))
                            }.buttonStyle(.plain).contextMenu {
                                Button("Edit site") { editing = site }
                                Button("Remove saved site", role: .destructive) { removing = site }
                            }
                        }
                    }
                    Button { adding = true } label: { HStack { FamilyIcon(name: "add"); Text("Add website") }.frame(maxWidth: .infinity, minHeight: 44) }
                        .buttonStyle(.borderedProminent).foregroundStyle(Family.onAction).accessibilityIdentifier("addWebsite")
                    Text("Sign in directly on each website. Websites retain their own sessions.")
                        .font(.footnote).foregroundStyle(.secondary)
                }.padding(20)
            }.background(Family.canvas).navigationTitle("Lens")
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { account = true } label: { Label("Doxle account", systemImage: "person.crop.circle") } } }
                .sheet(isPresented: $adding) { AddSiteView(store: store) }
                .sheet(item: $editing) { SiteSettingsView(site: $0, store: store) }
                .sheet(isPresented: $account) { AccountSyncScreen(store: store) }
                .task { store.importSharedSites() }
                .onChange(of: scenePhase) { _, phase in if phase == .active { store.importSharedSites() } }
                .confirmationDialog("Remove this shortcut? Website sessions will remain.", isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } })) {
                    Button("Remove saved site", role: .destructive) {
                        if let site = removing { do { try store.remove(site) } catch { store.error = error.localizedDescription } }
                        removing = nil
                    }
                }
        }.tint(Family.action)
    }
}

struct AddSiteView: View {
    @ObservedObject var store: SiteStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var address = ""
    @State private var error: String?
    var body: some View {
        NavigationStack {
            Form {
                Section("Website") {
                    VStack(alignment: .leading) { Text("Website name (optional)").font(.subheadline); TextField("Name", text: $name).accessibilityIdentifier("siteName") }
                    VStack(alignment: .leading) { Text("Website address").font(.subheadline); TextField("https://example.com", text: $address).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("siteAddress") }
                }
                Section { Text("Use an HTTPS address. Sign-in tokens and fragments are removed from saved links. Sign in directly on the website.") }
                if let error { Text(error).foregroundStyle(.red) }
            }.navigationTitle("Add website").toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") {
                    do { try store.add(name: name, address: address); dismiss() } catch { self.error = error.localizedDescription }
                }.disabled(address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }
            }
        }
    }
}

struct BrowserScreen: View {
    let initialSite: SavedSite
    @ObservedObject var store: SiteStore
    @Environment(\.dismiss) private var dismiss
    @State private var settings = false
    private var site: SavedSite { store.sites.first { $0.id == initialSite.id } ?? initialSite }
    @StateObject private var browser: BrowserModel
    @State private var editingAddress = false
    @State private var destination = ""
    init(initialSite: SavedSite, store: SiteStore) { self.initialSite = initialSite; self.store = store; _browser = StateObject(wrappedValue: BrowserModel(url: initialSite.url)) }
    var body: some View {
        VStack(spacing: 0) {
            Button { destination = browser.address; editingAddress = true } label: {
                HStack { FamilyIcon(name: "lock"); Text(browser.origin ?? "Opening website…").lineLimit(1); Spacer(); FamilyIcon(name: "edit") }.padding(12).frame(minHeight: 44)
            }.accessibilityLabel("Website address: \(browser.origin ?? "loading")")
            if browser.loading { ProgressView().frame(maxWidth: .infinity).padding(4) }
            if let error = browser.error {
                VStack { Text(error).font(.callout); Button("Dismiss error") { browser.error = nil } }.padding().background(.regularMaterial)
            }
            if let notice = browser.notice {
                VStack { Text(notice).font(.callout); Button("Dismiss message") { browser.notice = nil } }.padding()
            }
            WebPage(browser: browser)
        }.navigationTitle(site.name).navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .onChange(of: site.url) { _, url in browser.navigate(url.absoluteString) }
            .sheet(isPresented: $settings) { SiteSettingsView(site: site, store: store) }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { dismiss() } label: { HStack { Image(systemName: "square.grid.2x2"); Text("Sites") } }.tint(Family.siteReturn).accessibilityLabel("Return to saved sites")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { settings = true } label: { Label("Site settings", systemImage: "gearshape") }
                }
                ToolbarItemGroup(placement: .bottomBar) {
                    Button { browser.webView.goBack() } label: { FamilyIcon(name: "back").frame(minWidth: 44, minHeight: 44) }.disabled(!browser.canGoBack).accessibilityLabel("Back in website")
                    Button { browser.webView.goForward() } label: { FamilyIcon(name: "forward").frame(minWidth: 44, minHeight: 44) }.disabled(!browser.canGoForward).accessibilityLabel("Forward in website")
                    Spacer()
                    Button { browser.error = nil; browser.webView.reload() } label: { FamilyIcon(name: "refresh").frame(minWidth: 44, minHeight: 44) }.accessibilityLabel("Reload website")
                }
            }
            .alert("Go to website", isPresented: $editingAddress) {
                TextField("HTTPS website address", text: $destination).textInputAutocapitalization(.never)
                Button("Go") { browser.navigate(destination) }
                Button("Cancel", role: .cancel) {}
            }
    }
}

struct WebPage: UIViewRepresentable {
    @ObservedObject var browser: BrowserModel
    func makeUIView(context: Context) -> WKWebView { browser.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}

struct FamilyIcon: View {
    let name: String
    var body: some View { Image(name).resizable().scaledToFit().frame(width: 28, height: 28).accessibilityHidden(true) }
}
