import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ProfileField } from "@ghostboard/shared";
import { ipc } from "../lib/ipc";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { DrawRule, Reveal, Stagger, StaggerItem } from "../components/motion";
import { DISTANCE, DURATION, EASE, SPRING, STAGGER, TRANSITION } from "../lib/motion";
import { playSound } from "../lib/sound";

const VETERAN_OPTIONS = ["Yes", "No", "Prefer not to say"];

export function Profile() {
  const [fields, setFields] = useState<ProfileField[]>([]);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorNonce, setSaveErrorNonce] = useState(0);
  const [bridge, setBridge] = useState<{ port: number; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ipc()
      .getProfile()
      .then((p) => setFields(p.fields));
    ipc().getBridgeInfo().then(setBridge);
  }, []);

  function updateValue(key: string, value: string) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
    setSaved(false);
    setSaveError(null);
  }

  function renderField(field: ProfileField) {
    if (field.key === "veteranStatus") {
      return (
        <div className="flex flex-wrap gap-3 pt-1">
          {VETERAN_OPTIONS.map((option) => {
            const checked = field.value === option;
            return (
              <motion.label
                key={option}
                className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-2"
                whileHover={{ x: 2, transition: SPRING.hover }}
                whileTap={{ scale: 0.975, transition: SPRING.press }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => updateValue(field.key, option)}
                />
                {option}
              </motion.label>
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
    setSaveError(null);
    try {
      await ipc().saveProfile(fields);
      setSaved(true);
      playSound("success");
    } catch (error) {
      setSaved(false);
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : "Could not save your profile. Please try again.",
      );
      setSaveErrorNonce((nonce) => nonce + 1);
      playSound("error");
    }
  }

  return (
    <div className="max-w-[860px]">
      <Reveal as="header">
        <div className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-10">
          <h1 className="font-display text-[36px] leading-[0.9] tracking-[-0.015em] text-ink sm:text-[52px]">Profile</h1>
          <p className="max-w-[280px] text-[12px] leading-relaxed text-ink-2 sm:text-right">
            These details fill in application forms through the browser extension.
          </p>
        </div>
        <DrawRule delay={0.12} />
      </Reveal>

      <div className="mt-11 max-w-[440px]">
        <Stagger key={fields.length > 0 ? "loaded" : "empty"} gap={STAGGER.list} lead={STAGGER.lead}>
          {fallbackFieldOrder(fields).map((field) => (
            <StaggerItem key={field.key} className="mb-7">
              <label htmlFor={`profile-${field.key}`} className="mb-2 block text-[12px] text-ink-2">
                {field.label}
              </label>
              {renderField(field)}
            </StaggerItem>
          ))}
        </Stagger>
        <div className="mt-10 flex items-center gap-4">
          <Button variant="ink" silent onClick={() => void handleSave()}>Save profile</Button>
          <AnimatePresence initial={false} mode="wait">
            {saved && (
              <motion.span
                key="saved"
                role="status"
                className="text-[12px] text-verdigris"
                initial={{ opacity: 0, scale: 0.9, y: DISTANCE.riseSmall }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, transition: TRANSITION.exit }}
                transition={SPRING.overshoot}
              >
                Profile saved.
              </motion.span>
            )}
            {saveError && (
              <motion.span
                key={`save-error-${saveErrorNonce}`}
                role="alert"
                className="text-[12px] text-oxblood"
                initial={{ opacity: 0, y: DISTANCE.riseSmall }}
                animate={{ opacity: 1, y: 0, x: [0, -4, 4, -3, 0] }}
                exit={{ opacity: 0, transition: TRANSITION.exit }}
                transition={{
                  ...TRANSITION.base,
                  x: { duration: DURATION.base, ease: EASE.out },
                }}
              >
                {saveError}
              </motion.span>
            )}
          </AnimatePresence>
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
      </div>
    </div>
  );
}
