import Foundation

@MainActor final class WizardStore {
    private let directory: URL

    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Lens/wizard/v1", isDirectory: true)
    }

    func load(siteID: UUID) throws -> WizardConfiguration {
        let file = file(for: siteID)
        guard FileManager.default.fileExists(atPath: file.path) else { return WizardConfiguration(siteID: siteID) }
        let decoded = try JSONDecoder().decode(WizardConfiguration.self, from: Data(contentsOf: file))
        guard decoded.schemaVersion == WizardConfiguration.schemaVersion, decoded.siteID == siteID else {
            throw AppIssue.message("This site's filter setup uses an unsupported format. Its file was not changed.")
        }
        return decoded
    }

    func save(_ configuration: WizardConfiguration) throws {
        guard configuration.schemaVersion == WizardConfiguration.schemaVersion,
              configuration.mappings.count <= 100, configuration.filters.count <= WizardLensField.allCases.count else {
            throw AppIssue.message("The filter setup is too large or invalid and was not saved.")
        }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var next = configuration
        next.updatedAt = Date()
        let data = try JSONEncoder().encode(next)
        try data.write(to: file(for: configuration.siteID), options: [.atomic, .completeFileProtection])
    }

    private func file(for siteID: UUID) -> URL { directory.appendingPathComponent(siteID.uuidString.lowercased() + ".json") }
}
