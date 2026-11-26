import SwiftUI
import WebKit

enum FilterUnits: String, CaseIterable, Identifiable {
    case automatic, imperial, metric
    static let key = "lens.filterUnits"
    static let showMissingKey = "lens.showProfilesWithMissingDetails"
    var id: Self { self }
    var label: String {
        switch self {
        case .automatic: "Use iPhone defaults"
        case .imperial: "Imperial"
        case .metric: "Metric"
        }
    }
    var useImperial: Bool {
        self == .imperial || (self == .automatic && Locale.current.measurementSystem == .us)
    }
    func unit(for field: WizardLensField) -> String {
        useImperial ? (field.units.dropFirst().first ?? field.defaultUnit) : field.defaultUnit
    }
}

struct FilterDefaultsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage(FilterUnits.key) private var units = FilterUnits.automatic
    @AppStorage(FilterUnits.showMissingKey) private var showMissing = true

    var body: some View {
        NavigationStack {
            Form {
                Picker("Measurement units", selection: $units) {
                    ForEach(FilterUnits.allCases) { Text($0.label).tag($0) }
                }
                Toggle("Show profiles with missing details", isOn: $showMissing)
            }
            .navigationTitle("Filtering defaults")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }.tint(Family.action)
    }
}

@MainActor final class GuidedFilterSetup: ObservableObject {
    static let sampleTarget = 5
    enum Stage { case closed, menu, map, profiles, preview }

    @Published var stage: Stage = .closed
    @Published private(set) var configuration: WizardConfiguration
    @Published private(set) var count: Int?
    @Published private(set) var mapFields: [String] = []
    @Published private(set) var samples: [WizardProfileSample] = []
    @Published private(set) var reviewing: WizardProfileSample?
    @Published private(set) var reviewField: WizardProfileSample.Field?
    @Published var notice: String?
    @Published private(set) var busy = false
    @Published private(set) var previewResults: [WizardEvaluation] = []
    @Published private(set) var canPreviewMap = false
    @Published private(set) var additionalFieldScan = false
    @Published private(set) var showEveryone = false
    @Published var preferencesPresented = false

    let browser: BrowserModel
    private let store = WizardStore()
    private let siteID: UUID
    private var scanOrigin: String?
    private var mapAddress: URL?
    private var mapHistoryItem: WKBackForwardListItem?
    private var readableMapEntries: [WizardProfileSample] = []
    private var pendingLinks: [URL] = []
    private var acceptedFields: [String: WizardLensField] = [:]
    private var corrections: [String: [String: WizardLensField]] = [:]
    private var correctedOptions: [String: [String: String]] = [:]
    private(set) var draft: WizardConfiguration?
    private var previousPreviewMode: WizardPreviewMode = .showAll
    private var storeReadable = true

    init(site: SavedSite, browser: BrowserModel) {
        self.browser = browser
        siteID = site.id
        do { configuration = try store.load(siteID: site.id) }
        catch { configuration = WizardConfiguration(siteID: site.id); notice = error.localizedDescription; storeReadable = false }
    }

    var completed: Bool {
        configuration.completedSiteScan == true ||
        configuration.mappings.contains { $0.state == .confirmed && $0.lensField != nil }
    }
    var canFinish: Bool { !acceptedFields.isEmpty && !samples.isEmpty }
    var hasAutomaticNext: Bool { !pendingLinks.isEmpty }
    var profileProgress: String { "\(samples.count) of \(Self.sampleTarget) profiles scanned" }

    func startScan(additional: Bool = false) {
        guard !busy, storeReadable else { return }
        if !additional { draft = nil }
        additionalFieldScan = additional
        count = nil
        mapFields = []
        readableMapEntries = []
        samples = []
        pendingLinks = []
        acceptedFields = [:]
        corrections = [:]
        correctedOptions = [:]
        reviewing = nil
        reviewField = nil
        notice = nil
        scanOrigin = browser.origin
        if !additional { mapAddress = nil; mapHistoryItem = nil }
        if additional { preferencesPresented = false }
        stage = additional ? .profiles : .map
    }

    func cancelScan() {
        guard !busy else { return }
        reviewing = nil
        reviewField = nil
        notice = nil
        stage = .menu
        if additionalFieldScan { preferencesPresented = true }
    }

