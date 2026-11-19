import Foundation
import Combine

struct SavedSite: Codable, Identifiable, Hashable {
    var id = UUID()
    var name: String
    var url: URL
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
        parts.scheme = "https"
        parts.host = host.lowercased()
        // Saved starting links must not retain sign-in tokens or URL fragments.
        parts.query = nil
        parts.fragment = nil
        guard let url = parts.url else { throw AppIssue.message("This website address is not valid.") }
        return url
    }

    static func origin(_ url: URL) -> String? {
        guard url.scheme?.lowercased() == "https", let host = url.host?.lowercased(),
              url.user == nil, url.password == nil else { return nil }
        return "https://" + host + ((url.port == nil || url.port == 443) ? "" : ":\(url.port!)")
    }
}

enum AppIssue: LocalizedError {
    case message(String)
    var errorDescription: String? { if case let .message(text) = self { return text }; return nil }
}

@MainActor final class SiteStore: ObservableObject {
    @Published private(set) var sites: [SavedSite] = []
    @Published var error: String?
    private let file: URL

    init(file: URL? = nil) {
        self.file = file ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Lens/sites.json")
        do {
            if FileManager.default.fileExists(atPath: self.file.path) {
                sites = try JSONDecoder().decode([SavedSite].self, from: Data(contentsOf: self.file))
            }
        } catch { self.error = "Saved websites could not be read. Your file has not been overwritten." }
    }

    func add(name: String, address: String) throws {
        guard error == nil else { throw AppIssue.message("Resolve the saved website file error before changing the list.") }
        let url = try SiteAddress.parse(address)
        guard !sites.contains(where: { $0.url == url }) else { throw AppIssue.message("This website is already saved.") }
        let label = name.trimmingCharacters(in: .whitespacesAndNewlines)
        var next = sites
        next.append(SavedSite(name: label.isEmpty ? (url.host ?? "Website") : label, url: url))
        try persist(next)
    }

    func remove(_ site: SavedSite) throws { try persist(sites.filter { $0.id != site.id }) }

    private func persist(_ next: [SavedSite]) throws {
        try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(next).write(to: file, options: [.atomic, .completeFileProtection])
        sites = next
    }
}
