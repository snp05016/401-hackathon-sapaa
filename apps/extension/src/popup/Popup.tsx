import { useEffect, useState } from "react";
import type { JobPosting } from "@ghostboard/shared";
import type { CreateJobResponse } from "@ghostboard/shared";
import { getBridgeSettings, saveBridgeSettings, postJson, checkBridgeHealth } from "../background/bridgeClient";

const SAVED_JOBS_KEY = "ghostboardSavedJobs";

interface SavedJobMarker {
  fingerprint: string;
  title: string;
  company: string;
  savedAt: string;
}

async function readSavedJobs(): Promise<SavedJobMarker[]> {
  const stored = await chrome.storage.local.get(SAVED_JOBS_KEY);
  return Array.isArray(stored[SAVED_JOBS_KEY]) ? (stored[SAVED_JOBS_KEY] as SavedJobMarker[]) : [];
}

async function markJobSaved(job: JobPosting): Promise<void> {
  const current = await readSavedJobs();
  const next = [
    ...current.filter((item) => item.fingerprint !== job.fingerprint),
    { fingerprint: job.fingerprint, title: job.title, company: job.company, savedAt: new Date().toISOString() },
  ];
  await chrome.storage.local.set({ [SAVED_JOBS_KEY]: next });
}

async function notifySavedJob(job: JobPosting): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    chrome.tabs.sendMessage(
      tab.id,
      { type: "job-saved", title: job.title, company: job.company },
      () => { void chrome.runtime.lastError; },
    );
  } catch {
    // The save already succeeded; the page celebration is best-effort.
  }
}

export function Popup() {
  const [job, setJob] = useState<JobPosting | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [port, setPort] = useState("4173");
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);

  useEffect(() => {
    getBridgeSettings().then((s) => {
      setPort(String(s.port));
    });
    checkBridgeHealth().then(setBridgeOk);

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return;
      chrome.tabs.sendMessage(tab.id, { type: "get-current-job" }, (liveResponse) => {
        if (liveResponse?.job) {
          setJob(liveResponse.job as JobPosting);
          return;
        }
        void chrome.runtime.lastError;
        chrome.runtime.sendMessage({ type: "get-detected-job", tabId: tab.id }, (cachedResponse) => {
          if (cachedResponse?.job) setJob(cachedResponse.job as JobPosting);
        });
      });
    });
  }, []);

  useEffect(() => {
    if (!job) {
      setIsSaved(false);
      setJustSaved(false);
      return;
    }
    setJustSaved(false);
    let cancelled = false;
    readSavedJobs().then((markers) => {
      if (!cancelled) setIsSaved(markers.some((item) => item.fingerprint === job.fingerprint));
    });
    return () => {
      cancelled = true;
    };
  }, [job]);

  async function handleSaveSettings() {
    await saveBridgeSettings({ port: Number(port) });
    setBridgeOk(await checkBridgeHealth());
  }

  async function handleSaveJob() {
    if (!job) return;
    setStatus("Saving…");
    try {
      await postJson<CreateJobResponse>("/jobs", {
        id: job.id,
        fingerprint: job.fingerprint,
        contentFingerprint: job.contentFingerprint,
        company: job.company,
        title: job.title,
        location: job.location,
        jobUrl: job.jobUrl,
        jobDescription: job.jobDescription,
        source: job.source,
        sourceJobId: job.sourceJobId,
        employmentType: job.employmentType,
        requirements: job.requirements,
        keywords: job.keywords,
        postedAt: job.postedAt,
        salaryRange: job.salaryRange,
        scrapedAt: job.scrapedAt,
      });
      await markJobSaved(job);
      setIsSaved(true);
      setJustSaved(true);
      setStatus("Saved job");
      void notifySavedJob(job);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleAutofill(mode: "master" | "tailored") {
    setStatus(mode === "tailored" ? "Tailoring resume and autofilling…" : "Autofilling from master resume…");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus("No active tab available.");
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "trigger-autofill", mode }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus("Autofill is unavailable on this page.");
        return;
      }
      if (response?.error) {
        setStatus(response.error);
        return;
      }
      if (response?.filled?.length) {
        setStatus(`Filled ${response.filled.length} fields`);
        return;
      }
      setStatus("No matching profile fields were filled.");
    });
  }

  return (
    <div className="popup">
      <h1>👻 Ghostboard</h1>

      {job ? (
        <div className="card">
          <strong>{job.title}</strong>
          <div>{job.company}</div>
          {isSaved ? (
            <div style={{ marginTop: 8, color: "#166534", fontWeight: 600 }}>
              {justSaved ? "Saved job" : "Already saved"}
            </div>
          ) : (
            <button onClick={handleSaveJob} style={{ marginTop: 8 }}>
              Save Job
            </button>
          )}
        </div>
      ) : (
        <div className="empty">No job detected on this page. Master autofill is still available.</div>
      )}
      <div className="autofill-actions">
        <button onClick={() => void handleAutofill("tailored")}>Autofill with tailored resume</button>
        <button className="secondary" onClick={() => void handleAutofill("master")}>Autofill from master resume</button>
        <div className="autofill-note">Tailored autofill uses the latest job detected by the extension.</div>
      </div>
      {status && <div className="status">{status}</div>}

      <div className="settings" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 4, fontWeight: 600 }}>
          Bridge {bridgeOk === null ? "" : bridgeOk ? "🟢 connected" : "🔴 unreachable"}
        </div>
        <input placeholder="Port (default 4173)" value={port} onChange={(e) => setPort(e.target.value)} />
        <button onClick={handleSaveSettings}>Save Settings</button>
      </div>
    </div>
  );
}
