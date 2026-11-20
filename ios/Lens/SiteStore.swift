import Foundation
import Combine

struct SavedSite: Codable, Identifiable, Hashable {
    var id = UUID()
    var name: String
    var url: URL
    var preferredUsername: String? = nil
}

enum SiteAddress {
    static func parse(_ text: String) throws -> URL {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let candidate = trimmed.contains("://") ? trimmed : "https://" + trimmed
        guard var parts = URLComponents(string: candidate),
              parts.scheme?.lowercased() == "https", let host = parts.host,
              !host.isEmpty, !host.contains(" "), parts.user == nil, parts.password == nil,
              parts.port == nil || (1...65535).contains(parts.port!) else {
            throw AppIssue.message("Enter an HTTPS website address without a username or password.")
        }
        parts.scheme = "https"; parts.host = host.lowercased()
        parts.query = nil; parts.fragment = nil
        guard let url = parts.url else { throw AppIssue.message("This website address is not valid.") }
        return url
    }
    static func origin(_ url: URL) -> String? {
        guard url.scheme?.lowercased() == "https", let host = url.host?.lowercased(), url.user == nil, url.password == nil else { return nil }
        return "https://" + host + ((url.port == nil || url.port == 443) ? "" : ":\(url.port!)")
    }
}

enum AppIssue: LocalizedError {
    case message(String)
    var errorDescription: String? { if case let .message(text) = self { return text }; return nil }
}

@MainActor final class SiteStore: ObservableObject {
    @Published private(set) var sites: [SavedSite] = []
    @Published private(set) var generation = UUID()
    @Published var error: String?
    private let file: URL
    private var readable = true
    init(file: URL? = nil) {
        self.file = file ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Lens/sites.json")
        do {
            if FileManager.default.fileExists(atPath: self.file.path) {
                sites = try JSONDecoder().decode([SavedSite].self, from: Data(contentsOf: self.file))
            }
        } catch { readable = false; self.error = "Saved websites could not be read. Your file has not been overwritten." }
    }
    func add(name: String, address: String) throws {
        let url = try SiteAddress.parse(address)
        guard !sites.contains(where: { $0.url == url }) else { throw AppIssue.message("This website is already saved.") }
        let label = name.trimmingCharacters(in: .whitespacesAndNewlines)
        try persist(sites + [SavedSite(name: label.isEmpty ? (url.host ?? "Website") : label, url: url)])
    }
    func update(id: UUID, name: String, address: String, preferredUsername: String) throws {
        let url = try SiteAddress.parse(address)
        guard let index = sites.firstIndex(where: { $0.id == id }) else { throw AppIssue.message("This site is no longer saved.") }
        guard !sites.contains(where: { $0.id != id && $0.url == url }) else { throw AppIssue.message("Another saved site already uses this address.") }
        var next = sites
        let label = name.trimmingCharacters(in: .whitespacesAndNewlines)
        next[index].name = label.isEmpty ? (url.host ?? "Website") : label
        next[index].url = url
        let user = preferredUsername.trimmingCharacters(in: .whitespacesAndNewlines)
        next[index].preferredUsername = user.isEmpty ? nil : user
        try persist(next)
    }
    func remove(_ site: SavedSite) throws { try persist(sites.filter { $0.id != site.id }) }
    func replace(with next: [SavedSite]) throws {
        guard next.count <= 500, Set(next.map(\.id)).count == next.count,
              Set(next.map(\.url)).count == next.count else { throw AppIssue.message("The synced site list is invalid.") }
        for site in next {
            guard try SiteAddress.parse(site.url.absoluteString) == site.url, site.name.count <= 200,
                  (site.preferredUsername?.count ?? 0) <= 320 else { throw AppIssue.message("A synced site contains invalid settings.") }
        }
        try persist(next)
    }
    func replaceWithBackup(with next: [SavedSite]) throws {
        // Keep the pre-sync copy before attempting to change the live list.
        let backup = file.deletingLastPathComponent().appendingPathComponent("sites-before-sync-" + UUID().uuidString + ".json")
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(sites).write(to: backup, options: [.atomic, .completeFileProtection])
        try replace(with: next)
    }
    private func persist(_ next: [SavedSite]) throws {
        guard readable else { throw AppIssue.message("Resolve the saved website file error before changing the list.") }
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(next).write(to: file, options: [.atomic, .completeFileProtection])
        sites = next; generation = UUID()
    }
    func importSharedSites(from inbox: URL? = SharedSiteInbox.directory) {
        guard let inbox else { return }
        do {
            // No share has been made yet on a fresh install. This is an empty
            // inbox, not a failed request; initialize it before listing files.
            try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
            let files = try FileManager.default.contentsOfDirectory(at: inbox, includingPropertiesForKeys: nil).filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
            for file in files {
                let item = try JSONDecoder().decode(SharedSiteRequest.self, from: Data(contentsOf: file))
                let url = try SiteAddress.parse(item.address)
                if !sites.contains(where: { $0.url == url }) { try add(name: item.name, address: url.absoluteString) }
                try FileManager.default.removeItem(at: file)
            }
        } catch { self.error = "A shared website could not be added. It is kept for another attempt. " + error.localizedDescription }
    }
}
