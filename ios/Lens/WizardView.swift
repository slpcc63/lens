import SwiftUI

enum WizardStep: Int, CaseIterable {
    case scan, confirm, filters, calibration, preview
    var title: String {
        switch self {
        case .scan: "Scan"
        case .confirm: "Fields"
        case .filters: "Filters"
        case .calibration: "Calibration"
        case .preview: "Preview"
        }
    }
}

@MainActor final class WizardViewModel: ObservableObject {
    let site: SavedSite
    let browser: BrowserModel
    private let store: WizardStore
    @Published var step: WizardStep = .scan
    @Published var scan: WizardScanResult?
    @Published var configuration: WizardConfiguration
    @Published var loading = false
    @Published var error: String?
    @Published var notice: String?

    init(site: SavedSite, browser: BrowserModel, store: WizardStore? = nil) {
        self.site = site; self.browser = browser; self.store = store ?? WizardStore()
        do { configuration = try self.store.load(siteID: site.id) }
        catch { configuration = WizardConfiguration(siteID: site.id); self.error = error.localizedDescription }
    }

    func performScan() async {
        loading = true; error = nil; notice = nil
        do {
            let result = try await browser.scanCurrentListing()
            scan = result
            let previous = Dictionary(uniqueKeysWithValues: configuration.mappings.map { ($0.sourceKey, $0) })
            configuration.mappings = result.proposedMappings.map { proposal in
                guard var existing = previous[proposal.sourceKey] else { return proposal }
                existing.evidence = proposal.evidence
                let oldOptions = Dictionary(uniqueKeysWithValues: existing.options.map { ($0.rawValue, $0) })
                existing.options = proposal.options.map { oldOptions[$0.rawValue] ?? $0 } + existing.options.filter { old in
                    !proposal.options.contains(where: { $0.rawValue == old.rawValue })
                }
                return existing
            }
            configuration.lastScanDescription = result.sampleDescription
            syncFilters()
            try save()
            step = .confirm
        } catch { self.error = error.localizedDescription }
        loading = false
    }

    func advance(from current: WizardStep) {
        do {
            if current == .confirm { syncFilters() }
            try save()
            if let next = WizardStep(rawValue: current.rawValue + 1) { step = next }
        } catch { self.error = error.localizedDescription }
    }

    func goBack() {
        if let previous = WizardStep(rawValue: step.rawValue - 1) { step = previous }
    }

    func correct(_ evaluation: WizardEvaluation) {
        notice = "Review the mapping or disable the field that misclassified \(evaluation.profile.title), then adjust filters and recalibrate."
        step = .confirm
    }

    func setPreview(_ mode: WizardPreviewMode) async {
        do {
            configuration.previewMode = mode
            try save()
            try await browser.setWizardPreview(evaluations, mode: mode)
        } catch { self.error = error.localizedDescription }
    }

    func save() throws { try store.save(configuration) }

    private func syncFilters() {
        let fields = Set(configuration.mappings.filter { $0.state == .confirmed }.compactMap(\.lensField))
        configuration.filters.removeAll { !fields.contains($0.field) }
        for field in fields where !configuration.filters.contains(where: { $0.field == field }) {
            configuration.filters.append(WizardFilter(field: field, unit: field.defaultUnit))
        }
        configuration.filters.sort { $0.field.label < $1.field.label }
    }

    var evaluations: [WizardEvaluation] {
        guard let scan else { return [] }
        return scan.profiles.map(evaluate)
    }

    private func evaluate(_ profile: WizardProfileSample) -> WizardEvaluation {
        guard !configuration.filters.isEmpty else {
            return WizardEvaluation(profile: profile, outcome: .unknown, reasons: ["No confirmed filter rule is set yet."])
        }
        var reasons: [String] = [], missing = false, blocked = false
        for filter in configuration.filters {
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

    private static func numericValue(_ raw: String, field: WizardLensField, outputUnit: String) -> Double? {
        let text = raw.lowercased()
        let numbers = text.matches(of: /\d+(?:\.\d+)?/).compactMap { Double($0.output) }
        guard let first = numbers.first else { return nil }
        switch field {
        case .age: return first
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

struct WizardView: View {
    @StateObject private var model: WizardViewModel
    @Environment(\.dismiss) private var dismiss

    init(site: SavedSite, browser: BrowserModel) {
        _model = StateObject(wrappedValue: WizardViewModel(site: site, browser: browser))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Step \(model.step.rawValue + 1) of \(WizardStep.allCases.count) · \(model.step.title)")
                        .font(.subheadline.bold()).foregroundStyle(Family.siteReturn)
                    if let notice = model.notice { Text(notice).font(.callout).padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12)) }
                    if let error = model.error { Text(error).foregroundStyle(.red).accessibilityIdentifier("wizardError") }
                    content
                }.padding(20)
            }.background(Family.canvas).navigationTitle("Set up filtering").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
        }.tint(Family.action)
    }

    @ViewBuilder private var content: some View {
        switch model.step {
        case .scan: scanStep
        case .confirm: confirmStep
        case .filters: filtersStep
        case .calibration: calibrationStep
        case .preview: previewStep
        }
    }

