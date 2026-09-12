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
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Profile</h1>
      <div className="max-w-md space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-xs font-medium text-slate-600">{field.label}</label>
            <Input value={field.value} onChange={(e) => updateValue(field.key, e.target.value)} />
          </div>
        ))}
        <Button onClick={handleSave}>Save</Button>
        {saved && <span className="ml-2 text-sm text-green-600">Saved</span>}
      </div>
    </div>
  );
}
