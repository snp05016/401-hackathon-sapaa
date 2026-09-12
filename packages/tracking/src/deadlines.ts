import type { Application } from "@ghostboard/shared";

export interface DeadlineStatus {
  color: "green" | "yellow" | "red" | "none";
  daysRemaining: number | null;
  label: string;
}

export function isValidDeadline(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function evaluateDeadline(deadline: string | null | undefined, now: Date = new Date()): DeadlineStatus {
  if (!deadline) return { color: "none", daysRemaining: null, label: "No deadline" };
  if (!isValidDeadline(deadline)) return { color: "none", daysRemaining: null, label: "Invalid deadline" };

  // Compare calendar dates, not elapsed hours, so DST and time of day cannot shift a deadline.
  const today = new Date(0);
  today.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  today.setUTCHours(0, 0, 0, 0);
  const daysRemaining = Math.round((Date.parse(`${deadline}T00:00:00.000Z`) - today.getTime()) / 86_400_000);
  const color = daysRemaining >= 7 ? "green" : daysRemaining >= 2 ? "yellow" : "red";
  const label = daysRemaining < 0
    ? `${Math.abs(daysRemaining)} ${daysRemaining === -1 ? "day" : "days"} overdue`
    : daysRemaining === 0 ? "Due today"
    : daysRemaining === 1 ? "Due tomorrow"
    : `Due in ${daysRemaining} days`;
  return { color, daysRemaining, label };
}

export function summarizeToday(applications: Application[], now: Date = new Date()) {
  const counts = {
    total: applications.length,
    applied: 0,
    interviewing: 0,
    dueToday: 0,
    upcoming: 0,
    overdue: 0,
    noDeadline: 0,
  };
  for (const application of applications) {
    if (application.status === "applied") counts.applied++;
    if (application.status === "interviewing") counts.interviewing++;
    if (application.status !== "found") continue;
    const { daysRemaining } = evaluateDeadline(application.deadline, now);
    if (daysRemaining === null) counts.noDeadline++;
    else if (daysRemaining === 0) counts.dueToday++;
    else if (daysRemaining < 0) counts.overdue++;
    else if (daysRemaining <= 7) counts.upcoming++;
  }
  return counts;
}
