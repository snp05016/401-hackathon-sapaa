/**
 * Dev seed script. Run with `npm run db:seed` from the repo root.
 * Targets ./dev.db by default; override with GHOSTBOARD_DB_PATH.
 */
import { createDb, runMigrations, applications, applicationEvents } from "@ghostboard/database";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.GHOSTBOARD_DB_PATH ?? path.join(__dirname, "..", "dev.db");
const migrationsFolder = path.join(__dirname, "..", "packages", "database", "migrations");

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString().slice(0, 10);

const seedApplications: Array<typeof applications.$inferInsert> = [
  {
    id: crypto.randomUUID(),
    company: "Acme Corp",
    title: "Senior Frontend Engineer",
    location: "Remote",
    jobUrl: "https://acme.example.com/careers/frontend",
    jobDescription: "Build React + TypeScript apps.",
    status: "found",
    dateFound: daysAgo(1),
    dateApplied: null,
    deadline: inDays(1),
    lastActivityAt: daysAgo(1),
    nextAction: null,
    nextActionDate: null,
    resumeId: null,
    source: "manual",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: crypto.randomUUID(),
    company: "Globex",
    title: "Backend Engineer",
    location: "New York, NY",
    jobUrl: "https://globex.example.com/jobs/1",
    jobDescription: "Node.js + Postgres services.",
    status: "applied",
    dateFound: daysAgo(10),
    dateApplied: daysAgo(9),
    lastActivityAt: daysAgo(9),
    nextAction: "Follow up",
    nextActionDate: daysAgo(-5),
    resumeId: null,
    source: "extension",
    createdAt: daysAgo(10),
    updatedAt: daysAgo(9),
  },
  {
    id: crypto.randomUUID(),
    company: "Initech",
    title: "Full Stack Engineer",
    location: "Austin, TX",
    jobUrl: "https://initech.example.com/jobs/2",
    jobDescription: "React + Django.",
    status: "interviewing",
    dateFound: daysAgo(20),
    dateApplied: daysAgo(18),
    lastActivityAt: daysAgo(2),
    nextAction: "Onsite interview",
    nextActionDate: daysAgo(-3),
    resumeId: null,
    source: "extension",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(2),
  },
  {
    id: crypto.randomUUID(),
    company: "Umbrella Inc",
    title: "Platform Engineer",
    location: "Remote",
    jobUrl: "https://umbrella.example.com/jobs/3",
    jobDescription: "Kubernetes + Go.",
    status: "rejected",
    dateFound: daysAgo(30),
    dateApplied: daysAgo(28),
    lastActivityAt: daysAgo(15),
    nextAction: null,
    nextActionDate: null,
    resumeId: null,
    source: "manual",
    createdAt: daysAgo(30),
    updatedAt: daysAgo(15),
  },
  {
    id: crypto.randomUUID(),
    company: "Soylent Co",
    title: "Data Engineer",
    location: "San Francisco, CA",
    jobUrl: "https://soylent.example.com/jobs/4",
    jobDescription: "Spark + Airflow pipelines.",
    status: "ghosted",
    dateFound: daysAgo(45),
    dateApplied: daysAgo(40),
    lastActivityAt: daysAgo(40),
    nextAction: null,
    nextActionDate: null,
    resumeId: null,
    source: "manual",
    createdAt: daysAgo(45),
    updatedAt: daysAgo(40),
  },
  {
    id: crypto.randomUUID(),
    company: "Vandelay Industries",
    title: "Senior Product Manager",
    location: "New York, NY",
    jobUrl: "https://vandelay.example.com/jobs/5",
    jobDescription: "Own the roadmap for the latex export tooling.",
    status: "applied",
    dateFound: daysAgo(15),
    dateApplied: daysAgo(14),
    lastActivityAt: daysAgo(14),
    nextAction: "Follow up on application",
    nextActionDate: daysAgo(-1),
    resumeId: null,
    source: "manual",
    createdAt: daysAgo(15),
    updatedAt: daysAgo(14),
  },
  {
    id: crypto.randomUUID(),
    company: "Hooli",
    title: "Distributed Systems Engineer",
    location: "Palo Alto, CA",
    jobUrl: "https://hooli.example.com/jobs/6",
    jobDescription: "Reliability across the message bus.",
    status: "interviewing",
    dateFound: daysAgo(20),
    dateApplied: daysAgo(18),
    lastActivityAt: daysAgo(7),
    nextAction: "Follow up on interview",
    nextActionDate: daysAgo(-2),
    resumeId: null,
    source: "extension",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(7),
  },
];

async function main(): Promise<void> {
  const db = createDb(dbPath);
  await runMigrations(db, migrationsFolder);

  for (const app of seedApplications) {
    await db.insert(applications).values(app);
  }

  await db.insert(applicationEvents).values([
    {
      id: crypto.randomUUID(),
      applicationId: seedApplications[1]!.id,
      type: "created",
      title: "Application created",
      description: null,
      occurredAt: seedApplications[1]!.createdAt,
      metadata: null,
    },
    {
      id: crypto.randomUUID(),
      applicationId: seedApplications[2]!.id,
      type: "stage_changed",
      title: "Moved to Interviewing",
      description: "Recruiter scheduled a call.",
      occurredAt: seedApplications[2]!.lastActivityAt,
      metadata: { fromStage: "applied", toStage: "interviewing" },
    },
  ]);

  console.log(`Seeded ${seedApplications.length} applications into ${dbPath}`);
}

main();
