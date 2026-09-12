import { useEffect, useRef, useState } from "react";
import type { GmailState, GmailSuggestion } from "@ghostboard/shared";
import { ipc } from "../lib/ipc";
import { Button } from "./ui/button";

function Suggestion({ suggestion, busy, perform }: {
  suggestion: GmailSuggestion;
  busy: boolean;
  perform: (action: () => Promise<GmailState>) => Promise<void>;
}) {
  const [applicationId, setApplicationId] = useState(suggestion.candidates.length === 1 ? suggestion.candidates[0].applicationId : "");
  const selected = suggestion.candidates.find((candidate) => candidate.applicationId === applicationId);
  const applicable = suggestion.newStatus && selected && !["offer", "rejected", suggestion.newStatus].includes(selected.status);
  const statusLabel = suggestion.newStatus === "rejected" ? "Possible rejection"
    : suggestion.newStatus === "interviewing" ? "Possible interview" : "Recruiter message";
  const statusColor = suggestion.newStatus === "rejected" ? "bg-red-100 text-red-800"
    : suggestion.newStatus === "interviewing" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800";
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        <time className="text-xs text-slate-500" dateTime={suggestion.receivedAt}>{new Date(suggestion.receivedAt).toLocaleString()}</time>
      </div>
      <p className="break-words font-medium">{suggestion.subject}</p>
      <p className="mt-1 break-words text-sm text-slate-600"><span className="font-medium text-slate-700">Heard from:</span> {suggestion.sender || "Unknown sender"}</p>
      {suggestion.evidence && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{suggestion.evidence}</p>}
      <p className="mt-1 text-xs text-slate-500">Classifier confidence: {Math.round(suggestion.confidence * 100)}%</p>
      <label className="mt-3 block text-sm font-medium" htmlFor={`gmail-application-${suggestion.id}`}>Matched application</label>
      <select id={`gmail-application-${suggestion.id}`} className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        value={selected ? applicationId : ""} onChange={(event) => setApplicationId(event.target.value)} disabled={busy}>
        <option value="">{suggestion.candidates.length ? "Choose the application this email refers to" : "No matching application remains"}</option>
        {suggestion.candidates.map((candidate) => <option key={candidate.applicationId} value={candidate.applicationId}>{candidate.company} — {candidate.title} ({candidate.status})</option>)}
      </select>
      {selected && suggestion.newStatus && <p className="mt-2 text-sm text-slate-600">Proposed change: {selected.status} → {suggestion.newStatus}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestion.newStatus && <Button disabled={busy || !applicable} onClick={() => { if (selected) void perform(() => ipc().applyGmailSuggestion(suggestion.id, selected.applicationId, selected.updatedAt)); }}>Apply update</Button>}
        <Button variant="outline" disabled={busy} onClick={() => { void perform(() => ipc().dismissGmailSuggestion(suggestion.id)); }}>Dismiss</Button>
      </div>
    </li>
  );
}

export function GmailPanel({ onUpdated, heading = "Gmail status updates" }: { onUpdated: () => void; heading?: string }) {
  const [state, setState] = useState<GmailState | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const busy = working || !!state?.busy;

  async function load() {
    const request = ++generation.current;
    try {
      const result = await ipc().getGmailState();
      if (alive.current && request === generation.current) { setState(result); setError(null); }
    } catch { if (alive.current && request === generation.current) setError("Could not load Gmail settings. Try again."); }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    const refresh = () => { void load(); };
    const interval = window.setInterval(refresh, 10_000);
    window.addEventListener("focus", refresh);
    return () => { alive.current = false; generation.current++; clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, []);

  async function perform(action: () => Promise<GmailState>) {
    setWorking(true);
    setError(null);
    generation.current++;
    try {
      const result = await action();
      if (alive.current) { generation.current++; setState(result); onUpdated(); }
    } catch { if (alive.current) setError("Could not complete the Gmail action. Try again."); }
    finally { if (alive.current) setWorking(false); }
  }

  return (
    <section aria-labelledby="gmail-heading" className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="gmail-heading" className="text-lg font-semibold">{heading}</h2>
        <span className="text-sm text-slate-600">{state?.connected ? `Connected: ${state.account}` : "Not connected"}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">A small language model reviews recent message text for recruiter interview and rejection updates. Review every suggestion before changing a job's stage.</p>
      <p className="mt-2 text-xs text-slate-500">The first check reads up to 50 recent inbox messages from the last 90 days. Later checks follow new mail. Attachments are never downloaded.</p>
      {(error || state?.error) && <p role="alert" className="mt-3 text-sm text-red-800">{error || state?.error}</p>}
      {state?.notice && <p role="status" className="mt-3 text-sm text-slate-700">{state.notice}</p>}
      {!state && !error && <p role="status" className="mt-3 text-sm">Loading Gmail settings…</p>}
      {error && <Button variant="outline" className="mt-2" onClick={() => { void load(); }}>Retry Gmail settings</Button>}
      {state && <>
        <div className="mt-4 flex flex-wrap gap-2">
          {!state.connected && <Button disabled={busy} onClick={() => { void perform(() => ipc().connectGmail()); }}>{state.configured ? "Connect Gmail" : "Choose credentials & connect Gmail"}</Button>}
          {!state.connected && <Button variant="outline" disabled={busy} onClick={() => { void perform(() => ipc().importGmailCredentials()); }}>Import credentials JSON</Button>}
          {state.connected && <Button disabled={busy} onClick={() => { void perform(() => ipc().checkGmail()); }}>{state.hasMore ? "Check next batch" : "Check Gmail"}</Button>}
          {(state.connected || state.configured) && <Button variant="outline" disabled={busy} onClick={() => { void perform(() => ipc().disconnectGmail()); }}>Disconnect & remove local access</Button>}
          {busy && <Button variant="outline" onClick={() => { void ipc().cancelGmail().catch(() => setError("Could not cancel. Please wait for the operation to finish.")); }}>Cancel</Button>}
        </div>
        {busy && <p role="status" className="mt-2 text-sm text-slate-600">Working… If signing in, finish the Google consent screen in your browser.</p>}
        {state.connected && <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.automaticChecks} disabled={busy} onChange={(event) => { const enabled = event.target.checked; void perform(() => ipc().setGmailAutomaticChecks(enabled)); }} />
          Check automatically every 5 minutes while the app is running
        </label>}
        {state.lastCheckedAt && <p className="mt-2 text-xs text-slate-500">Last successful batch: {new Date(state.lastCheckedAt).toLocaleString()}</p>}
        {state.connected && !state.suggestions.length && <p className="mt-3 text-sm text-slate-600">No pending suggestions. Click Check Gmail to look for updates.</p>}
        {!!state.suggestions.length && <>
          <h3 className="mb-2 mt-5 font-semibold">Review suggestions ({state.suggestions.length})</h3>
          <ul className="space-y-3">{state.suggestions.map((suggestion) => <Suggestion key={suggestion.id} suggestion={suggestion} busy={busy} perform={perform} />)}</ul>
        </>}
      </>}
    </section>
  );
}
