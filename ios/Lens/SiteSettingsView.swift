import SwiftUI

struct SiteSettingsView: View {
    let site: SavedSite
    @ObservedObject var store: SiteStore
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var address: String
    @State private var username: String
    @State private var error: String?
    @State private var confirmFilteringReset = false
    @State private var filteringReset = false
    private let resetFiltering: (() async throws -> Void)?
    init(site: SavedSite, store: SiteStore, resetFiltering: (() async throws -> Void)? = nil) {
        self.site = site; self.store = store
        self.resetFiltering = resetFiltering
        _name = State(initialValue: site.name)
        _address = State(initialValue: site.url.absoluteString)
        _username = State(initialValue: site.preferredUsername ?? "")
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Website") {
                    VStack(alignment: .leading) { Text("Website name"); TextField("Name", text: $name) }
                    VStack(alignment: .leading) { Text("Website address"); TextField("HTTPS address", text: $address).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled() }
                    Text("Changing this address keeps this site's settings and place in your list. Add a new site for a different service.").font(.footnote)
                }
                Section("Preferred account") {
                    VStack(alignment: .leading) { Text("Username or email (optional)"); TextField("Account name", text: $username).textInputAutocapitalization(.never).autocorrectionDisabled() }
                    Text("An account reminder for this site. Apple Passwords still handles password selection; Lens does not store or select a password here.").font(.footnote)
                }
                if let resetFiltering {
                    Section("Lens filters") {
                        if filteringReset {
                            Text("Filtering setup cleared.")
                        } else {
                            Button("Reset filtering setup", role: .destructive) { confirmFilteringReset = true }
                                .confirmationDialog("Reset filtering setup?", isPresented: $confirmFilteringReset) {
                                    Button("Reset filtering setup", role: .destructive) {
                                        Task {
                                            do { try await resetFiltering(); filteringReset = true }
                                            catch { self.error = error.localizedDescription }
                                        }
                                    }
                                } message: {
                                    Text("This clears the map scan, profile samples and filter preferences for this site. The saved site and website session stay.")
                                }
                        }
                    }
                }
                if let error { Text(error).foregroundStyle(.red) }
            }.navigationTitle("Site settings").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) { Button("Save") {
                        do { try store.update(id: site.id, name: name, address: address, preferredUsername: username); dismiss() }
                        catch { self.error = error.localizedDescription }
                    }.disabled(address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || name.count > 200 || username.count > 320) }
                }
        }.tint(Family.action)
    }
}
