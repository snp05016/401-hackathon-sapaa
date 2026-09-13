import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  location: text("location"),
  jobUrl: text("job_url").notNull(),
  jobDescription: text("job_description").notNull().default(""),
  status: text("status", { enum: ["found", "applied", "interviewing", "offer", "rejected", "ghosted"] })
    .notNull()
    .default("found"),
  dateFound: text("date_found").notNull(),
  dateApplied: text("date_applied"),
  deadline: text("deadline"),
  lastActivityAt: text("last_activity_at").notNull(),
  followUpOn: integer("follow_up_on", { mode: "boolean" }).notNull().default(false),
  followUpDismissedAt: text("follow_up_dismissed_at"),
  nextAction: text("next_action"),
  nextActionDate: text("next_action_date"),
  resumeId: text("resume_id"),
  source: text("source").notNull().default("manual"),
  // ponytail: one JSON blob, not nine sparse columns. Split it out if any of
  // these ever needs an index or a WHERE clause.
  jobDetails: text("job_details", { mode: "json" }).$type<import("@ghostboard/shared").JobDetails>(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const applicationEvents = sqliteTable("application_events", {
  id: text("id").primaryKey(),
  applicationId: text("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["created", "stage_changed", "email_received", "note_added", "reminder_set", "resume_attached"],
  }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  occurredAt: text("occurred_at").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown> | null>(),
});

export const applicationsRelations = relations(applications, ({ many }) => ({ events: many(applicationEvents) }));
export const applicationEventsRelations = relations(applicationEvents, ({ one }) => ({
  application: one(applications, { fields: [applicationEvents.applicationId], references: [applications.id] }),
}));

export const gmailSuggestions = sqliteTable("gmail_suggestions", {
  id: text("id").primaryKey(),
  account: text("account").notNull(),
  messageId: text("message_id").notNull(),
  suggestion: text("suggestion", { mode: "json" }).$type<import("@ghostboard/shared").GmailSuggestion>().notNull(),
  decision: text("decision", { enum: ["pending", "applied", "dismissed"] }).notNull().default("pending"),
});

export const gmailSync = sqliteTable("gmail_sync", {
  account: text("account").primaryKey(),
  historyId: text("history_id"),
  nextHistoryId: text("next_history_id"),
  pendingIds: text("pending_ids", { mode: "json" }).$type<string[]>().notNull(),
  pageToken: text("page_token"),
  lastCheckedAt: text("last_checked_at"),
});
