import { summarizeToday } from "@ghostboard/tracking";
import { useApplications } from "../lib/useApplications";
import { Button } from "../components/ui/button";

function Figure({ count, label, accent, delay }: { count: number; label: string; accent: string; delay: number }) {
  return (
    <div className="animate-reveal px-7 first:pl-0 last:pr-0" style={{ animationDelay: `${delay}ms` }}>
      <div className={`tnum font-display text-[64px] leading-[0.85] ${accent}`}>{count}</div>
      <div className="mt-3 text-[12px] text-ink-2">{label}</div>
    </div>
  );
}

export function Today() {
  const { applications, error, now, reload } = useApplications();
  const counts = summarizeToday(applications ?? [], now);

  return (
    <div className="max-w-[980px]">
      <header className="animate-reveal">
        <p className="text-[12px] text-ink-2">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="mt-1 font-display text-[88px] leading-[0.88] tracking-[-0.02em] text-ink">Today</h1>
      </header>

      {error && (
        <div role="alert" className="mt-8 flex items-center gap-4 border-l-2 border-oxblood pl-4 text-[13px] text-ink">
          {error}
          <Button variant="quiet" onClick={reload}>Retry</Button>
        </div>
      )}
      {!applications && !error && <p role="status" className="mt-8 text-[13px] text-ink-2">Loading saved jobs…</p>}

      {applications && (
        <>
          <section className="mt-14">
            <div className="flex items-baseline justify-between gap-10 border-b border-hairline pb-3">
              <h2 className="font-display text-[26px] leading-none text-ink">Application deadlines</h2>
              <p className="max-w-[300px] text-right text-[12px] leading-relaxed text-ink-2">
                Jobs in Found that still need an application. Set their deadlines in Tracking.
              </p>
            </div>
            <div className="mt-9 flex divide-x divide-hairline">
              <Figure count={counts.dueToday} label="Due today" accent="text-oxblood" delay={80} />
              <Figure count={counts.upcoming} label="Due in the next 7 days" accent="text-ink" delay={160} />
              <Figure count={counts.overdue} label="Overdue" accent="text-oxblood" delay={240} />
            </div>
            <p className="mt-8 text-[12px] text-ink-2">
              {counts.noDeadline} {counts.noDeadline === 1 ? "job has" : "jobs have"} no deadline set.
            </p>
            {applications.length === 0 && (
              <p className="mt-7 max-w-[560px] border-y border-dashed border-hairline py-7 font-display text-[22px] leading-snug text-ink-2">
                Nothing here yet. Save a job with the browser extension and it lands in Found.
              </p>
            )}
          </section>

          <section className="mt-20 ml-auto w-[78%] animate-reveal" style={{ animationDelay: "320ms" }}>
            <h2 className="border-b border-hairline pb-3 font-display text-[26px] leading-none text-ink">
              Application overview
            </h2>
            <div className="mt-8 flex divide-x divide-hairline">
              <Figure count={counts.total} label="Total applications" accent="text-ink" delay={380} />
              <Figure count={counts.applied} label="Applied" accent="text-ink" delay={440} />
              <Figure count={counts.interviewing} label="Interviewing" accent="text-brass" delay={500} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