    func scanMap() async {
        guard !busy else { return }
        if scanOrigin == nil { scanOrigin = browser.origin }
        busy = true; notice = nil
        defer { busy = false }
        do {
            let result = try await scanPage()
            guard result.kind == .collection, result.visibleReferenceCount > 0 else {
                notice = "No map entries found. Return to the map, then tap Scan map again."
                return
            }
            count = result.visibleReferenceCount
            mapAddress = browser.webView.url
            mapHistoryItem = browser.webView.backForwardList.currentItem
            pendingLinks = (result.profileLinks ?? []).shuffled()
            let observations = result.mapObservations ?? result.profiles
            readableMapEntries = observations.map { entry in
                var usable = entry
                usable.fields = entry.fields.filter { Self.usableField($0) != nil }
                return usable
            }
            mapFields = Set(readableMapEntries.flatMap(\.fields).compactMap { Self.usableField($0)?.label }).sorted()
        } catch { notice = error.localizedDescription }
    }

    func nextProfile() {
        guard !busy else { return }
        stage = .profiles
        notice = nil
        guard !pendingLinks.isEmpty, browser.origin == scanOrigin else {
            if !samples.isEmpty { notice = "Open a different profile on the map, then confirm below." }
            return
        }
        browser.navigate(pendingLinks.removeFirst().absoluteString)
    }

    func returnToMap() {
        guard !busy else { return }
        let returned = navigateToScannedMap()
        notice = returned ? "Open a different profile, then confirm below." :
            "Close the profile on the website, then open a different one."
    }

    private func navigateToScannedMap() -> Bool {
        guard let mapAddress, SiteAddress.origin(mapAddress) == browser.origin,
              browser.webView.url != mapAddress else { return false }
        if let mapHistoryItem, browser.webView.backForwardList.backList.contains(where: { $0 === mapHistoryItem }) {
            browser.webView.go(to: mapHistoryItem)
        } else {
            browser.navigate(mapAddress.absoluteString)
        }
        return true
    }

    func scanProfile() async {
        guard !busy, reviewing == nil, samples.count < Self.sampleTarget else { return }
        busy = true; notice = nil
        defer { busy = false }
        do {
            let result = try await scanPage()
            guard result.kind == .detail, var profile = result.profiles.first else {
                notice = "Lens couldn’t read an open profile. Open a profile and try again."
                return
            }
            if profile.reliableID == true, samples.contains(where: { $0.id == profile.id }) {
                notice = "That profile was already scanned. Open a different one."
                return
            }
            if profile.reliableID != true { profile.id = UUID().uuidString }
            profile.title = "Profile \(samples.count + 1)"
            reviewing = profile
            advanceReview()
        } catch { notice = error.localizedDescription }
    }

    func resolve(_ field: WizardLensField?, value: String? = nil) {
        guard let reviewField, var profile = reviewing else { return }
        if let field {
            if let existing = acceptedFields[reviewField.key], existing != field {
                profile.fields.removeAll { $0.key == reviewField.key }
                reviewing = profile
            } else {
                if field.isNumeric,
                   WizardEvaluator.numericValue(reviewField.value, field: field, outputUnit: field.defaultUnit) == nil {
                    notice = "That value can’t be used for \(field.label). Choose another field or skip it."
                    return
                }
                corrections[reviewField.key, default: [:]][reviewField.value] = field
                if let value { correctedOptions[reviewField.key, default: [:]][reviewField.value] = value }
            }
        } else {
            profile.fields.removeAll { $0.key == reviewField.key }
            reviewing = profile
        }
        self.reviewField = nil
        advanceReview()
    }

    private func advanceReview() {
        guard var profile = reviewing else { return }
        var available: [String: WizardLensField] = [:]
        for field in profile.fields {
            if let match = corrections[field.key]?[field.value] ?? Self.usableField(field),
               acceptedFields[field.key] == nil || acceptedFields[field.key] == match {
                available[field.key] = match
            } else if Self.suggestedField(field) != nil {
                reviewField = field
                return
            }
        }
        profile.fields.removeAll { available[$0.key] == nil }
        reviewing = nil
        guard !profile.fields.isEmpty else {
            notice = "No usable details found. Open a different profile and try again."
            return
        }
        acceptedFields.merge(available) { _, new in new }
        samples.append(profile)
        let labels = Set(available.values.map(\.label)).sorted().joined(separator: ", ")
        notice = "Profile scanned. Lens found \(labels)."
        if additionalFieldScan || samples.count == Self.sampleTarget { finishScan() }
    }

