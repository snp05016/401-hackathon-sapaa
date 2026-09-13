/**
 * Development seed script. Run with `npm run db:seed` from the repo root.
 *
 * Postings use live, official career-page links. Activity is synthetic and
 * represents a fictional applicant; it must not be mistaken for recruiting data.
 * Targets ./dev.db by default; override with GHOSTBOARD_DB_PATH.
 */
import { applicationEvents, applications, createDb, runMigrations } from "@ghostboard/database";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.GHOSTBOARD_DB_PATH ?? path.join(__dirname, "..", "dev.db");
const migrationsFolder = path.join(__dirname, "..", "packages", "database", "migrations");

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);

const seedApplications: Array<typeof applications.$inferInsert> = [
  {
    id: "seed-stripe-data",
    company: "Stripe",
    title: "Backend Engineer, Data",
    location: "Canada",
    jobUrl: "https://stripe.com/jobs/search?gh_jid=7913700",
    jobDescription: "Build data engineering and data application tooling that helps Stripe teams move, store, process, and analyze data.",
    status: "applied",
    dateFound: daysAgo(18),
    dateApplied: daysAgo(16),
    deadline: null,
    lastActivityAt: daysAgo(16),
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: "Send a concise follow-up",
    nextActionDate: inDays(1),
    resumeId: null,
    source: "extension:greenhouse",
    createdAt: daysAgo(18),
    updatedAt: daysAgo(16),
  },
  {
    id: "seed-brex-backend",
    company: "Brex",
    title: "Software Engineer II, Backend",
    location: "Vancouver, British Columbia, Canada",
    jobUrl: "https://www.brex.com/careers/8603327002?gh_jid=8603327002",
    jobDescription: "Develop backend services for Brex's finance platform, which combines corporate cards, banking, spend management, bill pay, and travel software.",
    status: "applied",
    dateFound: daysAgo(7),
    dateApplied: daysAgo(5),
    deadline: null,
    lastActivityAt: daysAgo(3),
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: "Review the role requirements",
    nextActionDate: null,
    resumeId: null,
    source: "extension:greenhouse",
    createdAt: daysAgo(7),
    updatedAt: daysAgo(3),
  },
  {
    id: "seed-lyft-android",
    company: "Lyft",
    title: "Android Software Engineer, Lyft Urban Solutions",
    location: "Montreal, Canada",
    jobUrl: "https://app.careerpuck.com/job-board/lyft/job/8743513002?gh_jid=8743513002",
    jobDescription: "Build Android experiences for bike-share and scooter-share systems that serve riders in cities around the world.",
    status: "interviewing",
    dateFound: daysAgo(27),
    dateApplied: daysAgo(24),
    deadline: null,
    lastActivityAt: daysAgo(1),
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: "Prepare for the technical interview",
    nextActionDate: inDays(2),
    resumeId: null,
    source: "extension:greenhouse",
    createdAt: daysAgo(27),
    updatedAt: daysAgo(1),
  },
  {
    id: "seed-mongodb-search",
    company: "MongoDB",
    title: "Software Engineer 3, Atlas Search Systems",
    location: "Toronto, Canada",
    jobUrl: "https://www.mongodb.com/careers/job/?gh_jid=7662950",
    jobDescription: "Build distributed systems for Atlas Search index ingestion, construction, partitioning, performance, availability, and backup management.",
    status: "found",
    dateFound: daysAgo(2),
    dateApplied: null,
    deadline: inDays(3),
    lastActivityAt: daysAgo(2),
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: "Tailor resume for distributed systems work",
    nextActionDate: inDays(1),
    resumeId: null,
    source: "jobspy:linkedin",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: "seed-ripple-platform",
    company: "Ripple",
    title: "Software Engineer II, Platform",
    location: "Toronto, Canada",
    jobUrl: "https://ripple.com/careers/all-jobs/job/8157490?gh_jid=8157490",
    jobDescription: "Contribute to platform engineering for financial infrastructure that moves value across institutions, businesses, governments, and developers.",
    status: "interviewing",
    dateFound: daysAgo(34),
    dateApplied: daysAgo(31),
    deadline: null,
    lastActivityAt: daysAgo(4),
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: "Send availability for the next interview",
    nextActionDate: inDays(1),
    resumeId: null,
    source: "extension:greenhouse",
    createdAt: daysAgo(34),
    updatedAt: daysAgo(4),
  },
  {
    id: "seed-instacart-finance",
    company: "Instacart",
    title: "Senior Data Engineer II, Finance",
    location: "Remote, Canada",
    jobUrl: "https://instacart.careers/job/?gh_jid=8126023",
    jobDescription: "Build finance data systems for a grocery technology platform serving customers, retailers, brands, and shoppers.",
    status: "applied",
    dateFound: daysAgo(22),
    dateApplied: daysAgo(20),
    deadline: null,
    lastActivityAt: daysAgo(20),
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: "Decide whether to follow up",
    nextActionDate: inDays(1),
    resumeId: null,
    source: "jobspy:indeed",
    createdAt: daysAgo(22),
    updatedAt: daysAgo(20),
  },
  {
    id: "seed-robinhood-devx",
    company: "Robinhood",
    title: "Senior Software Developer, Developer Experience",
    location: "Toronto, Canada",
    jobUrl: "https://boards.greenhouse.io/robinhood/jobs/8083818?t=gh_src=&gh_jid=8083818",
    jobDescription: "Improve the developer experience for teams building financial products that make participation in the financial system more accessible.",
    status: "rejected",
    dateFound: daysAgo(48),
    dateApplied: daysAgo(45),
    deadline: null,
    lastActivityAt: daysAgo(12),
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: null,
    nextActionDate: null,
    resumeId: null,
    source: "extension:greenhouse",
    createdAt: daysAgo(48),
    updatedAt: daysAgo(12),
  },
  {
    id: "seed-lyft-data-intern",
    company: "Lyft",
    title: "Data Engineer Intern (Summer 2027)",
    location: "Toronto, Canada",
    jobUrl: "https://app.careerpuck.com/job-board/lyft/job/8797376002?gh_jid=8797376002",
    jobDescription: "Own a data engineering project alongside experienced engineers and contribute to products that reach Lyft users.",
    status: "found",
    dateFound: daysAgo(1),
    dateApplied: null,
    deadline: inDays(6),
    lastActivityAt: daysAgo(1),
    followUpOn: false,
    followUpDismissedAt: null,
    nextAction: "Compare internship eligibility and apply",
    nextActionDate: inDays(2),
    resumeId: null,
    source: "jobspy:linkedin",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];

const seedEvents: Array<typeof applicationEvents.$inferInsert> = [
  ["seed-stripe-data", "created", "Saved from the Stripe careers page", null, 18],
  ["seed-stripe-data", "resume_attached", "Attached tailored backend resume", "Synthetic activity for the development fixture.", 17],
  ["seed-stripe-data", "stage_changed", "Moved to Applied", "Application submitted by the fictional seed user.", 16],
  ["seed-brex-backend", "created", "Saved from the Brex careers page", null, 7],
  ["seed-brex-backend", "resume_attached", "Attached backend resume", "Synthetic activity for the development fixture.", 6],
  ["seed-brex-backend", "stage_changed", "Moved to Applied", "Application submitted by the fictional seed user.", 5],
  ["seed-brex-backend", "note_added", "Saved application note", "Review service ownership and API design examples before a recruiter conversation.", 3],
  ["seed-lyft-android", "created", "Saved from the Lyft careers page", null, 27],
  ["seed-lyft-android", "stage_changed", "Moved to Applied", "Application submitted by the fictional seed user.", 24],
  ["seed-lyft-android", "email_received", "Interview availability requested", "Synthetic recruiter message in the development fixture.", 3],
  ["seed-lyft-android", "stage_changed", "Moved to Interviewing", "The fictional user confirmed their interview availability.", 1],
  ["seed-mongodb-search", "created", "Saved from LinkedIn discovery", null, 2],
  ["seed-mongodb-search", "note_added", "Saved role notes", "Strong match for search infrastructure and distributed systems interests.", 2],
  ["seed-ripple-platform", "created", "Saved from the Ripple careers page", null, 34],
  ["seed-ripple-platform", "stage_changed", "Moved to Applied", "Application submitted by the fictional seed user.", 31],
  ["seed-ripple-platform", "email_received", "Recruiter screen completed", "Synthetic recruiter message in the development fixture.", 4],
  ["seed-ripple-platform", "stage_changed", "Moved to Interviewing", "The fictional user advanced after a recruiter conversation.", 4],
  ["seed-instacart-finance", "created", "Saved from Indeed discovery", null, 22],
  ["seed-instacart-finance", "stage_changed", "Moved to Applied", "Application submitted by the fictional seed user.", 20],
  ["seed-robinhood-devx", "created", "Saved from the Robinhood careers page", null, 48],
  ["seed-robinhood-devx", "stage_changed", "Moved to Applied", "Application submitted by the fictional seed user.", 45],
  ["seed-robinhood-devx", "email_received", "Application update received", "Synthetic outcome recorded for the development fixture.", 12],
  ["seed-robinhood-devx", "stage_changed", "Moved to Rejected", "Explicit outcome recorded; rejection is never inferred from silence.", 12],
  ["seed-lyft-data-intern", "created", "Saved from LinkedIn discovery", null, 1],
];

async function main(): Promise<void> {
  const db = createDb(dbPath);
  await runMigrations(db, migrationsFolder);

  await db.transaction(async (transaction) => {
    await transaction.delete(applicationEvents);
    await transaction.delete(applications);
    await transaction.insert(applications).values(seedApplications);
    await transaction.insert(applicationEvents).values(
      seedEvents.map(([applicationId, type, title, description, days]) => ({
        id: crypto.randomUUID(),
        applicationId,
        type: type as typeof applicationEvents.$inferInsert.type,
        title,
        description,
        occurredAt: daysAgo(days),
        metadata: { fixture: true },
      }))
    );
  });

  console.log(`Seeded ${seedApplications.length} applications and ${seedEvents.length} events into ${dbPath}`);
}

main();
