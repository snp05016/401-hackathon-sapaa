export const APPLICATION_STAGES = ["found", "applied", "interviewing", "offer", "rejected", "ghosted"] as const;

export const STAGE_LABELS: Record<(typeof APPLICATION_STAGES)[number], string> = {
  found: "Found",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
};

// ponytail: subtle gallows humor per product brief, add more when someone cares
export const STAGE_SUBTITLES: Partial<Record<(typeof APPLICATION_STAGES)[number], string>> = {
  found: "saved in a moment of optimism",
  applied: "sent into the machine",
  interviewing: "talking to actual humans",
  offer: "the rare one",
  rejected: "the corporate void claims another one",
  ghosted: "radio silence since forever",
};

export const STAGE_EMPTY: Partial<Record<(typeof APPLICATION_STAGES)[number], string>> = {
  offer: "reserved for good news",
  ghosted: "nobody's ignoring you yet",
};
