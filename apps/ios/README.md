# Ghostboard for iPhone

A read-only native companion to Ghostboard Desktop. It renders your job pipeline,
stays in sync over the desktop's LAN WebSocket, and never mutates product data.

## Opening the project

1. Open `apps/ios/Ghostboard.xcodeproj` in Xcode 16 or newer.
2. Select the **Ghostboard** scheme.
3. In *Signing & Capabilities*, pick your development team. The bundle identifier
   is `com.ghostboard.companion`; change it if that identifier is taken on your team.
4. Choose an iPhone simulator, or your own iPhone on the same Wi-Fi as the Mac.
5. Run.

The development team is already set to `HL32Z2K3ZU` and a device build has been
verified. On a first device build Xcode may need to register the bundle
identifier — that happens automatically in the Xcode UI, or from the command
line with `-allowProvisioningUpdates`.

### Testing on a physical iPhone

```bash
xcodebuild -project Ghostboard.xcodeproj -scheme Ghostboard \
  -destination 'generic/platform=iOS' -allowProvisioningUpdates build
```

Then Run from Xcode with the phone selected. The first launch needs
**Settings → General → VPN & Device Management → trust the developer** on the
phone, and **Allow** on the Local Network prompt.

The phone reaches the Mac by LAN IP, so both must be on the same network *and*
that network must permit device-to-device traffic. University, conference, and
guest Wi-Fi very often block it (client isolation). If the phone cannot connect
but the Mac shows the sync channel listening, start a personal hotspot from the
phone, join the Mac to it, and use the Mac's new address from
**Profile → iPhone companion**.

Deployment target is **iOS 17.0**. There are no third-party packages — the app
uses SwiftUI, Swift Charts, URLSession, Network, and Security only.

Source files are picked up through Xcode's file-system-synchronized groups, so
adding a `.swift` file under `Ghostboard/` needs no project edit.

## Connecting to the desktop

1. Start the desktop app: `npm run dev` from the repository root.
2. On the Mac, open **Profile → iPhone companion**. It shows the host, port, and
   pairing token. Use that companion port (default `4175`), not the browser
   extension bridge on `4173`. The token is the existing bridge token; it is written to
   `bridge.json` in Electron's userData with `0600` permissions.
3. On the phone, open **Settings**, enter the same host, port, and token, and tap
   **Connect**.
4. iOS asks for Local Network permission the first time. Allow it — without it the
   socket cannot reach your Mac.
5. The status pill in the navigation bar turns to *Connected* once the first
   snapshot lands.

If the Mac reports "No LAN address detected", it is not on a network the phone
can reach.

## How synchronization works

```
SwiftUI views → AppStore (@MainActor) → SyncClient (actor) → desktop sync server
                      ↓
              SnapshotCache (last known state on disk)
```

* The desktop is authoritative. The phone holds no second source of truth.
* On connect the client sends `sync-hello` with the protocol version and token.
  The server replies `sync-welcome` then a full `sync-snapshot`.
* Afterwards the server polls its SQLite database every 1.5s and broadcasts
  `sync-change` frames carrying upserts, deletions, and recomputed derived data.
* Every change frame carries a `sessionId` and a monotonic `revision`. The store
  applies a frame only when the session matches and the revision is exactly one
  ahead; a duplicate or stale frame is dropped, and a gap or a restarted desktop
  triggers a fresh snapshot request. That is what guarantees convergence.
* The server sends `sync-ping` every 20s and drops a client that misses a pong.
* Reconnection uses exponential backoff with jitter, capped at 30 seconds.
  `NWPathMonitor` short-circuits the backoff when the network returns.
* Backgrounding closes the socket deliberately; returning to the foreground asks
  for a fresh snapshot.

The protocol lives in `packages/shared/src/bridge/syncProtocol.ts` and is mirrored
field-for-field in `Ghostboard/Core/Models/SyncModels.swift`.

## Cached state

The last snapshot is written to `Application Support/Ghostboard/last-snapshot.json`.
On launch it is loaded immediately and labelled as last-known data until the
desktop's authoritative snapshot replaces it. A cache written by an older build is
discarded rather than migrated. Server state always wins.

## Read-only guarantee

The client's entire outbound vocabulary is `sync-hello`, `sync-pong`, and
`sync-request-snapshot`. There is no mutation affordance in the UI: no edit,
delete, move, apply, or status control exists. The only actions are opening the
original posting in Safari and copying text.

## Design tokens

`Ghostboard/DesignSystem/Theme.swift` holds the whole visual system: the three
desktop themes (Paper, Noir, Bone) converted 1:1 from the CSS custom properties in
`apps/desktop/src/styles/globals.css`, plus spacing, the 2pt corner radius, the
hairline border, and the reveal easing. No raw hex appears anywhere else.

Bodoni Moda and Archivo do not ship with iOS, so the display face maps to New York
(`design: .serif`) and body text to SF. Bundle the real faces if you want an exact
match.

## Tests

Run the **Ghostboard** scheme's test action (⌘U). It covers:

* `SyncDecodingTests` — snapshot/change/error decoding, both timestamp shapes,
  unknown frame tolerance, and backoff bounds.
* `AppStoreTests` — diff merge (upsert, delete, idempotence), and the
  stale/duplicate/gapped/new-session revision rules.

On the TypeScript side, `npm test` from the repository root covers the server's
diffing, staleness, and analytics.

## Known limitations

* `AppIcon` has no artwork yet — Xcode will warn until an icon is added.
* There is no resume viewing: the desktop stores no resume file or path, only a
  nullable `resumeId`. There is nothing to render.
* There is no contacts feature: the desktop has no contacts entity. Recruiter
  information exists only as the sender and subject inside pending Gmail
  suggestions, which are shown as read-only signals.
* Pairing is manual entry. The desktop exposes no discovery service, and adding
  Bonjour was out of scope.
