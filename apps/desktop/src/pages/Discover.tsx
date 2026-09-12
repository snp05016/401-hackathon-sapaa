import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, Check, Clock3, Compass, FileText, LoaderCircle, MapPin, RotateCcw, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import type { DiscoveredJob, DiscoverSearchRequest, DiscoverSite } from "../../electron/preload";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ipc } from "../lib/ipc";
import { cn } from "../lib/utils";

const PREFERENCES_KEY = "discover-preferences-v2";
const SITES: Array<{ id: DiscoverSite; label: string }> = [
  { id: "linkedin", label: "LinkedIn" }, { id: "indeed", label: "Indeed" },
  { id: "glassdoor", label: "Glassdoor" }, { id: "google", label: "Google Jobs" },
  { id: "zip_recruiter", label: "ZipRecruiter" },
];
const JOB_TYPES = [
  { id: "", label: "Any type" }, { id: "fulltime", label: "Full-time" },
  { id: "parttime", label: "Part-time" }, { id: "contract", label: "Contract" },
  { id: "internship", label: "Internship" },
] as const;

interface DiscoverPreferences {
  role: string;
  alternateTitles: string;
  experienceLevel: string;
  requiredSkills: string;
  preferredSkills: string;
  preferredIndustries: string;
  excludedKeywords: string;
  location: string;
  countryIndeed: string;
  distance: number;
  workplace: "any" | "remote";
  jobType: "" | "fulltime" | "parttime" | "contract" | "internship";
  startWindow: string;
  duration: string;
  sites: DiscoverSite[];
}

const DEFAULT_PREFERENCES: DiscoverPreferences = {
  role: "", alternateTitles: "", experienceLevel: "intern", requiredSkills: "",
  preferredSkills: "", preferredIndustries: "", excludedKeywords: "senior, manager, director, volunteer",
  location: "Edmonton, AB", countryIndeed: "canada", distance: 50, workplace: "any",
  jobType: "internship", startWindow: "September 2026", duration: "8 month",
  sites: ["linkedin", "indeed", "google"],
};

function commaList(value: string): string[] {
  return value.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean);
}

function readPreferences(): DiscoverPreferences | null {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<DiscoverPreferences>;
    if (!parsed.role || !Array.isArray(parsed.sites)) return null;
    const legacy = parsed as Partial<DiscoverPreferences> & { experience?: string };
    return { ...DEFAULT_PREFERENCES, ...parsed, experienceLevel: parsed.experienceLevel ?? legacy.experience ?? DEFAULT_PREFERENCES.experienceLevel };
  } catch { return null; }
}

function searchRequest(preferences: DiscoverPreferences): DiscoverSearchRequest {
  return {
    sites: preferences.sites,
    searchTerm: preferences.role,
    alternateTitles: commaList(preferences.alternateTitles),
    requiredSkills: commaList(preferences.requiredSkills),
    preferredSkills: commaList(preferences.preferredSkills),
    preferredIndustries: commaList(preferences.preferredIndustries),
    excludedKeywords: commaList(preferences.excludedKeywords),
    experienceLevel: preferences.experienceLevel,
    timingKeywords: commaList(`${preferences.startWindow},${preferences.duration}`),
    location: preferences.location,
    countryIndeed: preferences.countryIndeed,
    distance: preferences.distance,
    resultsWanted: 24,
    hoursOld: 168,
    isRemote: preferences.workplace === "remote",
    jobType: preferences.jobType || undefined,
  };
}

function formatSource(site: string): string {
  return site === "zip_recruiter" ? "ZipRecruiter" : site.replace(/^./, (character) => character.toUpperCase());
}

function formatSalary(job: DiscoveredJob): string | null {
  if (job.minimumAmount == null && job.maximumAmount == null) return null;
  const compact = new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 1 });
  const values = [job.minimumAmount, job.maximumAmount].filter((amount): amount is number => amount != null).map((amount) => compact.format(amount));
  return `${job.currency ?? "CAD"} ${values.join("–")}${job.interval ? ` / ${job.interval}` : ""}`;
}

