import AppKit
import WebKit

@MainActor
final class Smoke: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var errors: [String] = []
    var running = false

    func start() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.add(self, name: "errors")
        let capture = "window.addEventListener('error', e => window.webkit.messageHandlers.errors.postMessage(e.message)); window.addEventListener('unhandledrejection', e => window.webkit.messageHandlers.errors.postMessage(String(e.reason)));"
        configuration.userContentController.addUserScript(WKUserScript(source: capture, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 800), configuration: configuration)
        web.navigationDelegate = self
        window = NSWindow(contentRect: web.frame, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        window.contentView = web
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        let url = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).appendingPathComponent("index.html")
        web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        errors.append(String(describing: message.body))
    }

    func js(_ source: String) async throws -> Any? {
        try await withCheckedThrowingContinuation { continuation in
            web.evaluateJavaScript(source) { result, error in
                if let error = error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: result) }
            }
        }
    }

    func wait(_ seconds: Double) async throws {
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }

    func check(_ source: String, _ label: String) async throws {
        let result = try await js(source)
        guard (result as? Bool) == true else {
            throw NSError(domain: "Smoke", code: 1, userInfo: [NSLocalizedDescriptionKey: "FAILED: \(label), result \(String(describing: result))"])
        }
        print("PASS: \(label)")
    }

    func key(_ code: String, down: Bool) async throws {
        _ = try await js("window.dispatchEvent(new KeyboardEvent('\(down ? "keydown" : "keyup")', {code: '\(code)', bubbles: true, cancelable: true}))")
    }

    func pointer(_ x: Double, _ y: Double, down: Bool) {
        let event = NSEvent.mouseEvent(with: down ? .leftMouseDown : .leftMouseUp,
            location: NSPoint(x: x, y: web.bounds.height - y), modifierFlags: [],
            timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: window.windowNumber,
            context: nil, eventNumber: 1, clickCount: 1, pressure: down ? 1 : 0)!
        window.sendEvent(event)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !running else { return }
        running = true
        Task { @MainActor in
            do {
                try await run()
                guard errors.isEmpty else { throw NSError(domain: "JS", code: 1, userInfo: [NSLocalizedDescriptionKey: errors.joined(separator: "; ")]) }
                print("PASS: no JavaScript errors; local-file WebKit combat smoke complete")
                exit(0)
            } catch {
                print("\(error)")
                print("JavaScript errors: \(errors)")
                exit(1)
            }
        }
    }

    func run() async throws {
        try await wait(0.35)
        try await check("location.protocol === 'file:' && document.getElementById('lives').textContent === '3 / 3' && document.getElementById('score').textContent === '000000'", "file:// boots with three lives and zero score")
        try await check("(() => { const c = document.getElementById('view'); const p = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let coral=0,amber=0; for(let i=0;i<p.length;i+=4) { if(p[i]>170 && p[i]>p[i+1]*1.25 && p[i+1]<180) coral++; if(p[i]>90 && p[i+1]>65 && p[i]>p[i+2]*1.3) amber++; } return coral>8 && amber>500; })()", "canvas draws coral enemy and amber terrain")
        try await key("Space", down: true)
        try await wait(0.12)
        try await key("Space", down: false)
        try await check("document.getElementById('weapon-state').textContent === 'SHELL IN FLIGHT' && scrollY === 0", "Space fires a visible flight state without scrolling")
        try await wait(1.7)
        try await check("document.getElementById('score').textContent === '001000' && document.getElementById('target-state').textContent.startsWith('ASH WARDEN 02')", "enemy hit awards 1000 and spawns next contact")
        try await check("document.getElementById('high-score').textContent === '001000' && localStorage.getItem('iron-horizon.highScore') === '1000'", "new best is displayed and written to localStorage")
        try await check("document.getElementById('wave-state').textContent === 'WAVE 01 / 1 OF 5 DESTROYED'", "HUD counts kills towards the next wave")
        try await check("(() => { const r=document.getElementById('radar').getBoundingClientRect(); return r.top < innerHeight / 3 && r.width === r.height; })()", "round radar sits at top of cockpit")
        _ = try await js("window.scanBefore = document.getElementById('radar').toDataURL()")
        try await wait(0.15)
        try await check("document.getElementById('radar').toDataURL() !== window.scanBefore", "radar sweep visibly animates")
        try await key("KeyW", down: true)
        try await wait(0.35)
        try await key("KeyW", down: false)
        try await check("Number(document.getElementById('position-z').textContent.replace('−','-')) > 2", "driving still updates position")
        try await key("KeyP", down: true)
        try await key("KeyP", down: false)
        try await check("document.getElementById('pause-dialog').open", "P pauses combat")
        _ = try await js("window.pausedTarget = document.getElementById('target-state').textContent; window.pausedPosition = document.getElementById('position-z').textContent; window.pausedScan = document.getElementById('radar').toDataURL()")
        try await key("Space", down: true)
        try await wait(0.5)
        try await key("Space", down: false)
        try await check("document.getElementById('target-state').textContent === window.pausedTarget && document.getElementById('position-z').textContent === window.pausedPosition", "pause freezes enemy, firing, and driving")
        try await check("document.getElementById('radar').toDataURL() === window.pausedScan", "pause freezes radar sweep")
        try await key("KeyP", down: true)
        try await key("KeyP", down: false)
        try await check("!document.getElementById('pause-dialog').open", "P resumes combat")
        try await key("KeyR", down: true)
        try await key("KeyR", down: false)
        try await wait(0.12)
        try await check("document.getElementById('score').textContent === '000000' && document.getElementById('position-z').textContent === '+0000' && document.getElementById('lives').textContent === '3 / 3'", "R resets score, lives, enemies, and position")
        try await wait(3.9)
        try await check("document.getElementById('lives').textContent === '2 / 3' && document.getElementById('combat-state').textContent.includes('ARMOR HIT')", "enemy aims, approaches, fires, and damages player")
        try await check("(() => { const c=document.getElementById('view'); const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for(let i=0;i<p.length;i+=4) if(p[i]>100 && p[i]>p[i+1]*1.2 && p[i+1]>45) n++; return n>1500; })()", "cracked-glass effect produces visible damage lines")
        try await wait(6.2)
        try await check("document.getElementById('lives').textContent === '0 / 3' && !document.getElementById('combat-result').hidden && document.getElementById('weapon-state').textContent === 'CANNON OFFLINE'", "three enemy hits stop combat and show restart")
        try await check("document.getElementById('game-over-title').textContent === 'Game over' && document.getElementById('high-score').textContent === '001000'", "Game over keeps the best score visible")
        try await key("Enter", down: true)
        try await key("Enter", down: false)
        try await wait(0.12)
        try await check("document.getElementById('lives').textContent === '3 / 3' && document.getElementById('score').textContent === '000000' && document.getElementById('wave-state').textContent.startsWith('WAVE 01') && document.getElementById('combat-result').hidden", "Enter starts a fresh round after last life")
        _ = try await js("document.getElementById('restart-button').click()")
        try await wait(0.12)
        try await check("document.getElementById('lives').textContent === '3 / 3' && document.getElementById('combat-result').hidden", "restart button restores playable state")
        window.setContentSize(NSSize(width: 390, height: 844))
        try await wait(0.25)
        try await check("innerWidth === 390 && document.getElementById('view').width === Math.round(innerWidth * Math.min(devicePixelRatio,2)) && getComputedStyle(document.querySelector('.touch-controls')).display === 'flex'", "canvas resizes and narrow-screen controls appear")
        try await check("(() => { const a=document.querySelector('.sector-info').getBoundingClientRect(); const b=document.querySelector('.combat-panel').getBoundingClientRect(); return a.right < b.left && b.right <= innerWidth; })()", "combat HUD does not overlap position on narrow screen")
        let point = try await js("(() => {const r=document.querySelector('[data-control=fire]').getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]})()") as! [Double]
        pointer(point[0], point[1], down: true)
        try await wait(0.22)
        try await check("document.getElementById('weapon-state').textContent === 'SHELL IN FLIGHT' && document.querySelector('[data-control=fire]').classList.contains('active')", "native pointer hold fires on narrow screen")
        pointer(point[0], point[1], down: false)
        try await wait(0.1)
        try await check("!document.querySelector('[data-control=fire]').classList.contains('active')", "pointer release clears fire input")
        try await key("KeyW", down: true)
        _ = try await js("window.dispatchEvent(new Event('blur'))")
        try await wait(0.15)
        try await check("document.getElementById('gear').textContent === 'NEUTRAL'", "blur releases held driving and fire controls")
        try await milestoneFour()
    }

    func reload() async throws {
        web.reload()
        try await wait(0.5)
        try await check("document.readyState === 'complete'", "local-file reload completes")
    }

    func milestoneFour() async throws {
        try await reload()
        try await check("document.getElementById('high-score').textContent === '001000' && document.getElementById('score').textContent === '000000'", "earned high score survives reload without preserving current round")
        try await key("KeyA", down: true)
        try await wait(1.2)
        try await key("KeyA", down: false)
        try await check("document.getElementById('threat-state').textContent === 'ENEMY RIGHT'", "turning left warns enemy is on the right")
        try await check("(() => { const c=document.getElementById('radar'), d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0,x=0; for(let i=0;i<d.length;i+=4) if(d[i]>190 && d[i+1]<170 && d[i+2]<160) { n++; x+=(i/4)%c.width; } return n>3 && x/n>c.width/2; })()", "coral enemy dot rotates to radar right")
        try await key("KeyA", down: true)
        try await wait(3)
        try await key("KeyA", down: false)
        try await check("document.getElementById('threat-state').textContent === 'ENEMY BEHIND'", "rear contact warning follows tank heading")
        try await key("KeyR", down: true)
        try await key("KeyR", down: false)
        try await key("KeyD", down: true)
        try await wait(1.2)
        try await key("KeyD", down: false)
        try await check("document.getElementById('threat-state').textContent === 'ENEMY LEFT'", "turning right warns enemy is on the left")
        for size in [NSSize(width: 320, height: 568), NSSize(width: 844, height: 390), NSSize(width: 390, height: 844)] {
            window.setContentSize(size)
            try await wait(0.15)
            try await check("['score','high-score','lives','radar','pause-button'].every(id => { const r=document.getElementById(id).getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight; })", "scores, lives, radar, and pause fit resized viewport")
            try await check("(() => { const a=document.getElementById('radar').getBoundingClientRect(), b=document.querySelector('.heading-instrument').getBoundingClientRect(); return a.right<=b.left || a.bottom<=b.top || b.bottom<=a.top; })()", "radar never overlaps compass")
        }
        _ = try await js("localStorage.setItem('iron-horizon.highScore','1500')")
        try await reload()
        try await check("document.getElementById('high-score').textContent === '001500'", "stored best is loaded")
        try await key("Space", down: true)
        try await wait(0.12)
        try await key("Space", down: false)
        try await wait(1.7)
        try await check("document.getElementById('score').textContent === '001000' && document.getElementById('high-score').textContent === '001500' && localStorage.getItem('iron-horizon.highScore') === '1500'", "lower score never overwrites a saved best")
        for invalid in ["garbage", "-50", "Infinity", "9007199254740992"] {
            _ = try await js("localStorage.setItem('iron-horizon.highScore','\(invalid)')")
            try await reload()
            try await check("document.getElementById('high-score').textContent === '000000'", "invalid stored score is ignored")
        }
        // WebKit cannot reliably deny file storage per-page; inject only that browser failure.
        let denied = "Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError')}})"
        web.configuration.userContentController.addUserScript(WKUserScript(source: denied, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        try await reload()
        try await check("document.getElementById('storage-state').textContent === 'BEST THIS SESSION ONLY'", "blocked localStorage does not prevent boot")
        try await key("Space", down: true)
        try await wait(0.12)
        try await key("Space", down: false)
        try await wait(1.7)
        try await check("document.getElementById('score').textContent === '001000' && document.getElementById('high-score').textContent === '001000' && document.getElementById('storage-state').textContent === 'BEST THIS SESSION ONLY'", "blocked storage still permits combat and session high scores")
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
Task { @MainActor in
    let smoke = Smoke()
    smoke.start()
}
app.run()
