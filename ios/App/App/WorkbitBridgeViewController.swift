import UIKit
import Capacitor

/**
 * Capacitor's web view, plus the plugins written into the app itself rather
 * than installed from npm: they are registered here, before the page loads,
 * so the page finds them like any other.
 */
class WorkbitBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WorkbitWidgetsPlugin())
    }
}
