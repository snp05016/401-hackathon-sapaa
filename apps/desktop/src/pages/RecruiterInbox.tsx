import { GmailPanel } from "../components/GmailPanel";
import { Reveal } from "../components/motion";

export function RecruiterInbox() {
  return (
    <div className="mx-auto max-w-[1080px]">
      <Reveal as="header" className="flex flex-col gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
        <div>
          <p className="mb-3 text-[10px] uppercase tracking-[0.18em] text-oxblood">Signals from your search</p>
          <h1 className="font-display text-[40px] leading-[0.9] tracking-[-0.02em] text-ink sm:text-[54px]">Recruiter inbox</h1>
        </div>
        <p className="max-w-[390px] text-[12px] leading-relaxed text-ink-2 sm:text-right">
          See who reached out, what changed, and which application the message belongs to—without turning your inbox into another dashboard.
        </p>
      </Reveal>
      <GmailPanel heading="Recent recruiter messages" onUpdated={() => {}} />
    </div>
  );
}