    func finishScan() {
        guard canFinish else { return }
        let previousFields = Set(configuration.mappings.filter { $0.state == .confirmed }.compactMap(\.lensField))
        var next = configuration
        mergeResults(into: &next)
        next.completedSiteScan = true
        next.lastScanDescription = "\(samples.count) profiles scanned"
        do {
            try store.save(next)
            configuration = next
            if var draft {
                mergeResults(into: &draft)
                self.draft = draft
            }
            if additionalFieldScan {
                let added = Set(next.mappings.filter { $0.state == .confirmed }.compactMap(\.lensField)).subtracting(previousFields)
                notice = added.isEmpty ? "Profile scanned. No new filter found." :
                    "New filters: \(added.map(\.label).sorted().joined(separator: ", "))."
            } else {
                notice = "Site scan complete. \(samples.count) \(samples.count == 1 ? "profile" : "profiles") scanned."
            }
            stage = .menu
            if additionalFieldScan { preferencesPresented = true }
        } catch { notice = error.localizedDescription }
    }

    private func mergeResults(into next: inout WizardConfiguration) {
        var meanings = acceptedFields
        for field in readableMapEntries.flatMap(\.fields) where meanings[field.key] == nil {
            meanings[field.key] = Self.usableField(field)
        }
        let mapEntries = readableMapEntries.map { entry in
            var compatible = entry
            compatible.fields = entry.fields.filter { Self.usableField($0) == meanings[$0.key] }
            return compatible
        }
        let proposals = WizardDetector.mappings(for: samples + mapEntries)
        for var proposal in proposals {
            guard let meaning = meanings[proposal.sourceKey] else { continue }
            proposal.lensField = meaning
            proposal.state = .confirmed
            proposal.options = proposal.options.map { option in
                WizardOptionMapping(rawValue: option.rawValue,
                    lensValue: correctedOptions[proposal.sourceKey]?[option.rawValue] ??
                        WizardDetector.canonicalOption(option.rawValue, for: meaning),
                    evidenceCount: option.evidenceCount)
            }
            if let index = next.mappings.firstIndex(where: { $0.sourceKey == proposal.sourceKey }) {
                let old = next.mappings[index]
                if corrections[proposal.sourceKey] == nil, old.state == .confirmed, old.lensField == meaning {
                    proposal.options = old.options + proposal.options.filter { option in
                        !old.options.contains { $0.rawValue == option.rawValue }
                    }
                }
                next.mappings[index] = proposal
            } else { next.mappings.append(proposal) }
            if !next.filters.contains(where: { $0.field == meaning }) {
                next.filters.append(WizardFilter(field: meaning, unit: meaning.defaultUnit))
            }
        }
        let ids = Set(samples.map(\.id))
        next.collectedProfiles = Array(((next.collectedProfiles ?? []).filter { !ids.contains($0.id) } + samples).suffix(100))
        next.filters.sort { $0.field.label < $1.field.label }
    }

    func editPreferences() {
        if draft == nil {
            var edit = configuration
            let meanings = Set(edit.mappings.filter { $0.state == .confirmed }.compactMap(\.lensField))
            for field in meanings where !edit.filters.contains(where: { $0.field == field }) {
                edit.filters.append(WizardFilter(field: field, unit: field.defaultUnit))
            }
            edit.filters.sort { $0.field.label < $1.field.label }
            draft = edit
        }
        preferencesPresented = true
    }

    func discardPreferences() {
        draft = nil
        preferencesPresented = false
    }

    func resetFiltering() async throws {
        guard !busy, storeReadable else {
            throw AppIssue.message("Filtering setup can’t be reset right now.")
        }
        let empty = WizardConfiguration(siteID: siteID)
        try store.save(empty)
        configuration = empty
        draft = nil
        samples = []
        count = nil
        mapFields = []
        readableMapEntries = []
        reviewing = nil
        reviewField = nil
        pendingLinks = []
        previewResults = []
        notice = nil
        stage = .closed
        await browser.clearWizardPreview()
    }

    func findMissingFilter(_ filters: [WizardFilter]) {
        draft?.filters = filters
        startScan(additional: true)
    }

