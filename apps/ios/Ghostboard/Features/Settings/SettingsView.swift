import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.palette) private var palette

    @State private var host = ""
    @State private var port = SyncProtocol.defaultPort
    @State private var token = ""
    @State private var validationError: String?
    @State private var showForgetConfirmation = false
    @FocusState private var isEditingConnection: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent {
                        Label(store.connectionState.shortLabel, systemImage: connectionSymbol)
                            .foregroundStyle(store.connectionState.tint(in: palette))
                    } label: {
                        Text("Status")
                    }
                    if let lastSyncedAt = store.lastSyncedAt {
                        LabeledContent("Last synced", value: AppFormat.relative(lastSyncedAt))
                    }
                    if case .failed(let reason) = store.connectionState {
                        Text(reason)
                            .appFont(AppFont.body(12))
                            .foregroundStyle(palette.accent)
                    }
                    if case .reconnecting(_, let reason?) = store.connectionState {
                        Text(reason)
                            .appFont(AppFont.body(12))
                            .foregroundStyle(palette.accent)
                    }
                } header: {
                    Text("Connection")
                } footer: {
                    Text("This iPhone receives a read-only copy from your Mac. Changes still happen on desktop.")
                }

                Section {
                    TextField("Mac host", text: $host, prompt: Text("192.168.0.10"))
                        .focused($isEditingConnection)
                        .textContentType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.numbersAndPunctuation)
                    TextField("Companion port", value: $port, format: .number.grouping(.never))
                        .keyboardType(.numberPad)
                        .focused($isEditingConnection)
                    SecureField("Pairing token", text: $token)
                        .focused($isEditingConnection)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()

                    if let validationError {
                        Text(validationError)
                            .appFont(AppFont.body(12))
                            .foregroundStyle(palette.accent)
                            .accessibilityLabel("Connection error: \(validationError)")
                    }

                    Button("Connect desktop", action: beginConnection)
                        .disabled(host.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || token.isEmpty)
                } header: {
                    Text("Pair this iPhone")
                } footer: {
                    Text("On your Mac, open Profile → iPhone companion. Copy the LAN host, port 4175, and pairing token. Port 4173 belongs to the browser extension. Keep both devices on the same Wi-Fi and allow Local Network access in iPhone Settings.")
                }

                Section {
                    NavigationLink(value: SettingsRoute.desktopTools) {
                        Label("Desktop tools", systemImage: "laptopcomputer")
                    }
                } header: {
                    Text("Your workflow")
                } footer: {
                    Text("See which Discover, browser, resume, and recruiter outcomes have reached this iPhone—and which actions remain on desktop.")
                }

                Section("Appearance") {
                    Picker("Theme", selection: $store.theme) {
                        ForEach(AppTheme.allCases) { theme in
                            Text(theme.displayName).tag(theme)
                        }
                    }
                    .pickerStyle(.inline)
                }

                if store.configuration.isConfigured {
                    Section {
                        Button("Forget this desktop", role: .destructive) {
                            showForgetConfirmation = true
                        }
                        .confirmationDialog(
                            "Forget this desktop?",
                            isPresented: $showForgetConfirmation,
                            titleVisibility: .visible
                        ) {
                            Button("Forget", role: .destructive, action: beginForget)
                            Button("Cancel", role: .cancel) {}
                        } message: {
                            Text("Nothing on your desktop changes. This iPhone stops syncing until you pair it again.")
                        }
                    } footer: {
                        Text("Removes the pairing token from this iPhone and clears the cached copy of your pipeline.")
                    }
                }

                Section {
                    LabeledContent("Mode", value: "Read-only companion")
                    LabeledContent("Sync protocol", value: "v\(SyncProtocol.version)")
                } header: {
                    Text("About")
                } footer: {
                    Text("Your profile, resumes, and application history stay on your Mac whenever possible.")
                }
            }
            .listRowBackgroundStyle(palette.surface)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .scrollContentBackground(.hidden)
            // Without this the pairing-token keyboard has no way out: the form
            // has no Done button and tapping away does not resign it.
            .scrollDismissesKeyboard(.interactively)
            .background(EditorialBackground())
            .onAppear(perform: loadFields)
            .navigationDestination(for: SettingsRoute.self) { route in
                switch route {
                case .desktopTools:
                    DesktopToolsView()
                }
            }
            .toolbar {
                ToolbarItem(placement: .keyboard) {
                    Button("Done", action: dismissKeyboard)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
        }
    }

    private func loadFields() {
        let configuration = store.configuration
        if host.isEmpty { host = configuration.host }
        if configuration.port > 0 { port = configuration.port }
        if token.isEmpty { token = configuration.token }
    }

    private var connectionSymbol: String {
        switch store.connectionState {
        case .connected: "checkmark.circle.fill"
        case .connecting, .synchronizing, .reconnecting: "arrow.triangle.2.circlepath"
        case .failed: "exclamationmark.triangle.fill"
        case .idle: "circle.dashed"
        }
    }

    private func dismissKeyboard() {
        isEditingConnection = false
    }

    private func beginConnection() {
        dismissKeyboard()
        Task { await connect() }
    }

    private func beginForget() {
        Task { await forget() }
    }

    private func connect() async {
        do {
            let configuration = try SyncConfiguration.normalized(
                hostInput: host,
                portInput: String(port),
                tokenInput: token
            )
            validationError = nil
            host = configuration.host
            port = configuration.port
            token = configuration.token
            await store.updateConfiguration(configuration)
        } catch let error as SyncConfiguration.ValidationError {
            validationError = error.localizedDescription
        } catch {
            validationError = "The companion settings could not be read. Check the host, port, and token."
        }
    }

    private func forget() async {
        await store.forgetDesktop()
        host = ""
        port = SyncProtocol.defaultPort
        token = ""
        validationError = nil
    }
}
