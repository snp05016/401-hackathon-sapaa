import { useEffect, useState } from "react";
import type { ProfileField } from "@ghostboard/shared";
import { ipc } from "../lib/ipc";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import type { SyncPairingInfo } from "../../electron/preload";

const VETERAN_OPTIONS = ["Yes", "No", "Prefer not to say"];

export function Profile() {
  const [fields, setFields] = useState<ProfileField[]>([]);
  const [saved, setSaved] = useState(false);
  const [bridge, setBridge] = useState<{ port: number; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sync, setSync] = useState<SyncPairingInfo | null>(null);
  const [syncCopied, setSyncCopied] = useState(false);

  useEffect(() => {
    ipc()
      .getProfile()
      .then((p) => setFields(p.fields));
    ipc().getBridgeInfo().then(setBridge);
    ipc().getSyncInfo().then(setSync);
  }, []);

  function updateValue(key: string, value: string) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
    setSaved(false);
  }

  function renderField(field: ProfileField) {
    if (field.key === "veteranStatus") {
      return (
        <div className="flex flex-wrap gap-3 pt-1">
          {VETERAN_OPTIONS.map((option) => {
            const checked = field.value === option;
            return (
              <label key={option} className="flex items-center gap-2 text-[12px] text-ink-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => updateValue(field.key, option)}
                />
                {option}
              </label>
            );
          })}
        </div>
      );
    }

    return (
      <Input
        id={`profile-${field.key}`}
        variant="rule"
        value={field.value}
        onChange={(e) => updateValue(field.key, e.target.value)}
      />
    );
  }

  function fallbackFieldOrder(fields: ProfileField[]) {
    const desiredOrder = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "address",
      "country",
      "linkedin",
      "github",
      "veteranStatus",
      "gender",
    ];

    return [...fields].sort((a, b) => {
      const aIndex = desiredOrder.indexOf(a.key);
      const bIndex = desiredOrder.indexOf(b.key);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }

  async function handleSave() {
    await ipc().saveProfile(fields);
    setSaved(true);
  }

  async function refreshSyncInfo() {
    setSync(await ipc().getSyncInfo());
  }

  return (
    <div className="max-w-[860px]">
      <header className="animate-reveal flex flex-col gap-3 border-b border-hairline pb-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
        <h1 className="font-display text-[36px] leading-[0.9] tracking-[-0.015em] text-ink sm:text-[52px]">Profile</h1>
        <p className="max-w-[280px] text-[12px] leading-relaxed text-ink-2 sm:text-right">
          These details fill in application forms through the browser extension.
        </p>
      </header>

      <div className="mt-11 max-w-[440px]">
        {fallbackFieldOrder(fields).map((field, i) => (
          <div
            key={field.key}
            className="animate-reveal mb-7"
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <label htmlFor={`profile-${field.key}`} className="mb-2 block text-[12px] text-ink-2">
              {field.label}
            </label>
            {renderField(field)}
          </div>
        ))}
        <div className="mt-10 flex items-center gap-4">
          <Button variant="ink" onClick={handleSave}>Save profile</Button>
          {saved && <span role="status" className="text-[12px] text-verdigris">Profile saved.</span>}
        </div>

        {/*{bridge && <section className="mt-12 border-t border-hairline pt-7" aria-labelledby="extension-bridge-heading">
          <h2 id="extension-bridge-heading" className="font-display text-[28px] text-ink">Browser extension</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-2">Paste this port and token into the Ghostboard browser extension settings.</p>
          <label className="mt-5 block text-[12px] text-ink-2" htmlFor="bridge-port">Port</label>
          <Input id="bridge-port" variant="rule" readOnly value={String(bridge.port)} />
          <label className="mt-5 block text-[12px] text-ink-2" htmlFor="bridge-token">Bridge token</label>
          <Input id="bridge-token" variant="rule" readOnly value={bridge.token} onFocus={(event) => event.currentTarget.select()} />
          <div className="mt-4 flex items-center gap-4">
            <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(bridge.token).then(() => setCopied(true)); }}>Copy token</Button>
            {copied && <span role="status" className="text-[12px] text-verdigris">Token copied.</span>}
          </div>
        </section>}*/}

        {sync && <section className="mt-12 border-t border-hairline pt-7" aria-labelledby="companion-heading">
          <h2 id="companion-heading" className="font-display text-[28px] text-ink">iPhone companion</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
            Use these details on the iPhone while both devices are on the same Wi-Fi. Mobile sync uses port 4175 by default; port 4173 is only for the browser extension.
          </p>
          {!sync.enabled && <p role="status" className="mt-5 text-[12px] leading-relaxed text-ink-2">
            {sync.error ?? "The iPhone companion channel is disabled."}
          </p>}
          {sync.enabled && sync.addresses.length === 0 && <p role="status" className="mt-5 text-[12px] leading-relaxed text-ink-2">
            No usable LAN address is available. The port and token are still shown below so you can pair an iOS Simulator with a loopback host, or connect this Mac to the same Wi-Fi as the iPhone and refresh.
          </p>}
          {sync.enabled && <>
            {sync.addresses.length > 0 && <>
              <label className="mt-5 block text-[12px] text-ink-2" htmlFor="sync-host">Host</label>
              <Input id="sync-host" variant="rule" readOnly value={sync.addresses[0]} onFocus={(event) => event.currentTarget.select()} />
              {sync.addresses.length > 1 && <p className="mt-2 text-[11px] text-ink-3">Other addresses: {sync.addresses.slice(1).join(", ")}</p>}
            </>}
            <label className="mt-5 block text-[12px] text-ink-2" htmlFor="sync-port">Companion port</label>
            <Input id="sync-port" variant="rule" readOnly value={String(sync.port)} />
            <label className="mt-5 block text-[12px] text-ink-2" htmlFor="sync-token">Pairing token</label>
            <Input id="sync-token" variant="rule" readOnly value={sync.token} onFocus={(event) => event.currentTarget.select()} />
            <div className="mt-4 flex items-center gap-4">
              <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(sync.token).then(() => setSyncCopied(true)); }}>Copy token</Button>
              {syncCopied && <span role="status" className="text-[12px] text-verdigris">Token copied.</span>}
            </div>
          </>}
          <Button className="mt-4" variant="outline" onClick={() => { void refreshSyncInfo(); }}>Refresh addresses</Button>
        </section>}
      </div>
    </div>
  );
}
