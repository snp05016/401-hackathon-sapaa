# Mobile Sync Handoff

## Current status

The Electron companion sync channel, browser extension bridge, and iOS reconnect and decoding pipelines are wired together. The mobile companion connects to Electron on port `4175`; port `4173` remains the loopback browser-extension bridge.

The iOS surface now presents the desktop record as a premium, read-only career dossier: Today briefing, pipeline runway, application search/detail, follow-up drafts, recruiter signals, tracking review, insights, desktop-tool outcomes, pairing, and theme settings. Desktop-only actions—including Discover searches, resume editing/export, profile maintenance, browser autofill, and final submission—are called out in the phone UI rather than represented as fake mobile controls.

## Implemented changes

- **iOS Date Parsing Resilience:** `SyncCoding.makeDecoder()` now decodes ISO 8601 with/without fractional seconds, `YYYY-MM-DD` calendar dates, and standard SQLite datetime formats (`yyyy-MM-dd HH:mm:ss`), preventing `.decodeFailure` reconnect loops when date-only fields or SQLite dates are received.
- **Resilient Model Decoding:** `JobApplication`, `ApplicationEventType`, and `SyncRecruiterSignal` safely decode with default fallbacks for optional or missing fields.
- **Change Detection & Fingerprinting:** `derivedFingerprint()` in `server.ts` now tracks `recruiterSignals` and `analytics` changes, ensuring updates to Gmail recruiter signals and rolling analytics immediately broadcast `sync-change` frames.
- **Robust Candidate Mapping:** `readState()` in `server.ts` defensively handles suggestions without candidate arrays.
- **Pairing UI Usability:** Desktop Profile displays the companion port and pairing token even when no LAN IP is available, offering `127.0.0.1` for iOS Simulator testing.
- **Monorepo Typechecking:** Fixed pre-existing missing `followUpOn` and `followUpDismissedAt` fields in `@ghostboard/tracking` test fixtures. Full monorepo `npm run typecheck` now passes cleanly.
- **Premium mobile UI:** Added a shared Paper/Noir/Bone visual system, editorial typography, continuous status rail, Dynamic Type-aware hierarchy, accessible hit targets, and Reduce Motion-aware transitions across the new mobile surfaces.
- **Comprehensive Testing:** Added automated socket handshake/authentication/snapshot tests in `apps/desktop/electron/sync/server.test.ts` and date decoding unit tests in `apps/ios/GhostboardTests/SyncDecodingTests.swift`.

## Verification

- Monorepo TypeScript check passed across all packages and apps: `npm run typecheck`.
- Monorepo unit test suite passed: `npm test` (129 tests passed).
- Desktop production build passed: `npm run build --workspace=apps/desktop`.
- Extension production build passed: `npm run build --workspace=apps/extension`.
- The earlier baseline iOS simulator suite passed before the current UI expansion. The current mobile UI should be built and tested locally in Xcode as requested; no Xcode build was run during this UI pass.
- Authenticated WebSocket probes to `4175` verified welcome, snapshot, and snapshot-request frames.
- `git diff --check` passed cleanly.

## How to pair a phone

1. Start the Electron desktop app.
2. Open **Profile → iPhone companion**.
3. Copy the displayed LAN host (or `127.0.0.1` on the iOS Simulator) and pairing token.
4. Enter that host, token, and port `4175` in the iOS app under **Settings**.
5. Keep the Mac and phone on the same Wi-Fi and allow iOS Local Network access.

Do not enter `localhost`, `127.0.0.1`, or port `4173` on a physical iPhone.

## Important files

- `apps/ios/Ghostboard/Core/Networking/SyncConfiguration.swift`
- `apps/ios/Ghostboard/Core/Networking/SyncClient.swift`
- `apps/ios/Ghostboard/Core/Models/SyncModels.swift`
- `apps/ios/Ghostboard/Features/Settings/SettingsView.swift`
- `apps/desktop/electron/sync/server.ts`
- `apps/desktop/electron/sync/server.test.ts`
- `apps/desktop/electron/sync/info.ts`
- `apps/desktop/electron/main.ts`
- `apps/desktop/src/pages/Profile.tsx`
- `packages/tracking/src/duplicates.test.ts`
- `packages/tracking/src/statusProviders/emailStatusProvider.test.ts`

## UI review notes

- The mobile display name and Local Network permission copy are neutral (`Companion`) so technical identifiers do not become visible product branding.
- The app remains intentionally read-only. It reports outcomes from desktop tools and keeps consequential actions on the Mac/browser boundary.
- Xcode per-user state is ignored via `.gitignore`; do not package `xcuserdata` from a local checkout.
