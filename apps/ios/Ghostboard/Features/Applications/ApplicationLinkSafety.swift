import Foundation

extension JobApplication {
    var safeJobURL: URL? {
        guard let components = URLComponents(string: jobUrl),
              let scheme = components.scheme?.lowercased(),
              scheme == "https" || scheme == "http",
              components.host != nil
        else {
            return nil
        }
        return components.url
    }
}
