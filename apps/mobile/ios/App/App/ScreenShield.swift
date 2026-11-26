import UIKit

/**
 MA-04 on iPhone: any screen may show health data. iOS lets no app block a screenshot, but the
 app can keep its screens out of the app switcher and off a screen that is being recorded or
 mirrored: while either is the case, a plain cover in the app's colour hides them.
 */
@MainActor
final class ScreenShield {
    private let cover = UIView()
    private weak var window: UIWindow?
    private var away = false
    private var recorded = false

    init(over window: UIWindow, colour: UIColor) {
        self.window = window
        cover.backgroundColor = colour
        cover.frame = window.bounds
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.isHidden = true
        window.addSubview(cover)
        watchRecording(of: window)
    }

    /// The app is leaving the screen (the switcher's snapshot is taken after this) or coming back.
    func setAway(_ isAway: Bool) {
        away = isAway
        update()
    }

    private func watchRecording(of window: UIWindow) {
        if #available(iOS 17.0, *) {
            recorded = window.traitCollection.sceneCaptureState == .active
            window.registerForTraitChanges([UITraitSceneCaptureState.self]) { [weak self] (window: UIWindow, _) in
                self?.recorded = window.traitCollection.sceneCaptureState == .active
                self?.update()
            }
        } else {
            recorded = UIScreen.main.isCaptured
            NotificationCenter.default.addObserver(
                forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main
            ) { [weak self] _ in
                Task { @MainActor in
                    self?.recorded = UIScreen.main.isCaptured
                    self?.update()
                }
            }
        }
        update()
    }

    private func update() {
        cover.isHidden = !(away || recorded)
        window?.bringSubviewToFront(cover)
    }
}
