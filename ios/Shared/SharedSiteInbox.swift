import Foundation

struct SharedSiteRequest: Codable {
    let name: String
    let address: String
}

enum SharedSiteInbox {
    static let group = "group.com.slpcc63.lens.browser"
    static var directory: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent("SharedSites", isDirectory: true)
    }
    static func save(name: String, url: URL) throws {
        guard url.scheme?.lowercased() == "https", url.host != nil, url.user == nil, url.password == nil,
              var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw NSError(domain: "LensShare", code: 1, userInfo: [NSLocalizedDescriptionKey: "Share a secure HTTPS website address without embedded credentials."])
        }
        parts.query = nil; parts.fragment = nil
        guard let clean = parts.url, let directory else {
            throw NSError(domain: "LensShare", code: 2, userInfo: [NSLocalizedDescriptionKey: "Lens could not access its shared storage. Open Lens and try again."])
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let request = SharedSiteRequest(name: String(name.prefix(200)), address: clean.absoluteString)
        try JSONEncoder().encode(request).write(to: directory.appendingPathComponent(UUID().uuidString + ".json"), options: [.atomic, .completeFileProtection])
    }
}
