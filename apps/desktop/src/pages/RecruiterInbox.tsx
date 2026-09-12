import { GmailPanel } from "../components/GmailPanel";

export function RecruiterInbox() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-2xl font-semibold">Recruiter inbox</h1>
      <p className="mb-4 text-sm text-slate-600">
        A condensed view of recruiting messages, who contacted you, and the application status they may affect.
      </p>
      <GmailPanel heading="Recent recruiter messages" onUpdated={() => {}} />
    </div>
  );
}