    private var scanStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Scan the listing you opened").font(.title2.bold())
            Text("Navigate the website to its profile cards, grid, list or map first. Lens scans only the visible, loaded top-level page after you tap Scan. It does not inspect photos, messages, passwords, canvas content or cross-origin frames.")
            if let description = model.configuration.lastScanDescription { Text("Last scan: \(description)").font(.callout).foregroundStyle(.secondary) }
            Button { Task { await model.performScan() } } label: {
                if model.loading { ProgressView().frame(maxWidth: .infinity, minHeight: 44) }
                else { Label("Scan current listing", systemImage: "viewfinder").frame(maxWidth: .infinity, minHeight: 44) }
            }.buttonStyle(.borderedProminent).disabled(model.loading).accessibilityIdentifier("scanCurrentListing")
        }
    }

    private var confirmStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Confirm or correct fields").font(.title2.bold())
            if let scan = model.scan {
                Text(scan.sampleDescription).font(.callout)
                ForEach(scan.limitations, id: \.self) { Text("• \($0)").font(.footnote).foregroundStyle(.secondary) }
            }
            if model.configuration.mappings.isEmpty { Text("No field evidence was detected. Return to Scan and load more visible profile details.") }
            ForEach($model.configuration.mappings) { $mapping in FieldMappingEditor(mapping: $mapping) }
            wizardNavigation(next: "Set filter preferences")
        }
    }

    private var filtersStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Set filter preferences").font(.title2.bold())
            Text("Unknown and unavailable values are never silently treated as an absence. Choose the policy for each field; units are shown beside every numeric range.")
            if model.configuration.filters.isEmpty { Text("Confirm at least one detected field before setting filters.") }
            ForEach($model.configuration.filters) { $filter in
                FilterEditor(filter: $filter, mappings: model.configuration.mappings.filter { $0.state == .confirmed && $0.lensField == filter.field })
            }
            wizardNavigation(next: "Calibrate with scanned profiles")
        }
    }

    private var calibrationStep: some View {
        let matches = model.evaluations.filter { $0.outcome == .match }
        let blocked = model.evaluations.filter { $0.outcome == .blocked }
        let unknown = model.evaluations.filter { $0.outcome == .unknown }
        return VStack(alignment: .leading, spacing: 16) {
            Text("Calibrate with real examples").font(.title2.bold())
            Text("Lens found \(matches.count) matching, \(blocked.count) blocked and \(unknown.count) unknown in this scanned sample. It shows up to 5 matching and 5 blocked profiles; load more on the website and rescan if either group has fewer than 5.")
            CalibrationGroup(title: "Matching (\(min(matches.count, 5)) of 5 available)", evaluations: Array(matches.prefix(5)), model: model)
            CalibrationGroup(title: "Blocked (\(min(blocked.count, 5)) of 5 available)", evaluations: Array(blocked.prefix(5)), model: model)
            if !unknown.isEmpty { CalibrationGroup(title: "Unknown (\(unknown.count))", evaluations: Array(unknown.prefix(5)), model: model) }
            HStack {
                Button("Adjust filters") { model.step = .filters }
                Spacer()
                Button("Rescan") { model.step = .scan }
            }.buttonStyle(.bordered)
            wizardNavigation(next: "Preview filtering")
        }
    }

    private var previewStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Preview on the website").font(.title2.bold())
            Text("Dim is the safe preview: would-be blocked profiles remain visible and carry the field/rule explanation. Hide takes effect only when you explicitly choose it. Show all pauses and reverses the visual filtering.")
            Picker("Preview behavior", selection: Binding(get: { model.configuration.previewMode }, set: { mode in Task { await model.setPreview(mode) } })) {
                Text("Show all").tag(WizardPreviewMode.showAll)
                Text("Dim blocked").tag(WizardPreviewMode.dim)
                Text("Hide blocked").tag(WizardPreviewMode.hide)
            }.pickerStyle(.segmented).accessibilityLabel("Filtering preview behavior")
            Text("Blocked now: \(model.evaluations.filter { $0.outcome == .blocked }.count). Settings and mappings are saved locally for \(model.site.name). URL edits preserve this saved-site identity.")
                .font(.callout).foregroundStyle(.secondary)
            CalibrationGroup(title: "Would be blocked", evaluations: model.evaluations.filter { $0.outcome == .blocked }, model: model)
            Button("Rescan newly loaded profiles") { model.step = .scan }.buttonStyle(.bordered)
            Button("Review calibration") { model.step = .calibration }.buttonStyle(.bordered)
        }.task {
            if model.configuration.previewMode == .showAll { await model.setPreview(.dim) }
            else { await model.setPreview(model.configuration.previewMode) }
        }
    }

    private func wizardNavigation(next: String) -> some View {
        HStack {
            Button("Back") { model.goBack() }.buttonStyle(.bordered)
            Spacer()
            Button(next) { model.advance(from: model.step) }.buttonStyle(.borderedProminent)
                .disabled(model.step == .confirm && model.configuration.mappings.isEmpty)
        }.frame(minHeight: 44)
    }
}

