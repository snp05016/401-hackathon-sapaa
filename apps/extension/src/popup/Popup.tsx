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
      chrome.runtime.sendMessage({ type: "get-detected-job", tabId: tab.id }, (response) => {
        if (response?.job) setJob(response.job as JobPosting);
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
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save");
    }
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
        <div className="empty">No job detected on this page yet.</div>
      )}
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
