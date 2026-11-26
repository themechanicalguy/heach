import Capacitor
import QuickLook
import UIKit

/**
 Opens a file the web app has already fetched (a record, a report, a prescription) in the
 phone's own viewer (MA-06). A web view cannot download the in-memory files the web app makes,
 so "Download" would otherwise do nothing. The file sits in the app's private temporary folder
 only until the next file is opened or the app next starts. Only HEACH's pages reach this
 plugin (BridgeGate).
 */
@objc(FilesPlugin)
final class FilesPlugin: CAPPlugin, CAPBridgedPlugin, QLPreviewControllerDataSource {
    let identifier = "FilesPlugin"
    let jsName = "HeachFiles"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)]

    private static let folder = FileManager.default.temporaryDirectory.appendingPathComponent("opened", isDirectory: true)
    /// The types the web app hands over; nothing the phone would run or install.
    private static let types: Set<String> = ["application/pdf", "image/jpeg", "image/png", "application/json"]
    private var opened: URL?

    /// Removes anything opened earlier; called at app start and before each new file.
    static func clearOpened() {
        try? FileManager.default.removeItem(at: folder)
    }

    @objc func open(_ call: CAPPluginCall) {
        let name = Self.plainName(call.getString("name") ?? "")
        let contentType = call.getString("contentType") ?? ""
        let bytes = Data(base64Encoded: call.getString("contentBase64") ?? "", options: .ignoreUnknownCharacters)
        guard let name, Self.types.contains(contentType), let bytes, !bytes.isEmpty else {
            call.reject("refused")
            return
        }
        DispatchQueue.main.async { [self] in
            do {
                opened = try write(name, bytes)
                show()
                call.resolve()
            } catch {
                // No detail: a message could carry the file's name.
                call.reject("failed")
            }
        }
    }

    /// The name comes from a record's title: keep it a plain file name.
    private static func plainName(_ name: String) -> String? {
        let unsafe = CharacterSet(charactersIn: "\\/:*?\"<>|").union(.controlCharacters)
        let plain = String(name.unicodeScalars.map { unsafe.contains($0) ? "_" : Character($0) })
        return ["", ".", ".."].contains(plain) ? nil : plain
    }

    private func write(_ name: String, _ bytes: Data) throws -> URL {
        Self.clearOpened()
        try FileManager.default.createDirectory(at: Self.folder, withIntermediateDirectories: true)
        let file = Self.folder.appendingPathComponent(name)
        try bytes.write(to: file, options: [.atomic, .completeFileProtection])
        return file
    }

    /// The phone's viewer, which also offers save and share; for a file it cannot show, the share sheet.
    private func show() {
        guard let file = opened, let screen = bridge?.viewController else { return }
        if QLPreviewController.canPreview(file as NSURL) {
            let viewer = QLPreviewController()
            viewer.dataSource = self
            screen.present(viewer, animated: true)
        } else {
            let share = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            share.popoverPresentationController?.sourceView = screen.view
            screen.present(share, animated: true)
        }
    }

    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        opened == nil ? 0 : 1
    }

    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        (opened ?? Self.folder) as NSURL
    }
}