type DescriptionBlock =
  | { type: "heading" | "paragraph"; text: string }
  | { type: "list"; items: string[] };

function plainDescription(description: string | null): string {
  return (description ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|section)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\\([*+\-_])/g, "$1")
    .replace(/\*\*\s*(.*?)\s*\*\*/g, "\n## $1\n")
    .replace(/\s+\*\s+(?=[A-Z])/g, "\n- ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function descriptionBlocks(description: string | null): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  for (const line of plainDescription(description).split(/\n+/).map((value) => value.trim()).filter(Boolean)) {
    if (line.startsWith("## ")) blocks.push({ type: "heading", text: line.slice(3).replace(/\*+/g, "") });
    else if (line.startsWith("- ")) {
      const previous = blocks.at(-1);
      if (previous?.type === "list") previous.items.push(line.slice(2));
      else blocks.push({ type: "list", items: [line.slice(2)] });
    } else blocks.push({ type: "paragraph", text: line.replace(/\*+/g, "") });
  }
  return blocks;
}

function JobDescription({ description }: { description: string | null }) {
  const blocks = descriptionBlocks(description);
  if (!blocks.length) return <p className="text-[12px] text-ink-2">No description was returned by this source.</p>;
  return <div className="space-y-4">{blocks.map((block, index) => {
    if (block.type === "heading") return <h3 key={`${block.text}-${index}`} className="border-b border-hairline pb-1 font-display text-[19px] leading-snug text-ink">{block.text}</h3>;
    if (block.type === "list") return <ul key={`list-${index}`} className="space-y-2 pl-4 text-[12px] leading-relaxed text-ink-2">{block.items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`} className="list-disc pl-1 marker:text-oxblood">{item}</li>)}</ul>;
    return <p key={`${block.text.slice(0, 24)}-${index}`} className="text-[12px] leading-[1.7] text-ink-2">{block.text}</p>;
  })}</div>;
}

function Onboarding({ initial, onComplete }: { initial: DiscoverPreferences; onComplete: (preferences: DiscoverPreferences) => void }) {
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const steps = ["Target", "Skills", "Location", "Terms", "Sources"];

  function continueOnboarding() {
    if (step === 1 && !preferences.role.trim()) return setError("Add at least one role or job title.");
    if (step === 2 && !preferences.requiredSkills.trim()) return setError("Add the core skills a good posting must mention.");
    if (step === 3 && !preferences.location.trim() && preferences.workplace !== "remote") return setError("Add a location or choose remote work.");
    if (step === 5 && preferences.sites.length === 0) return setError("Choose at least one source to search.");
    setError(null);
    if (step < 5) setStep((current) => current + 1);
    else onComplete({ ...preferences, role: preferences.role.trim(), location: preferences.location.trim() });
  }

  function toggleSite(site: DiscoverSite) {
    setPreferences((current) => ({ ...current, sites: current.sites.includes(site) ? current.sites.filter((candidate) => candidate !== site) : [...current.sites, site] }));
  }

  return (
    <section className="mx-auto max-w-[880px] pt-2" aria-labelledby="discover-onboarding-heading">
      <div className="animate-reveal mb-10 flex items-center justify-between border-b border-hairline pb-4">
        <span className="text-[11px] uppercase tracking-[0.18em] text-oxblood">Build a precise search profile</span>
        <span className="tnum text-[11px] text-ink-2">Step {step} of 5 · {steps[step - 1]}</span>
      </div>
      <div className="grid gap-10 lg:grid-cols-[1fr_280px] lg:gap-16">
        <form onSubmit={(event) => { event.preventDefault(); continueOnboarding(); }}>
          {step === 1 && <fieldset className="animate-reveal">
            <legend id="discover-onboarding-heading" className="max-w-[650px] font-display text-[38px] leading-[1.04] tracking-[-0.02em] text-ink sm:text-[54px]">Name the exact work you want.</legend>
            <p className="mt-4 max-w-[580px] text-[13px] leading-relaxed text-ink-2">Use one focused primary title. We run alternate titles as separate searches, then merge and rank the results.</p>
            <label htmlFor="discover-role" className="mt-9 block text-[12px] text-ink-2">Primary target title <span className="text-oxblood">required</span></label>
            <Input id="discover-role" variant="rule" autoFocus placeholder="e.g. Firmware Engineering Intern" value={preferences.role} onChange={(event) => setPreferences({ ...preferences, role: event.target.value })} className="mt-2 text-[18px]" />
            <label htmlFor="discover-alternates" className="mt-7 block text-[12px] text-ink-2">Alternate titles <span className="text-ink-3">comma-separated, up to two</span></label>
            <Input id="discover-alternates" variant="rule" placeholder="Embedded Software Intern, Firmware Developer Intern" value={preferences.alternateTitles} onChange={(event) => setPreferences({ ...preferences, alternateTitles: event.target.value })} />
            <label htmlFor="discover-level" className="mt-7 block text-[12px] text-ink-2">Career level</label>
            <select id="discover-level" value={preferences.experienceLevel} onChange={(event) => setPreferences({ ...preferences, experienceLevel: event.target.value })} className="mt-2 w-full border-0 border-b border-hairline bg-transparent pb-2 text-[14px] text-ink focus:border-oxblood focus:outline-none">
              {["student", "intern", "new grad", "entry level", "junior", "mid level", "senior"].map((level) => <option key={level} value={level}>{level.replace(/^./, (character) => character.toUpperCase())}</option>)}
            </select>
          </fieldset>}

          {step === 2 && <fieldset className="animate-reveal">
            <legend id="discover-onboarding-heading" className="font-display text-[38px] leading-[1.04] tracking-[-0.02em] text-ink sm:text-[54px]">Define what a real match contains.</legend>
            <p className="mt-4 max-w-[580px] text-[13px] leading-relaxed text-ink-2">At least one must-have skill has to appear in the title or description. Nice-to-haves increase ranking without hiding otherwise strong roles.</p>
            <label htmlFor="discover-required-skills" className="mt-9 block text-[12px] text-ink-2">Must-have skills <span className="text-oxblood">required</span></label>
            <Input id="discover-required-skills" variant="rule" autoFocus placeholder="Rust, C, C++, embedded systems, firmware" value={preferences.requiredSkills} onChange={(event) => setPreferences({ ...preferences, requiredSkills: event.target.value })} />
            <label htmlFor="discover-preferred-skills" className="mt-7 block text-[12px] text-ink-2">Nice-to-have skills</label>
            <Input id="discover-preferred-skills" variant="rule" placeholder="Linux, FreeRTOS, bare metal, Python, IIoT" value={preferences.preferredSkills} onChange={(event) => setPreferences({ ...preferences, preferredSkills: event.target.value })} />
            <label htmlFor="discover-industries" className="mt-7 block text-[12px] text-ink-2">Preferred industries or domains</label>
            <Input id="discover-industries" variant="rule" placeholder="industrial controls, sensing, electronics, R&D" value={preferences.preferredIndustries} onChange={(event) => setPreferences({ ...preferences, preferredIndustries: event.target.value })} />
            <label htmlFor="discover-exclusions" className="mt-7 block text-[12px] text-ink-2">Always exclude</label>
            <Input id="discover-exclusions" variant="rule" placeholder="senior, manager, director, volunteer" value={preferences.excludedKeywords} onChange={(event) => setPreferences({ ...preferences, excludedKeywords: event.target.value })} />
          </fieldset>}

          {step === 3 && <fieldset className="animate-reveal">
            <legend id="discover-onboarding-heading" className="font-display text-[38px] leading-[1.04] tracking-[-0.02em] text-ink sm:text-[54px]">Set a realistic commute boundary.</legend>
            <p className="mt-4 max-w-[580px] text-[13px] leading-relaxed text-ink-2">Location and radius are sent to JobSpy. Remote-only searches are filtered separately because some sources treat remote inconsistently.</p>
            <label htmlFor="discover-location" className="mt-9 block text-[12px] text-ink-2">City, region, or country</label>
            <Input id="discover-location" variant="rule" autoFocus placeholder="e.g. Edmonton, AB" value={preferences.location} onChange={(event) => setPreferences({ ...preferences, location: event.target.value })} className="mt-2 text-[18px]" />
            <label htmlFor="discover-distance" className="mt-7 block text-[12px] text-ink-2">Maximum distance · <span className="tnum text-ink">{preferences.distance} km</span></label>
            <input id="discover-distance" type="range" min="10" max="200" step="10" value={preferences.distance} onChange={(event) => setPreferences({ ...preferences, distance: Number(event.target.value) })} className="mt-3 w-full accent-[rgb(var(--oxblood))]" />
            <div className="mt-8 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Workplace preference">{([["any", "On-site, hybrid, or remote"], ["remote", "Remote only"]] as const).map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={preferences.workplace === id} onClick={() => setPreferences({ ...preferences, workplace: id })} className={cn("flex min-h-14 items-center justify-between border px-4 text-left text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood", preferences.workplace === id ? "border-oxblood bg-paper-raised text-ink" : "border-hairline text-ink-2 hover:border-ink-3")}>{label}{preferences.workplace === id && <Check size={16} className="text-oxblood" />}</button>)}</div>
          </fieldset>}

          {step === 4 && <fieldset className="animate-reveal">
            <legend id="discover-onboarding-heading" className="font-display text-[38px] leading-[1.04] tracking-[-0.02em] text-ink sm:text-[54px]">Lock in the practical terms.</legend>
            <p className="mt-4 max-w-[580px] text-[13px] leading-relaxed text-ink-2">For internships, timing and duration are powerful fit signals. They influence ranking when the posting provides them.</p>
            <label htmlFor="discover-job-type" className="mt-9 block text-[12px] text-ink-2">Employment type</label>
            <select id="discover-job-type" value={preferences.jobType} onChange={(event) => setPreferences({ ...preferences, jobType: event.target.value as DiscoverPreferences["jobType"] })} className="mt-2 w-full border-0 border-b border-hairline bg-transparent pb-2 text-[14px] text-ink focus:border-oxblood focus:outline-none">{JOB_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select>
            <label htmlFor="discover-start" className="mt-7 block text-[12px] text-ink-2">Available start window</label>
            <Input id="discover-start" variant="rule" placeholder="September 2026 or Winter 2027" value={preferences.startWindow} onChange={(event) => setPreferences({ ...preferences, startWindow: event.target.value })} />
            <label htmlFor="discover-duration" className="mt-7 block text-[12px] text-ink-2">Preferred term or duration</label>
            <Input id="discover-duration" variant="rule" placeholder="8 month, co-op, permanent" value={preferences.duration} onChange={(event) => setPreferences({ ...preferences, duration: event.target.value })} />
          </fieldset>}

          {step === 5 && <fieldset className="animate-reveal">
            <legend id="discover-onboarding-heading" className="font-display text-[38px] leading-[1.04] tracking-[-0.02em] text-ink sm:text-[54px]">Choose a focused source mix.</legend>
            <p className="mt-4 max-w-[580px] text-[13px] leading-relaxed text-ink-2">Two or three sources are usually enough. Each exact title runs independently, results are deduplicated, and weak matches are removed.</p>
            <div className="mt-8 text-[12px] text-ink-2">Job sources</div>
            <div className="mt-3 flex flex-wrap gap-2">{SITES.map((site) => { const selected = preferences.sites.includes(site.id); return <button key={site.id} type="button" aria-pressed={selected} onClick={() => toggleSite(site.id)} className={cn("min-h-10 border px-3.5 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood", selected ? "border-ink bg-ink text-paper" : "border-hairline text-ink-2 hover:border-ink-3")}>{selected && <Check size={13} className="mr-1.5 inline" />}{site.label}</button>; })}</div>
            <div className="mt-8 border-y border-hairline py-5 text-[11px] leading-relaxed text-ink-2"><strong className="block text-[12px] text-ink">Search profile</strong><span className="mt-2 block">{preferences.role}{preferences.alternateTitles ? ` + ${preferences.alternateTitles}` : ""}</span><span className="block">{preferences.location || "Remote"} · {preferences.distance} km · {JOB_TYPES.find((type) => type.id === preferences.jobType)?.label}</span><span className="block">Must mention: {preferences.requiredSkills}</span></div>
          </fieldset>}

          {error && <p role="alert" className="mt-6 border-l-2 border-oxblood pl-3 text-[12px] text-oxblood">{error}</p>}
          <div className="mt-11 flex items-center justify-between border-t border-hairline pt-5">
            <Button type="button" variant="quiet" onClick={() => { setError(null); setStep((current) => Math.max(1, current - 1)); }} disabled={step === 1}><ArrowLeft size={14} /> Back</Button>
            <Button type="submit" variant="ink">{step === 5 ? "Run focused search" : "Continue"}<ArrowRight size={15} /></Button>
          </div>
        </form>
        <aside className="hidden border-l border-hairline pl-7 lg:block" aria-label="Onboarding progress">
          {steps.map((label, index) => <div key={label} className={cn("mb-6 flex gap-3 text-[12px]", step === index + 1 ? "text-ink" : "text-ink-3")}><span className={cn("tnum flex h-5 w-5 items-center justify-center rounded-full border text-[10px]", step > index + 1 ? "border-verdigris bg-verdigris text-paper" : step === index + 1 ? "border-oxblood text-oxblood" : "border-hairline")}>{step > index + 1 ? <Check size={11} /> : index + 1}</span><span className="pt-0.5">{label}</span></div>)}
        </aside>
      </div>
    </section>
  );
}

function JobCard({ job, saved, busy, onSave, onVisit }: { job: DiscoveredJob; saved: boolean; busy: boolean; onSave: () => void; onVisit: (targetUrl?: string) => void }) {
  const salary = formatSalary(job);
  const relatedLinks = [
    job.jobUrlDirect && job.jobUrl && job.jobUrlDirect !== job.jobUrl ? { label: "Source listing", url: job.jobUrl } : null,
    (job.companyUrlDirect ?? job.companyUrl) ? { label: "Company", url: job.companyUrlDirect ?? job.companyUrl } : null,
  ].filter((link): link is { label: string; url: string } => Boolean(link?.url));
  return (
    <li className="animate-reveal group flex min-w-0 flex-col border border-hairline bg-paper-raised/70 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink-3 hover:shadow-[5px_5px_0_0_var(--card-shadow)]">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant="mist" className="uppercase tracking-[0.1em]">{formatSource(job.site)}</Badge>{job.matchScore != null && <Badge variant={job.matchScore >= 70 ? "verdigris" : "brass"}>{job.matchScore}% fit</Badge>}</div>{job.datePosted && <span className="tnum flex items-center gap-1.5 text-[10px] text-ink-3"><Clock3 size={12} />{new Date(job.datePosted).toLocaleDateString()}</span>}</div>
      <h2 className="mt-5 line-clamp-2 font-display text-[27px] leading-[1.05] tracking-[-0.015em] text-ink">{job.title ?? "Untitled role"}</h2>
      <p className="mt-2 flex items-center gap-2 text-[13px] font-medium text-ink"><Building2 size={14} className="shrink-0 text-oxblood" />{job.company ?? "Company not listed"}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-ink-2">{job.location && <span className="flex items-center gap-1.5"><MapPin size={13} />{job.location}</span>}{job.isRemote && <span className="flex items-center gap-1.5"><Compass size={13} />Remote</span>}{job.jobType && <span className="flex items-center gap-1.5"><BriefcaseBusiness size={13} />{job.jobType}</span>}</div>
      {salary && <p className="tnum mt-4 text-[12px] text-verdigris">{salary}</p>}
      {!!job.matchReasons?.length && <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Why this role matches">{job.matchReasons.map((reason) => <li key={reason}><Badge variant="mist">{reason}</Badge></li>)}</ul>}
      <p className="mt-5 line-clamp-3 text-[12px] leading-relaxed text-ink-2">{plainDescription(job.description) || "Open the posting for the complete job description."}</p>
      <details className="mt-4 border-t border-hairline pt-3"><summary className="cursor-pointer text-[11px] font-medium text-ink underline decoration-hairline underline-offset-4 hover:text-oxblood">Read formatted job description</summary><div className="mt-4 max-h-80 overflow-y-auto border-l-2 border-oxblood/30 bg-paper px-4 py-3"><JobDescription description={job.description} /></div></details>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-6"><Button variant="ink" className="min-h-11 flex-1 px-4" onClick={() => onVisit()} disabled={busy || !(job.jobUrlDirect ?? job.jobUrl)}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowUpRight size={15} />}{saved ? "Open posting" : "View & track"}</Button><Button variant="rule" className="min-h-11" onClick={onSave} disabled={busy || saved}>{saved ? <><Check size={14} />Tracked</> : <><FileText size={14} />Save</>}</Button></div>
      {relatedLinks.length > 0 && <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-ink-3">{relatedLinks.map((link) => <button key={`${link.label}:${link.url}`} type="button" disabled={busy} onClick={() => onVisit(link.url)} className="underline underline-offset-4 transition-colors hover:text-oxblood disabled:opacity-50">{link.label} <ArrowUpRight size={10} className="inline" /></button>)}</div>}
    </li>
  );
}

export function Discover() {
  const initialPreferences = useMemo(() => readPreferences(), []);
  const [preferences, setPreferences] = useState<DiscoverPreferences | null>(initialPreferences);
  const [editingPreferences, setEditingPreferences] = useState(!initialPreferences);
  const [results, setResults] = useState<DiscoveredJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const initialSearchStarted = useRef(false);

  async function runSearch(nextPreferences = preferences) {
    if (!nextPreferences) return;
    setSearching(true); setError(null); setNotice(null);
    try {
      const response = await ipc().searchDiscoveredJobs(searchRequest(nextPreferences));
      setResults(response.results); setWarnings(response.warnings);
      if (response.cached) setNotice("Loaded from the local 10-minute search cache.");
    } catch (searchError) {
      setResults([]); setError(searchError instanceof Error ? searchError.message : "Job discovery could not be reached.");
    } finally { setSearching(false); }
  }

  useEffect(() => {
    if (!preferences || initialSearchStarted.current) return;
    initialSearchStarted.current = true;
    void runSearch(preferences);
  }, []);

  const filteredResults = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return results;
    return results.filter((job) => `${job.title ?? ""} ${job.company ?? ""} ${job.location ?? ""} ${job.description ?? ""}`.toLowerCase().includes(query));
  }, [filter, results]);

  function completeOnboarding(nextPreferences: DiscoverPreferences) {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(nextPreferences)); } catch { /* Session-only fallback. */ }
    setPreferences(nextPreferences); setEditingPreferences(false); void runSearch(nextPreferences);
  }

  async function saveJob(job: DiscoveredJob, shouldVisit: boolean, targetUrl?: string) {
    setBusyId(job.id); setNotice(null); setError(null);
    try {
      const result = shouldVisit ? await ipc().visitDiscoveredJob(job, targetUrl) : await ipc().saveDiscoveredJob(job);
      setSavedIds((current) => new Set(current).add(job.id));
      setNotice(result.alreadySaved ? `${job.title} was already in Found.` : `${job.title} was added to Found.`);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "This job could not be saved.";
      if (message.includes("saved to Found")) setSavedIds((current) => new Set(current).add(job.id));
      setError(message);
    }
    finally { setBusyId(null); }
  }

  if (editingPreferences || !preferences) return <Onboarding initial={preferences ?? DEFAULT_PREFERENCES} onComplete={completeOnboarding} />;

  return <div className="mx-auto max-w-[1180px]">
    <header className="animate-reveal flex flex-col gap-5 border-b border-hairline pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-oxblood"><Sparkles size={13} />Curated for your search</div><h1 className="font-display text-[42px] leading-[0.9] tracking-[-0.02em] text-ink sm:text-[56px]">Discover</h1><p className="mt-4 max-w-[620px] text-[12px] leading-relaxed text-ink-2">Fresh roles from public job sources, gathered locally through JobTrail and JobSpy. Opening a posting automatically keeps it in your Found board.</p></div>
      <div className="flex shrink-0 flex-wrap gap-2"><Button variant="rule" className="min-h-10" onClick={() => setEditingPreferences(true)}><SlidersHorizontal size={14} />Edit preferences</Button><Button variant="ink" className="min-h-10 px-4" onClick={() => void runSearch()} disabled={searching}><RotateCcw size={14} className={searching ? "animate-spin" : ""} />Refresh</Button></div>
    </header>
    <section className="animate-reveal mt-5 flex flex-col gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Active search">
      <div className="flex flex-wrap gap-2"><Badge variant="ink">{preferences.role}</Badge>{preferences.location && <Badge variant="mist">{preferences.location} · {preferences.distance} km</Badge>}<Badge variant="mist">{preferences.workplace === "remote" ? "Remote only" : "Any workplace"}</Badge>{preferences.jobType && <Badge variant="mist">{JOB_TYPES.find((type) => type.id === preferences.jobType)?.label}</Badge>}{commaList(preferences.requiredSkills).slice(0, 3).map((skill) => <Badge key={skill} variant="verdigris">{skill}</Badge>)}</div>
      <label className="relative block w-full sm:w-[260px]"><span className="sr-only">Filter loaded jobs</span><Search size={14} className="absolute left-0 top-2.5 text-ink-3" /><Input variant="rule" className="pl-6" placeholder="Filter loaded jobs" value={filter} onChange={(event) => setFilter(event.target.value)} /></label>
    </section>
    <div aria-live="polite">{notice && <p role="status" className="mt-5 border-l-2 border-verdigris pl-3 text-[12px] text-ink">{notice}</p>}{warnings.map((warning) => <p key={warning} className="mt-3 border-l-2 border-brass pl-3 text-[11px] text-ink-2">{warning}</p>)}{error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-oxblood/30 bg-paper-raised p-4 text-[12px] text-ink"><span>{error}</span><Button variant="quiet" onClick={() => results.length ? setError(null) : void runSearch()}>{results.length ? "Dismiss" : "Try again"}</Button></div>}</div>
    {searching && <div role="status" className="flex min-h-[320px] flex-col items-center justify-center text-center"><LoaderCircle size={24} className="animate-spin text-oxblood" /><p className="mt-5 font-display text-[26px] text-ink">Searching across {preferences.sites.length} sources</p><p className="mt-2 text-[11px] text-ink-2">This can take a moment. Results are cached to protect upstream services.</p></div>}
    {!searching && !error && results.length === 0 && <div className="mt-10 max-w-[650px] border-y border-dashed border-hairline py-10"><p className="font-display text-[30px] leading-snug text-ink">No roles surfaced this time.</p><p className="mt-3 text-[12px] leading-relaxed text-ink-2">Try a broader title, another location, or add a source. Your preferences stay private on this device.</p><Button variant="quiet" className="mt-5" onClick={() => setEditingPreferences(true)}>Adjust preferences <ArrowRight size={14} /></Button></div>}
    {!searching && filteredResults.length > 0 && <><div className="mt-7 flex items-baseline justify-between"><p className="tnum text-[11px] text-ink-2">{filteredResults.length} of {results.length} roles</p><p className="text-[10px] text-ink-3">Opening any posting saves it to Found</p></div><ul className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredResults.map((job) => <JobCard key={`${job.site}:${job.id}`} job={job} saved={savedIds.has(job.id)} busy={busyId === job.id} onSave={() => void saveJob(job, false)} onVisit={(targetUrl) => void saveJob(job, true, targetUrl)} />)}</ul></>}
    {!searching && results.length > 0 && filteredResults.length === 0 && <p className="mt-9 text-[13px] text-ink-2">No loaded jobs match “{filter}”. Clear the filter to see all {results.length} roles.</p>}
  </div>;
}
