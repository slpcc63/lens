import Foundation
import Security

struct SiteLogin: Codable {
    let username: String
    let password: String
}

enum LoginVault {
    // One explicitly saved login per exact HTTPS origin; no cross-subdomain sharing.
    private static func query(_ origin: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.slpcc63.lens.browser.logins",
         kSecAttrAccount as String: origin,
         kSecAttrSynchronizable as String: false]
    }

    static func save(_ login: SiteLogin, origin: String) throws {
        let data = try JSONEncoder().encode(login)
        let values: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        let status = SecItemUpdate(query(origin) as CFDictionary, values as CFDictionary)
        if status == errSecItemNotFound {
            var item = query(origin)
            values.forEach { item[$0.key] = $0.value }
            try check(SecItemAdd(item as CFDictionary, nil))
        } else { try check(status) }
    }

    static func read(origin: String) throws -> SiteLogin? {
        var item = query(origin)
        item[kSecReturnData as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(item as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        try check(status)
        guard let data = result as? Data else { throw AppIssue.message("The saved login could not be read.") }
        return try JSONDecoder().decode(SiteLogin.self, from: data)
    }

    static func delete(origin: String) throws {
        let status = SecItemDelete(query(origin) as CFDictionary)
        if status != errSecItemNotFound { try check(status) }
    }

    private static func check(_ status: OSStatus) throws {
        guard status == errSecSuccess else { throw AppIssue.message("Keychain could not complete this action (\(status)).") }
    }
}
