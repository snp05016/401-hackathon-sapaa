import { useEffect, useState } from "react";
import type { JobPosting } from "@ghostboard/shared";
import type { CreateJobResponse } from "@ghostboard/shared";
import { getBridgeSettings, saveBridgeSettings, postJson, checkBridgeHealth } from "../background/bridgeClient";

export function Popup() {
  const [job, setJob] = useState<JobPosting | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [port, setPort] = useState("4173");
  const [token, setToken] = useState("");
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);

  useEffect(() => {
    getBridgeSettings().then((s) => {
      setPort(String(s.port));
      setToken(s.token);
    });
    checkBridgeHealth().then(setBridgeOk);

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return;
      chrome.runtime.sendMessage({ type: "get-detected-job", tabId: tab.id }, (response) => {
        if (response?.job) setJob(response.job as JobPosting);
      });
    });
  }, []);

  async function handleSaveSettings() {
    await saveBridgeSettings({ port: Number(port), token });
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
      setStatus("Saved to Ghostboard!");
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
          <button onClick={handleSaveJob} style={{ marginTop: 8 }}>
            Save Job
          </button>
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
        <input
          placeholder="Token (copy from desktop app's Profile page)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button onClick={handleSaveSettings}>Save Settings</button>
      </div>
    </div>
  );
}
