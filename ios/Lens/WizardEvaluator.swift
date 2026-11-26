import Foundation

@MainActor enum WizardEvaluator {
    static func evaluate(_ profile: WizardProfileSample, configuration: WizardConfiguration) -> WizardEvaluation {
        let filters = configuration.filters.filter { $0.minimum != nil || $0.maximum != nil || !$0.allowedValues.isEmpty }
        guard !filters.isEmpty else {
            return WizardEvaluation(profile: profile, outcome: .unknown, reasons: ["No confirmed filter rule is set yet."])
        }
        var reasons: [String] = [], missing = false, blocked = false
        for filter in filters {
            let mappings = configuration.mappings.filter { $0.state == .confirmed && $0.lensField == filter.field }
            let observed = profile.fields.compactMap { field -> (WizardProfileSample.Field, WizardFieldMapping)? in
                guard let mapping = mappings.first(where: { $0.sourceKey == field.key }) else { return nil }
                return (field, mapping)
            }
            guard let first = observed.first else {
                missing = true
                let reason = "\(filter.field.label) is unknown; policy: \(filter.missingPolicy.label.lowercased())."
                reasons.append(reason)
                if filter.missingPolicy == .block { blocked = true }
                continue
            }
            let field = first.0, mapping = first.1
            if filter.field.isNumeric, filter.minimum != nil || filter.maximum != nil {
                guard let value = Self.numericValue(field.value, field: filter.field, outputUnit: filter.unit) else {
                    missing = true
                    reasons.append("\(mapping.sourceLabel) was visible as ‘\(field.value)’ but its \(filter.unit) value is unknown; policy: \(filter.missingPolicy.label.lowercased()).")
                    if filter.missingPolicy == .block { blocked = true }
                    continue
                }
                if let minimum = filter.minimum, value < minimum {
                    blocked = true; reasons.append("\(mapping.sourceLabel) is \(Self.display(value)) \(filter.unit), below the \(Self.display(minimum)) minimum.")
                } else if let maximum = filter.maximum, value > maximum {
                    blocked = true; reasons.append("\(mapping.sourceLabel) is \(Self.display(value)) \(filter.unit), above the \(Self.display(maximum)) maximum.")
                } else { reasons.append("\(mapping.sourceLabel) is \(Self.display(value)) \(filter.unit), within the selected range.") }
            } else if !filter.allowedValues.isEmpty {
                let canonical = mapping.options.first(where: { $0.rawValue == field.value })?.lensValue ?? field.value
                if filter.allowedValues.contains(canonical) { reasons.append("\(mapping.sourceLabel) is ‘\(field.value)’ → ‘\(canonical)’, which is allowed.") }
                else { blocked = true; reasons.append("\(mapping.sourceLabel) is ‘\(field.value)’ → ‘\(canonical)’, which is not allowed.") }
            }
        }
        return WizardEvaluation(profile: profile, outcome: blocked ? .blocked : (missing ? .unknown : .match), reasons: reasons)
    }

    static func numericValue(_ raw: String, field: WizardLensField, outputUnit: String) -> Double? {
        let text = raw.lowercased()
        let numbers = text.matches(of: /\d+(?:\.\d+)?/).compactMap { Double($0.output) }
        guard let first = numbers.first else { return nil }
        switch field {
        case .age:
            return text.range(of: #"^\s*\d{2,3}(?:\s*(?:years?(?:\s+old)?|yo))?\s*$"#, options: .regularExpression) != nil ? first : nil
        case .height:
            let cm: Double
            if text.contains("'") || text.contains("ft"), numbers.count >= 2 { cm = (first * 12 + numbers[1]) * 2.54 }
            else if text.contains("in") { cm = first * 2.54 }
            else if text.contains("cm") { cm = first }
            else { return nil }
            return outputUnit == "ft / in" ? cm / 2.54 : cm
        case .weight:
            let kg: Double
            if text.contains("lb") || text.contains("pound") { kg = first * 0.45359237 }
            else if text.contains("kg") { kg = first }
            else { return nil }
            return outputUnit == "lb" ? kg / 0.45359237 : kg
        case .endowment:
            let cm: Double
            if text.contains("in") || text.contains("\"") { cm = first * 2.54 }
            else if text.contains("cm") { cm = first }
            else { return nil }
            return outputUnit == "in" ? cm / 2.54 : cm
        default: return nil
        }
    }
    private static func display(_ value: Double) -> String { value.formatted(.number.precision(.fractionLength(0...1))) }
}
