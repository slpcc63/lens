import UIKit
import UniformTypeIdentifiers

@MainActor final class ShareViewController: UIViewController {
    private let nameField = UITextField()
    private let addressField = UITextField()
    private let status = UILabel()
    private let saveButton = UIButton(type: .system)
    private var saving = false
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let title = UILabel(); title.text = "Add to Lens"; title.font = .preferredFont(forTextStyle: .title2)
        let nameLabel = UILabel(); nameLabel.text = "Website name"
        let addressLabel = UILabel(); addressLabel.text = "Website address"
        nameField.borderStyle = .roundedRect; nameField.accessibilityLabel = "Website name"
        addressField.borderStyle = .roundedRect; addressField.keyboardType = .URL
        addressField.autocapitalizationType = .none; addressField.autocorrectionType = .no
        addressField.accessibilityLabel = "Website address"
        status.numberOfLines = 0; status.font = .preferredFont(forTextStyle: .callout)
        status.text = "Save this shortcut, then open Lens. Website sign-in sessions stay in their original app."
        saveButton.setTitle("Save website", for: .normal); saveButton.isEnabled = false
        saveButton.addTarget(self, action: #selector(save), for: .touchUpInside)
        let cancel = UIButton(type: .system); cancel.setTitle("Cancel", for: .normal)
        cancel.addTarget(self, action: #selector(close), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [title, nameLabel, nameField, addressLabel, addressField, status, saveButton, cancel])
        stack.axis = .vertical; stack.spacing = 14; stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20), stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20), stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24), saveButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44), cancel.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)])
        for label in [title, nameLabel, addressLabel, status] { label.adjustsFontForContentSizeCategory = true }
        for field in [nameField, addressField] { field.font = .preferredFont(forTextStyle: .body); field.adjustsFontForContentSizeCategory = true; field.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true }
        Task { await loadURL() }
    }
    private func loadURL() async {
        let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        for item in items {
            for provider in item.attachments ?? [] where provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                do {
                    let value = try await provider.loadItem(forTypeIdentifier: UTType.url.identifier)
                    guard let url = value as? URL else { continue }
                    addressField.text = url.absoluteString
                    nameField.text = url.host ?? ""
                    saveButton.isEnabled = true
                    return
                } catch { status.text = "The website address could not be read. Try sharing the page again." }
            }
        }
        status.text = "No website address was included. Share a webpage from your browser."
    }
    @objc private func save() {
        guard !saving, let url = URL(string: addressField.text ?? "") else { status.text = "Enter a valid HTTPS website address."; return }
        saving = true; saveButton.isEnabled = false
        do {
            try SharedSiteInbox.save(name: nameField.text ?? "", url: url)
            extensionContext?.completeRequest(returningItems: nil)
        } catch { status.text = error.localizedDescription; saving = false; saveButton.isEnabled = true }
    }
    @objc private func close() { extensionContext?.completeRequest(returningItems: nil) }
}
