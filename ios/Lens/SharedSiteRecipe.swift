import Foundation

struct SharedSiteRecipe: Codable, Equatable, Identifiable {
    let site: String
    let version: Int
    let fields: [String]
    var id: String { fields.joined(separator: ",") }

    static let supportedFields: [String: WizardLensField] = [
        "age": .age, "height": .height, "weight": .weight, "position": .position
    ]

    static func make(map: Set<String>, profiles: Set<String>) -> Self? {
        let fields = (map.map { "map:" + $0 } + profiles.map { "profile:" + $0 }).sorted()
        let recipe = Self(site: "sniffies", version: 1, fields: fields)
        return recipe.valid ? recipe : nil
    }

    var valid: Bool {
        site == "sniffies" && version == 1 && !fields.isEmpty &&
        Set(fields).count == fields.count && fields.allSatisfy { field in
            ["map:", "profile:"].contains { scope in
                field.hasPrefix(scope) && Self.supportedFields[String(field.dropFirst(scope.count))] != nil
            }
        }
    }

    var mapKeys: Set<String> {
        Set(fields.filter { $0.hasPrefix("map:") }.map { String($0.dropFirst(4)) })
    }

    var summary: String {
        fields.map { field in
            let pieces = field.split(separator: ":")
            guard pieces.count == 2, let meaning = Self.supportedFields[String(pieces[1])] else { return "" }
            return (pieces[0] == "map" ? "Map" : "Open profile") + ": " + meaning.label
        }.joined(separator: "\n")
    }

    static func supports(origin: String?) -> Bool {
        origin == "https://sniffies.com" || origin == "https://www.sniffies.com"
    }

    static var endpoint: URL? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "LensRecipePilotURL") as? String,
              let url = URL(string: raw), url.scheme == "https", url.path == "/api/lens/recipes",
              url.host?.hasPrefix("hosted-saas-") == true,
              url.host?.hasSuffix("-slpcc63-8889s-projects.vercel.app") == true,
              url.user == nil, url.password == nil, url.port == nil, url.query == nil, url.fragment == nil else { return nil }
        return url
    }

    static var accountEndpoint: URL? {
        guard let endpoint, var parts = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else { return nil }
        parts.path = "/api/lens"
        return parts.url
    }

    static func download() async -> Self? {
        guard let endpoint, var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false) else { return nil }
        components.queryItems = [URLQueryItem(name: "site", value: "sniffies")]
        guard let url = components.url else { return nil }
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.urlCredentialStorage = nil
        config.timeoutIntervalForRequest = 4
        let session = URLSession(configuration: config, delegate: RecipeReadDelegate(), delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }
        guard let (data, response) = try? await session.data(from: url),
              (response as? HTTPURLResponse)?.statusCode == 200, response.url == url,
              data.count <= 1024, let recipe = try? JSONDecoder().decode(Self.self, from: data),
              recipe.valid else { return nil }
        return recipe
    }
}

private final class RecipeReadDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                    completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
