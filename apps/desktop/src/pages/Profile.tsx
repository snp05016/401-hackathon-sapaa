import { useEffect, useState } from "react";
import type { ProfileField } from "@ghostboard/shared";
import { ipc } from "../lib/ipc";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export function Profile() {
  const [fields, setFields] = useState<ProfileField[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    ipc()
      .getProfile()
      .then((p) => setFields(p.fields));
  }, []);

  function updateValue(key: string, value: string) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
    setSaved(false);
  }

  async function handleSave() {
    await ipc().saveProfile(fields);
    setSaved(true);
  }

  return (
    <div className="max-w-[860px]">
      <header className="animate-reveal flex items-baseline justify-between gap-10 border-b border-hairline pb-3">
        <h1 className="font-display text-[52px] leading-[0.9] tracking-[-0.015em] text-ink">Profile</h1>
        <p className="max-w-[280px] text-right text-[12px] leading-relaxed text-ink-2">
          These details fill in application forms through the browser extension.
        </p>
      </header>

      <div className="mt-11 max-w-[440px]">
        {fields.map((field, i) => (
          <div
            key={field.key}
            className="animate-reveal mb-7"
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <label htmlFor={`profile-${field.key}`} className="mb-2 block text-[12px] text-ink-2">
              {field.label}
            </label>
            <Input
              id={`profile-${field.key}`}
              variant="rule"
              value={field.value}
              onChange={(e) => updateValue(field.key, e.target.value)}
            />
          </div>
        ))}
        <div className="mt-10 flex items-center gap-4">
          <Button variant="ink" onClick={handleSave}>Save profile</Button>
          {saved && <span role="status" className="text-[12px] text-verdigris">Profile saved.</span>}
        </div>
      </div>
    </div>
  );
}
