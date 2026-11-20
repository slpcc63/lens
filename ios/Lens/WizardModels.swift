import Foundation

enum WizardLensField: String, Codable, CaseIterable, Identifiable {
    case age, height, weight, endowment, bodyType, position, activity, comfort

    var id: String { rawValue }
    var label: String {
        switch self {
        case .age: "Age"
        case .height: "Height"
        case .weight: "Weight"
        case .endowment: "Endowment"
        case .bodyType: "Body type"
        case .position: "Position"
        case .activity: "Activity / last seen"
        case .comfort: "Comfort / substances"
        }
    }
    var isNumeric: Bool { [.age, .height, .weight, .endowment].contains(self) }
    var defaultUnit: String {
        switch self {
        case .age: "years"
        case .height, .endowment: "cm"
        case .weight: "kg"
        default: "value"
        }
    }
    var units: [String] {
        switch self {
        case .age: ["years"]
        case .height: ["cm", "ft / in"]
        case .weight: ["kg", "lb"]
        case .endowment: ["cm", "in"]
        default: ["value"]
        }
    }

    static func suggestion(label: String, values: [String]) -> WizardLensField? {
        let text = ([label] + values).joined(separator: " ").lowercased()
        if text.range(of: #"\b(age|years? old|yo)\b"#, options: .regularExpression) != nil { return .age }
        if text.range(of: #"\b(height|tall|cm|feet|foot|ft)\b"#, options: .regularExpression) != nil { return .height }
        if text.range(of: #"\b(weight|kg|lbs?|pounds?)\b"#, options: .regularExpression) != nil { return .weight }
        if text.range(of: #"\b(endowment|size|length)\b"#, options: .regularExpression) != nil { return .endowment }
        if text.range(of: #"\b(body|build|physique|athletic|slim|muscular|average|stocky|large)\b"#, options: .regularExpression) != nil { return .bodyType }
        if text.contains("🍆") || text.contains("🍑") || text.range(of: #"\b(position|role|top|bottom|vers|side)\b"#, options: .regularExpression) != nil { return .position }
        if text.range(of: #"\b(activity|online|last seen|active)\b"#, options: .regularExpression) != nil { return .activity }
        if text.range(of: #"\b(alcohol|cannabis|tobacco|poppers|pnp|drugs?|substances?|comfort)\b"#, options: .regularExpression) != nil { return .comfort }
        return nil
    }
}

enum WizardFieldState: String, Codable, CaseIterable { case proposed, confirmed, disabled }
enum WizardMissingPolicy: String, Codable, CaseIterable, Identifiable {
    case show, block
    var id: String { rawValue }
    var label: String { self == .show ? "Show when unknown" : "Treat unknown as blocked" }
}
enum WizardPreviewMode: String, Codable, CaseIterable { case showAll, dim, hide }

struct WizardOptionMapping: Codable, Hashable, Identifiable {
    var id: String { rawValue }
    var rawValue: String
    var lensValue: String
    var evidenceCount: Int
}

struct WizardFieldMapping: Codable, Hashable, Identifiable {
    var id: String { sourceKey }
    var sourceKey: String
    var sourceLabel: String
    var evidence: [String]
    var state: WizardFieldState
    var lensField: WizardLensField?
    var suggestedField: WizardLensField?
    var options: [WizardOptionMapping]
}

struct WizardFilter: Codable, Hashable, Identifiable {
    var id: String { field.rawValue }
    var field: WizardLensField
    var allowedValues: [String] = []
    var minimum: Double?
    var maximum: Double?
    var unit: String
    var missingPolicy: WizardMissingPolicy = .show
}

struct WizardConfiguration: Codable, Equatable {
    static let schemaVersion = 1
    var schemaVersion = Self.schemaVersion
    var siteID: UUID
    var mappings: [WizardFieldMapping] = []
    var filters: [WizardFilter] = []
    var previewMode: WizardPreviewMode = .showAll
    var lastScanDescription: String?
    var updatedAt = Date()
}

struct WizardProfileSample: Codable, Hashable, Identifiable {
    struct Field: Codable, Hashable {
        var key: String
        var label: String
        var value: String
        var source: String
    }
    var id: String
    var title: String
    var fields: [Field]
}

struct WizardScanResult: Codable, Equatable {
    var origin: String
    var pageTitle: String
    var sampleDescription: String
    var profiles: [WizardProfileSample]
    var proposedMappings: [WizardFieldMapping]
    var limitations: [String]
}

enum WizardOutcome: String { case match, blocked, unknown }
struct WizardEvaluation: Identifiable {
    var id: String { profile.id }
    var profile: WizardProfileSample
    var outcome: WizardOutcome
    var reasons: [String]
}

enum WizardDetector {
    private struct Payload: Decodable {
        var origin: String
        var pageTitle: String
        var sampleDescription: String
        var profiles: [WizardProfileSample]
        var limitations: [String]
    }

    static func decode(_ json: String) throws -> WizardScanResult {
        let payload = try JSONDecoder().decode(Payload.self, from: Data(json.utf8))
        var collected: [String: (label: String, evidence: [String], values: [String: Int])] = [:]
        for profile in payload.profiles {
            for field in profile.fields {
                var item = collected[field.key] ?? (field.label, [], [:])
                if item.evidence.count < 3 { item.evidence.append(field.source + ": " + field.value) }
                item.values[field.value, default: 0] += 1
                collected[field.key] = item
            }
        }
        let mappings = collected.keys.sorted().map { key -> WizardFieldMapping in
            let item = collected[key]!
            let values = item.values.keys.sorted()
            let suggestion = WizardLensField.suggestion(label: item.label, values: values)
            return WizardFieldMapping(
                sourceKey: key,
                sourceLabel: item.label,
                evidence: item.evidence,
                state: .proposed,
                lensField: suggestion,
                suggestedField: suggestion,
                options: values.map { WizardOptionMapping(rawValue: $0, lensValue: canonicalOption($0, for: suggestion), evidenceCount: item.values[$0] ?? 0) }
            )
        }
        return WizardScanResult(origin: payload.origin, pageTitle: payload.pageTitle,
                                sampleDescription: payload.sampleDescription, profiles: payload.profiles,
                                proposedMappings: mappings, limitations: payload.limitations)
    }

    static func canonicalOption(_ raw: String, for field: WizardLensField?) -> String {
        let normalized = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard field == .position else { return raw.trimmingCharacters(in: .whitespacesAndNewlines) }
        if normalized.contains("🍆") || normalized.range(of: #"\btop\b"#, options: .regularExpression) != nil { return normalized.contains("vers") ? "vers top" : "top" }
        if normalized.contains("🍑") || normalized.range(of: #"\bbottom\b"#, options: .regularExpression) != nil { return normalized.contains("vers") ? "vers bottom" : "bottom" }
        if normalized.contains("vers") { return "vers" }
        if normalized.contains("side") { return "side" }
        return raw.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