private struct FieldMappingEditor: View {
    @Binding var mapping: WizardFieldMapping
    @State private var addedRaw = ""
    @State private var addedLens = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Toggle("Use this detected field", isOn: Binding(get: { mapping.state == .confirmed }, set: { enabled in
                if enabled && mapping.lensField == nil { mapping.lensField = mapping.suggestedField ?? .bodyType }
                mapping.state = enabled ? .confirmed : .disabled
            }))
            TextField("Detected source label", text: $mapping.sourceLabel)
            Picker("Meaning in Lens", selection: Binding(get: { mapping.lensField ?? mapping.suggestedField ?? .bodyType }, set: { mapping.lensField = $0 })) {
                ForEach(WizardLensField.allCases) { Text($0.label).tag($0) }
            }
            if let suggestion = mapping.suggestedField { Text("Suggested meaning: \(suggestion.label). Confirm or change it.").font(.footnote).foregroundStyle(.secondary) }
            Text("Source key: \(mapping.sourceKey)").font(.caption).foregroundStyle(.secondary)
            ForEach(mapping.evidence, id: \.self) { Text("Evidence: \($0)").font(.caption) }
            if !mapping.options.isEmpty {
                Text("Option mappings").font(.headline)
                ForEach($mapping.options) { $option in
                    HStack { Text("\(option.rawValue) (\(option.evidenceCount))"); Text("→"); TextField("Lens value", text: $option.lensValue).textFieldStyle(.roundedBorder) }
                }
            }
            DisclosureGroup("Add a missing visible option") {
                TextField("Source option", text: $addedRaw).textFieldStyle(.roundedBorder)
                TextField("Lens value", text: $addedLens).textFieldStyle(.roundedBorder)
                Button("Add option") {
                    let raw = addedRaw.trimmingCharacters(in: .whitespacesAndNewlines)
                    let lens = addedLens.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !raw.isEmpty && !lens.isEmpty && !mapping.options.contains(where: { $0.rawValue == raw }) {
                        mapping.options.append(WizardOptionMapping(rawValue: raw, lensValue: lens, evidenceCount: 0)); addedRaw = ""; addedLens = ""
                    }
                }.disabled(addedRaw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || addedLens.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }.padding().background(.background, in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct FilterEditor: View {
    @Binding var filter: WizardFilter
    let mappings: [WizardFieldMapping]
    private var values: [String] { Array(Set(mappings.flatMap(\.options).map(\.lensValue).filter { !$0.isEmpty })).sorted() }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(filter.field.label).font(.headline)
            if filter.field.isNumeric {
                Picker("Units", selection: $filter.unit) { ForEach(filter.field.units, id: \.self) { Text($0).tag($0) } }
                HStack {
                    TextField("Minimum", text: number($filter.minimum)).keyboardType(.decimalPad).textFieldStyle(.roundedBorder)
                    Text("to")
                    TextField("Maximum", text: number($filter.maximum)).keyboardType(.decimalPad).textFieldStyle(.roundedBorder)
                    Text(filter.unit)
                }
            } else if values.isEmpty { Text("No observed options are available yet. Rescan after loading profile details.").foregroundStyle(.secondary) }
            else {
                Text("Allowed values")
                ForEach(values, id: \.self) { value in
                    Button {
                        if let index = filter.allowedValues.firstIndex(of: value) { filter.allowedValues.remove(at: index) }
                        else { filter.allowedValues.append(value) }
                    } label: { Label(value, systemImage: filter.allowedValues.contains(value) ? "checkmark.circle.fill" : "circle").frame(maxWidth: .infinity, alignment: .leading) }
                    .buttonStyle(.plain).frame(minHeight: 44)
                }
            }
            Picker("When \(filter.field.label.lowercased()) is unavailable", selection: $filter.missingPolicy) {
                ForEach(WizardMissingPolicy.allCases) { Text($0.label).tag($0) }
            }
        }.padding().background(.background, in: RoundedRectangle(cornerRadius: 16))
    }
    private func number(_ value: Binding<Double?>) -> Binding<String> {
        Binding(get: { value.wrappedValue.map { String($0) } ?? "" }, set: { value.wrappedValue = Double($0.trimmingCharacters(in: .whitespacesAndNewlines)) })
    }
}

private struct CalibrationGroup: View {
    let title: String
    let evaluations: [WizardEvaluation]
    @ObservedObject var model: WizardViewModel
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(.headline)
            if evaluations.isEmpty { Text("No real examples are available in this sample.").foregroundStyle(.secondary) }
            ForEach(evaluations) { evaluation in
                VStack(alignment: .leading, spacing: 6) {
                    Text(evaluation.profile.title).font(.subheadline.bold())
                    ForEach(evaluation.reasons, id: \.self) { Text($0).font(.caption) }
                    Button("Classified incorrectly") { model.correct(evaluation) }.font(.caption)
                }.padding().frame(maxWidth: .infinity, alignment: .leading).background(.background, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }
}
