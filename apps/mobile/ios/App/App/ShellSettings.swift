import UIKit

/// What this build of the app is, from the build settings in heach.xcconfig (MA-01, MA-02).
struct ShellSettings {
    /// `patient` or `provider`: which app this is.
    let audience: String
    /// The HEACH server, for example `https://heach.in`: scheme, host and port only.
    let server: URL
    /// The page the app opens at.
    let startPage: URL
    /// Hosts of partner pages (identity, payments) that may open inside the app (MA-03).
    let partnerHosts: [String]
    let build: String

    static let current = ShellSettings(info: Bundle.main.infoDictionary ?? [:])

    init(info: [String: Any]) {
        func value(_ key: String) -> String {
            (info[key] as? String ?? "").trimmingCharacters(in: .whitespaces)
        }
        // build-checks.sh refuses to build without an address, so this only fails on a broken build.
        guard let server = URL(string: value("HeachServerURL")), server.host != nil else {
            fatalError("HeachServerURL is not set")
        }
        audience = value("HeachAudience")
        self.server = server
        startPage = URL(string: value("HeachStartPath"), relativeTo: server)?.absoluteURL ?? server
        partnerHosts = value("HeachAllowNavigation")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        build = value("CFBundleVersion")
    }

    /// This app's colour, behind the launch screen and over hidden screens.
    var brandColour: UIColor {
        UIColor(named: "Brand-\(audience)") ?? .systemBackground
    }

    /// A link to the HEACH server itself: the only kind the app loads when asked from outside.
    func isOurs(_ link: URL) -> Bool {
        link.scheme == "https" && link.host == server.host && link.port == server.port
    }

    /// The same page on the server this app was built for; only the link's path and query are taken.
    func page(of link: URL) -> URL? {
        guard let parts = URLComponents(url: link, resolvingAgainstBaseURL: false),
              var page = URLComponents(url: server, resolvingAgainstBaseURL: false) else { return nil }
        page.percentEncodedPath = parts.percentEncodedPath
        page.percentEncodedQuery = parts.percentEncodedQuery
        page.percentEncodedFragment = parts.percentEncodedFragment
        return page.url
    }
}