    func beginPreview(_ filters: [WizardFilter]) async {
        guard !busy, var edit = draft else { return }
        edit.filters = filters
        draft = edit
        previousPreviewMode = configuration.previewMode
        preferencesPresented = false
        stage = .preview
        showEveryone = false
        if !navigateToScannedMap() { await refreshPreview() }
    }

    func refreshPreview() async {
        guard !busy, let draft else { return }
        busy = true; notice = nil
        defer { busy = false }
        do {
            let result = try await browser.scanCurrentListing()
            canPreviewMap = result.kind == .collection && result.visibleReferenceCount > 0
            previewResults = canPreviewMap ? Self.evaluateMap(result, configuration: draft) : []
            try await browser.setWizardPreview(previewResults, mode: showEveryone ? .showAll : .dim)
        } catch {
            canPreviewMap = false
            previewResults = []
            notice = error.localizedDescription
        }
    }

    func togglePreview() async {
        showEveryone.toggle()
        do { try await browser.setWizardPreview(previewResults, mode: showEveryone ? .showAll : .dim) }
        catch { notice = error.localizedDescription }
    }

    func leavePreview(edit: Bool) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let result = try await browser.scanCurrentListing()
            let previous = result.kind == .collection ? Self.evaluateMap(result, configuration: configuration) : []
            try await browser.setWizardPreview(previous, mode: previousPreviewMode)
        } catch { await browser.clearWizardPreview() }
        stage = .menu
        if edit { preferencesPresented = true }
        else { draft = nil }
    }

    func savePreferences() async {
        guard !busy, var draft else { return }
        draft.previewMode = showEveryone ? .showAll : .dim
        do {
            try store.save(draft)
            configuration = draft
            self.draft = nil
            notice = "Preferences saved."
            stage = .menu
        } catch { notice = error.localizedDescription }
    }

    private func scanPage() async throws -> WizardScanResult {
        guard let origin = browser.origin, origin == scanOrigin else {
            throw AppIssue.message("Return to this website before scanning.")
        }
        return try await browser.scanCurrentListing()
    }

    static func suggestedField(_ field: WizardProfileSample.Field) -> WizardLensField? {
        WizardLensField.suggestion(label: field.label, values: []) ??
            WizardLensField.suggestion(label: "", values: [field.value])
    }

    static func usableField(_ field: WizardProfileSample.Field) -> WizardLensField? {
        guard let meaning = suggestedField(field) else { return nil }
        if meaning.isNumeric {
            return WizardEvaluator.numericValue(field.value, field: meaning, outputUnit: meaning.defaultUnit) == nil ? nil : meaning
        }
        if meaning == .position {
            let raw = field.value.lowercased()
            if raw.contains("🍆") || raw.contains("🍑") {
                guard !raw.contains("🍆") || !raw.contains("🍑") else { return nil }
                if raw.contains("🍆"), raw.range(of: #"\bbottom\b"#, options: .regularExpression) != nil { return nil }
                if raw.contains("🍑"), raw.range(of: #"\btop\b"#, options: .regularExpression) != nil { return nil }
                return raw.range(of: #"\b(top|bottom|vers|versatile|side)\b"#, options: .regularExpression) == nil ? nil : .position
            }
            let value = WizardDetector.canonicalOption(raw, for: meaning)
            return ["top", "bottom", "vers", "vers top", "vers bottom", "side"].contains(value) ? meaning : nil
        }
        return field.value.range(of: #"\p{L}"#, options: .regularExpression) == nil ? nil : meaning
    }

    static func evaluateMap(_ result: WizardScanResult, configuration: WizardConfiguration) -> [WizardEvaluation] {
        let samples = configuration.collectedProfiles ?? []
        let visible = result.mapObservations ?? result.profiles
        let activeFilters = configuration.filters.contains { $0.minimum != nil || $0.maximum != nil || !$0.allowedValues.isEmpty }
        guard activeFilters else { return [] }
        var effective = configuration
        let showMissing = UserDefaults.standard.object(forKey: FilterUnits.showMissingKey) as? Bool ?? true
        for index in effective.filters.indices { effective.filters[index].missingPolicy = showMissing ? .show : .block }
        return visible.map { entry in
            var profile = entry
            profile.title = "Map profile"
            profile.fields = entry.fields.filter { field in
                let mapping = configuration.mappings.first { $0.sourceKey == field.key && $0.state == .confirmed }
                return mapping?.lensField == usableField(field) && mapping?.lensField != nil
            }
            if entry.reliableID == true,
               let matched = samples.last(where: { $0.reliableID == true && $0.id == entry.id }) {
                let visibleKeys = Set(profile.fields.map(\.key))
                profile.fields += matched.fields.filter { !visibleKeys.contains($0.key) }
            }
            return WizardEvaluator.evaluate(profile, configuration: effective)
        }
    }
}

struct GuidedFilterPanel: View {
    @ObservedObject var setup: GuidedFilterSetup
    @ObservedObject var browser: BrowserModel
    @State private var selectedMeaning: WizardLensField?
    @State private var selectedPosition = ""
    @State private var reviewExamples = false

    var body: some View {
        if setup.stage != .closed {
            ScrollView {
                VStack(alignment: .leading, spacing: 9) {
                    if let notice = setup.notice { Text(notice).font(.callout).accessibilityAddTraits(.updatesFrequently) }
                    switch setup.stage {
                    case .closed: EmptyView()
                    case .menu: menu
                    case .map: map
                    case .profiles: profiles
                    case .preview: preview
                    }
                }.frame(maxWidth: .infinity, alignment: .leading).padding(12)
            }.defaultScrollAnchor(.top).frame(height: setup.stage == .menu ? 175 : 255)
                .background(Family.canvas).overlay(alignment: .top) { Divider() }
                .tint(Family.action).controlSize(.large)
        }
    }

    private var menu: some View {
        Group {
            Button(setup.completed ? "Re-scan site" : "Scan site") { setup.startScan() }
                .buttonStyle(.borderedProminent)
            Button("Set preferences") { setup.editPreferences() }
                .buttonStyle(.bordered).disabled(!setup.completed)
            if !setup.completed { Text("Scan this site first.").font(.footnote).foregroundStyle(.secondary) }
        }
    }

    private var map: some View {
        Group {
            Text("Step 1").font(.footnote.bold()).foregroundStyle(Family.siteReturn)
            Text("Scan the map").font(.headline)
            if let count = setup.count {
                Text("\(count) visible \(count == 1 ? "entry" : "entries") found.")
                if !setup.mapFields.isEmpty {
                    Text("Lens found on the map: \(setup.mapFields.joined(separator: ", ")).").font(.footnote)
                }
                Text(setup.hasAutomaticNext ? "Tap Next to open a sample profile." : "Tap a profile on the map to open it, then tap Next.")
                Button("Next") { setup.nextProfile() }.buttonStyle(.borderedProminent).disabled(browser.loading)
            } else {
                Text("Open the website map so you can see profile markers.")
                Button("Scan map") { Task { await setup.scanMap() } }
                    .buttonStyle(.borderedProminent).disabled(setup.busy || browser.loading)
            }
            Button("Back to Lens filters") { setup.cancelScan() }.disabled(setup.busy)
        }
    }

    @ViewBuilder private var profiles: some View {
        Text(setup.additionalFieldScan ? "Find a missing filter" : "Step 2 · Scan profiles").font(.headline)
        if !setup.additionalFieldScan { Text(setup.profileProgress).font(.subheadline) }
        if let field = setup.reviewField {
            Text("Needs a quick check").font(.subheadline.bold())
            Text("Lens found “\(field.value)” for \(GuidedFilterSetup.suggestedField(field)?.label ?? field.label). What does it mean here?")
            Picker("What Lens found", selection: $selectedMeaning) {
                Text("Choose a field").tag(WizardLensField?.none)
                ForEach(WizardLensField.allCases) { Text($0.label).tag(Optional($0)) }
            }.onChange(of: field) { _, _ in selectedMeaning = nil; selectedPosition = "" }
            if selectedMeaning == .position {
                Picker("Which position?", selection: $selectedPosition) {
                    Text("Choose a position").tag("")
                    ForEach(["top", "bottom", "vers", "vers top", "vers bottom", "side"], id: \.self) {
                        Text($0.capitalized).tag($0)
                    }
                }
            }
            Button("Use this field") {
                setup.resolve(selectedMeaning, value: selectedMeaning == .position ? selectedPosition : nil)
            }.disabled(selectedMeaning == nil || (selectedMeaning == .position && selectedPosition.isEmpty))
            Button("Skip this value") { setup.resolve(nil); selectedMeaning = nil; selectedPosition = "" }
        } else if setup.notice?.hasPrefix("Profile scanned.") == true, !setup.additionalFieldScan {
            if setup.hasAutomaticNext {
                Button("Next") { setup.nextProfile() }.buttonStyle(.borderedProminent)
            } else {
                Text("Use the back arrow to return to the map. Open a different profile, then scan it.")
                Button("Back to map") { setup.returnToMap() }.buttonStyle(.borderedProminent)
            }
        } else {
            Text(setup.additionalFieldScan ? "Open a profile that shows the detail you want to filter by." :
                "Is this a profile you haven’t scanned yet?")
            Button(setup.additionalFieldScan ? "Scan profile" : "Yes, scan this profile") {
                Task { await setup.scanProfile() }
            }.buttonStyle(.borderedProminent).disabled(setup.busy || browser.loading)
            Button("Choose a different profile") {
                if setup.hasAutomaticNext { setup.nextProfile() } else { setup.returnToMap() }
            }.disabled(setup.busy || browser.loading)
        }
        if setup.canFinish && setup.reviewField == nil {
            Button(setup.additionalFieldScan ? "Save profile scan" : "Finish with what Lens found") { setup.finishScan() }
                .buttonStyle(.bordered).disabled(setup.busy)
            if !setup.additionalFieldScan { Text("Scan more to help Lens find more filters.").font(.footnote).foregroundStyle(.secondary) }
        }
        Button(setup.additionalFieldScan ? "Back to preferences" : "Back to Lens filters") { setup.cancelScan() }
            .disabled(setup.busy)
    }

    private var preview: some View {
        Group {
            Text("Preview filters").font(.headline)
            if setup.busy { ProgressView() }
            else if !setup.canPreviewMap {
                Text("Return to the map, then refresh the preview.")
                Button("Refresh preview") { Task { await setup.refreshPreview() } }.buttonStyle(.bordered)
            } else if setup.previewResults.isEmpty {
                Text("Choose a preference to see a filtering preview.")
            } else {
                let blocked = setup.previewResults.filter { $0.outcome == .blocked }
                let unknown = setup.previewResults.filter { $0.outcome == .unknown }.count
                Text("\(blocked.count) would be dimmed. \(unknown) couldn’t be fully checked.")
                if let reason = blocked.first?.reasons.first { Text(reason).font(.footnote) }
                DisclosureGroup("Review examples", isExpanded: $reviewExamples) {
                    ForEach([WizardOutcome.match, .blocked], id: \.self) { outcome in
                        let examples = setup.previewResults.filter { $0.outcome == outcome }
                        Text(outcome == .match ? "Matches" : "Would be dimmed").font(.subheadline.bold())
                        if examples.isEmpty { Text("No examples on this map.").font(.footnote) }
                        ForEach(Array(examples.prefix(5).enumerated()), id: \.offset) { _, example in
                            Text(example.reasons.joined(separator: " ")).font(.footnote)
                        }
                    }
                }
                Button(setup.showEveryone ? "Show filter preview" : "Show everyone") {
                    Task { await setup.togglePreview() }
                }
                Button("Something looks wrong") { Task { await setup.leavePreview(edit: true) } }
            }
            Button("Save preferences") { Task { await setup.savePreferences() } }.buttonStyle(.borderedProminent).disabled(setup.busy)
            Button("Edit preferences") { Task { await setup.leavePreview(edit: true) } }.disabled(setup.busy)
            Button("Leave without saving", role: .cancel) { Task { await setup.leavePreview(edit: false) } }.disabled(setup.busy)
        }
    }
}

struct GuidedPreferencesView: View {
    @ObservedObject var setup: GuidedFilterSetup
    @State private var filters: [WizardFilter]
    @State private var invalidRange = false
    init(setup: GuidedFilterSetup) {
        self.setup = setup
        let units = UserDefaults.standard.string(forKey: FilterUnits.key).flatMap(FilterUnits.init) ?? .automatic
        _filters = State(initialValue: (setup.draft?.filters ?? []).map { Self.convert($0, to: units.unit(for: $0.field)) })
    }

    var body: some View {
        NavigationStack {
            Form {
                Text("Choose what you want to see on this site.")
                if let notice = setup.notice { Text(notice).font(.callout).foregroundStyle(.secondary) }
                ForEach($filters) { $filter in
                    let mappings = (setup.draft?.mappings ?? []).filter { $0.state == .confirmed && $0.lensField == filter.field }
                    if !mappings.isEmpty {
                        Section(filter.field.label) {
                            if filter.field.isNumeric {
                                numericBounds($filter)
                            } else {
                                let options = Set(mappings.flatMap(\.options).map(\.lensValue).filter { !$0.isEmpty })
                                ForEach(options.sorted(), id: \.self) { value in
                                    Toggle(optionTitle(value, field: filter.field), isOn: Binding(get: {
                                        filter.allowedValues.contains(value)
                                    }, set: { enabled in
                                        if enabled { filter.allowedValues.append(value) }
                                        else { filter.allowedValues.removeAll { $0 == value } }
                                    }))
                                }
                            }
                        }
                    }
                }
                Section {
                    Button("Missing a filter?") { setup.findMissingFilter(filters) }
                    Button("Preview filters") {
                        if filters.contains(where: { ($0.minimum ?? -.infinity) > ($0.maximum ?? .infinity) }) {
                            invalidRange = true
                        } else { Task { await setup.beginPreview(filters) } }
                    }.fontWeight(.semibold)
                    if invalidRange { Text("The minimum must be lower than or equal to the maximum.").foregroundStyle(.red) }
                }
            }.navigationTitle("Set preferences").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { setup.discardPreferences() } } }
                .interactiveDismissDisabled()
        }.tint(Family.action)
    }

    @ViewBuilder private func numericBounds(_ filter: Binding<WizardFilter>) -> some View {
        let unit = filter.wrappedValue.unit
        bound("Minimum", value: filter.minimum, unit: unit)
        bound("Maximum", value: filter.maximum, unit: unit)
        Text("Leave either end blank for no limit.").font(.footnote).foregroundStyle(.secondary)
    }

    @ViewBuilder private func bound(_ label: String, value: Binding<Double?>, unit: String) -> some View {
        if unit == "ft / in" {
            LabeledContent(label) {
                HStack {
                    TextField("Feet", value: heightPart(value, feet: true), format: .number)
                        .accessibilityLabel("\(label) feet").keyboardType(.numberPad).frame(minWidth: 26)
                    Text("ft")
                    TextField("Inches", value: heightPart(value, feet: false), format: .number)
                        .accessibilityLabel("\(label) inches").keyboardType(.numberPad).frame(minWidth: 26)
                    Text("in")
                }.multilineTextAlignment(.trailing)
            }
        } else {
            LabeledContent("\(label) (\(unit))") {
                TextField(label, value: value, format: .number).keyboardType(.decimalPad)
                    .accessibilityLabel("\(label), \(unit)").multilineTextAlignment(.trailing)
            }
        }
    }

    private func heightPart(_ value: Binding<Double?>, feet: Bool) -> Binding<Int?> {
        Binding(get: {
            guard let inches = value.wrappedValue, inches.isFinite, inches >= 0, inches < 10_000 else { return nil }
            let total = Int(inches.rounded())
            return feet ? total / 12 : total % 12
        }, set: { part in
            guard let part else { value.wrappedValue = nil; return }
            guard (0...999).contains(part) else { return }
            let old = Int((value.wrappedValue ?? 0).rounded())
            value.wrappedValue = Double(feet ? part * 12 + old % 12 : old / 12 * 12 + part)
        })
    }

    private func optionTitle(_ value: String, field: WizardLensField) -> String {
        guard field == .position else { return value }
        return switch value.lowercased() {
        case "top": "🍆 Top"
        case "bottom": "🍑 Bottom"
        default: value.capitalized
        }
    }

    static func convert(_ filter: WizardFilter, to unit: String) -> WizardFilter {
        guard filter.unit != unit else { return filter }
        var next = filter
        let multiplier: Double = switch (filter.unit, unit) {
        case ("cm", "in"), ("cm", "ft / in"): 1 / 2.54
        case ("in", "cm"), ("ft / in", "cm"): 2.54
        case ("kg", "lb"): 1 / 0.45359237
        case ("lb", "kg"): 0.45359237
        default: 1
        }
        next.minimum = filter.minimum.map { $0 * multiplier }
        next.maximum = filter.maximum.map { $0 * multiplier }
        next.unit = unit
        return next
    }
}
