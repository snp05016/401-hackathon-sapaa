import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { AnimatePresence, motion } from "framer-motion";
import { Network, RefreshCw, Search, Sparkles, X } from "lucide-react";
import type { Application, ExperienceEntry } from "@ghostboard/shared";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ipc } from "../lib/ipc";
import { cn } from "../lib/utils";
import { modalBackdrop, modalPanel } from "../lib/motion";
import { DISTANCE, DURATION, EASE, STAGGER, TRANSITION } from "../lib/motion";
import { playSound } from "../lib/sound";
const PREFERENCES_KEY = "discover-preferences-v2";
const CANVAS_FONT_FAMILY = '"Archivo", "Helvetica Neue", sans-serif';

interface DiscoverPreferences {
  requiredSkills: string;
  preferredSkills: string;
  preferredIndustries: string;
}

function readPreferences(): DiscoverPreferences | null {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<DiscoverPreferences>;
    return {
      requiredSkills: parsed.requiredSkills ?? "",
      preferredSkills: parsed.preferredSkills ?? "",
      preferredIndustries: parsed.preferredIndustries ?? "",
    };
  } catch { return null; }
}

function commaList(value: string): string[] {
  return value.split(/[,\n]/).map((entry) => entry.trim()).filter(Boolean);
}

// A compact vocabulary of common skills and keywords found in postings.
function extractKeywordsFromText(text: string): string[] {
  const commonTechTerms = [
    "react", "vue", "angular", "svelte", "next.js", "nuxt",
    "typescript", "javascript", "python", "java", "go", "rust", "c++", "c#", "swift", "kotlin",
    "node.js", "express", "fastapi", "django", "spring", "rails",
    "postgresql", "mysql", "mongodb", "redis", "sqlite", "dynamodb",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
    "git", "ci/cd", "jenkins", "github actions",
    "graphql", "rest", "grpc", "websocket",
    "tailwind", "css", "sass", "html",
    "testing", "jest", "vitest", "cypress", "playwright",
    "machine learning", "tensorflow", "pytorch", "scikit-learn",
    "data science", "pandas", "numpy", "sql",
    "embedded", "firmware", "rtos", "assembly",
    "linux", "unix", "bash", "shell",
    "microservices", "distributed systems", "system design",
    "agile", "scrum", "kanban",
  ];
  const lowerText = text.toLowerCase();
  return [...new Set(commonTechTerms.filter((term) => lowerText.includes(term)))];
}

function buildPreferenceSkills(preferences: DiscoverPreferences | null): string[] {
  if (!preferences) return [];
  const byKey = new Map<string, string>();
  const add = (term: string) => { const trimmed = term.trim(); if (trimmed) byKey.set(trimmed.toLowerCase(), trimmed); };
  commaList(preferences.requiredSkills).forEach(add);
  commaList(preferences.preferredSkills).forEach(add);
  commaList(preferences.preferredIndustries).forEach(add);
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
}

function buildJobSkills(applications: Application[]): string[] {
  const byKey = new Map<string, string>();
  const add = (term: string) => { const trimmed = term.trim(); if (trimmed) byKey.set(trimmed.toLowerCase(), trimmed); };
  applications.forEach((application) => {
    extractKeywordsFromText(application.jobDescription).forEach(add);
  });
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
}

// The Resume page stores its Skills section as experience entries with source "skill".
function buildResumeSkills(entries: ExperienceEntry[]): string[] {
  const byKey = new Map<string, string>();
  const add = (term: string) => { const trimmed = term.trim(); if (trimmed) byKey.set(trimmed.toLowerCase(), trimmed); };
  entries.forEach((entry) => {
    if (entry.source !== "skill") return;
    entry.skills.forEach(add);
  });
  return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
}

function resolveCssColor(cssVar: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
  return `rgb(${value})`;
}

interface NodeData {
  id: string;
  label: string;
  kind: "job" | "preference" | "job-skill" | "resume";
  color: string
  size: number;
  application?: Application;
}

interface LinkData {
  source: string;
  target: string;
}

const JOB_COLOR = "rgb(var(--verdigris))";
const PREFERENCE_SKILL_COLOR = "rgb(var(--oxblood))";
const JOB_SKILL_COLOR = "rgb(var(--brass))";
const RESUME_SKILL_COLOR = "rgb(var(--ink))";

const NODE_FILL_COLORS: Record<NodeData["kind"], string> = {
  job: JOB_COLOR,
  preference: PREFERENCE_SKILL_COLOR,
  "job-skill": JOB_SKILL_COLOR,
  resume: RESUME_SKILL_COLOR,
};

const KIND_LABEL = {
  job: "Job",
  preference: "Preference skill",
  "job-skill": "Posting skill",
  resume: "Resume skill",
} as const;

const KIND_BORDER = {
  job: "border-verdigris/35",
  preference: "border-oxblood/35",
  "job-skill": "border-brass/35",
  resume: "border-ink/35",
} as const;

const KIND_TEXT = {
  job: "text-verdigris",
  preference: "text-oxblood",
  "job-skill": "text-brass",
  resume: "text-ink",
} as const;

export function SkillsGraph() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [experienceEntries, setExperienceEntries] = useState<ExperienceEntry[]>([]);
  const [preferences] = useState<DiscoverPreferences | null>(readPreferences);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [hoveredNode, setHoveredNode] = useState<NodeData | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 800, height: 520 });

  const graphRef = useRef<any>(null);
  const hoveredNodeRef = useRef<NodeData | null>(null);
  const lastOpenedApplicationId = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const jobColor =  useMemo(() => resolveCssColor("--verdigris"), []);
  const postingSkillColor = useMemo(() => resolveCssColor("--brass"), []);
  const preferenceSkillColor = useMemo(() => resolveCssColor("--oxblood"), []);
  const resumeSkillColor = useMemo(() => resolveCssColor("--ink"), []);


  useEffect(() => {
    let active = true;
    async function loadApplications() {
      try {
        const [apps, entries] = await Promise.all([
          ipc().listApplications(),
          ipc().listExperienceEntries(),
        ]);
        if (active) {
          setApplications(apps);
          setExperienceEntries(entries);
        }
      } catch (error) {
        console.error("Failed to load applications:", error);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadApplications();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: Math.max(320, rect.width), height: Math.max(320, rect.height) });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedApplication(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fullGraph = useMemo(() => {
    const preferenceSkills = buildPreferenceSkills(preferences);
    const jobSkills = buildJobSkills(applications);
    const resumeSkills = buildResumeSkills(experienceEntries);
    const preferenceSkillKeys = new Set(preferenceSkills.map((skill) => skill.toLowerCase()));
    const derivedSkills = jobSkills.filter((skill) => !preferenceSkillKeys.has(skill.toLowerCase()));
    const nodeList: NodeData[] = [];
    const linkList: LinkData[] = [];

    applications.forEach((application) => {
      nodeList.push({
        id: `job:${application.id}`,
        label: application.title || application.company,
        kind: "job",
        color: jobColor, 
        size: 22,
        application,
      });
    });

    preferenceSkills.forEach((skill) => {
      nodeList.push({
        id: `skill:${skill.toLowerCase()}`,
        label: skill,
        kind: "preference",
        color: preferenceSkillColor,
        size: 15,
      });
    });

    derivedSkills.forEach((skill) => {
      nodeList.push({
        id: `skill:${skill.toLowerCase()}`,
        label: skill,
        kind: "job-skill",
        color: postingSkillColor,
        size: 15,
      });
    });

    resumeSkills.forEach((skill) => {
      nodeList.push({
        id: `resume:${skill.toLowerCase()}`,
        label: skill,
        kind: "resume",
        color: resumeSkillColor,
        size: 15,
      });
    });

    const skillKeys = [...preferenceSkillKeys, ...derivedSkills.map((skill) => skill.toLowerCase())];
    applications.forEach((application) => {
      const jobId = `job:${application.id}`;
      const jobText = `${application.title} ${application.company} ${application.jobDescription}`.toLowerCase();
      skillKeys.forEach((skillKey) => {
        if (skillKey.length >= 2 && jobText.includes(skillKey)) {
          linkList.push({ source: jobId, target: `skill:${skillKey}` });
        }
      });
    });

    const knownSkillKeys = new Set(skillKeys);
    resumeSkills.forEach((skill) => {
      const resumeId = `resume:${skill.toLowerCase()}`;
      if (knownSkillKeys.has(skill.toLowerCase())) {
        linkList.push({ source: resumeId, target: `skill:${skill.toLowerCase()}` });
      }
    });

    const result = { nodes: nodeList, links: linkList };
    return result;
  }, [preferences, applications, experienceEntries, jobColor, postingSkillColor, preferenceSkillColor, resumeSkillColor]);

  const isSkillLike = (node: NodeData) => node.kind !== "job";

  const { nodes, links } = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return fullGraph;
    const matchingSkillIds = new Set(
      fullGraph.nodes.filter((node) => isSkillLike(node) && node.label.toLowerCase().includes(query)).map((node) => node.id),
    );
    if (matchingSkillIds.size > 0) {
      const visible = new Set(matchingSkillIds);
      fullGraph.nodes.forEach((node) => {
        if (node.kind === "job" || visible.has(node.id)) return;
        const connected = fullGraph.links.some(
          (link) =>
            (link.source === node.id && visible.has(link.target as string)) ||
            (link.target === node.id && visible.has(link.source as string)),
        );
        if (connected && isSkillLike(node)) visible.add(node.id);
      });
      fullGraph.nodes.forEach((node) => {
        if (node.kind !== "job") return;
        const connected = fullGraph.links.some(
          (link) => link.target === node.id && visible.has(link.source as string),
        );
        if (connected) visible.add(node.id);
      });
      return {
        nodes: fullGraph.nodes.filter((node) => visible.has(node.id)),
        links: fullGraph.links.filter(
          (link) => visible.has(link.source as string) && visible.has(link.target as string),
        ),
      };
    }
    const matchingJobIds = new Set(
      fullGraph.nodes.filter((node) => node.label.toLowerCase().includes(query)).map((node) => node.id),
    );
    if (matchingJobIds.size > 0) {
      const visible = new Set(matchingJobIds);
      fullGraph.nodes.forEach((node) => {
        if (!isSkillLike(node)) return;
        const connected = fullGraph.links.some((link) => {
          const sourceConnected = matchingJobIds.has(link.source as string);
          const targetConnected = matchingJobIds.has(link.target as string);
          return sourceConnected !== targetConnected && (link.source === node.id || link.target === node.id);
        });
        if (connected) visible.add(node.id);
      });
      return {
        nodes: fullGraph.nodes.filter((node) => visible.has(node.id)),
        links: fullGraph.links.filter(
          (link) => visible.has(link.source as string) && visible.has(link.target as string),
        ),
      };
    }
    return { nodes: [], links: [] };
  }, [fullGraph, filter]);

  // Stabilize the graphData reference so opening/closing the job popup (and
  // hover state changes) doesn't reload the simulation and freeze the layout.
  const graphData = useMemo(() => ({ nodes, links }), [nodes, links]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    (graph.d3Force("link") as any)?.distance(74).id((node: any) => node.id);
    (graph.d3Force("charge") as any)?.strength(-260);
  }, [nodes, links]);

  const isLinkedToHover = (nodeId: string, hoveredId: string): boolean =>
    nodeId === hoveredId ||
    links.some(
      (link) =>
        (link.source === hoveredId && link.target === nodeId) ||
        (link.target === hoveredId && link.source === nodeId),
    );

  const handleNodeHover = (node: NodeData | null) => {
    hoveredNodeRef.current = node;
    setHoveredNode(node);
  };

  const handleNodeClick = (node: NodeData) => {
    if (node.kind === "job" && node.application) {
      lastOpenedApplicationId.current = node.application.id;
      playSound("open");
      setSelectedApplication(node.application);
    }
  };

  const closeApplication = () => {
    playSound("close");
    setSelectedApplication(null);
  };

  const hoveredNodeScreenPosition = useMemo(() => {
    if (!hoveredNode || !graphRef.current) return null;
    try {
      const graphNodes = graphRef.current.graphData().nodes;
      const target = graphNodes.find((node: any) => node.id === hoveredNode.id);
      if (!target || target.x == null || target.y == null) return null;
      return graphRef.current.graph2ScreenCoords(target.x, target.y);
    } catch {
      return null;
    }
  }, [hoveredNode]);

  const tooltipX = hoveredNodeScreenPosition?.x ?? mousePosition.x;
  const tooltipY = hoveredNodeScreenPosition?.y ?? mousePosition.y;

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Network className="mx-auto h-12 w-12 animate-spin text-ink-3" strokeWidth={1.4} />
          <p className="mt-4 font-display text-[22px] text-ink">Loading skills graph…</p>
        </div>
      </div>
    );
  }

  const preferenceSkillCount = nodes.filter((node) => node.kind === "preference").length;
  const jobSkillCount = nodes.filter((node) => node.kind === "job-skill").length;
  const resumeSkillCount = nodes.filter((node) => node.kind === "resume").length;
  const jobCount = nodes.filter((node) => node.kind === "job").length;

  const emptyReason = applications.length === 0
    ? "No saved job postings yet. Save jobs from the Discover page to see how your skills map to them."
    : "No skills or connections found. Add skills to your Discover preferences or save matching job postings.";

  return (
    <div className="flex flex-col text-ink">
      <motion.header
        initial={{ opacity: 0, y: DISTANCE.rise }}
        animate={{ opacity: 1, y: 0 }}
        transition={TRANSITION.hero}
        className="flex flex-col gap-5 border-b border-hairline pb-5 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-oxblood">
            <Sparkles size={13} />Second brain
          </div>
          <h1 className="font-display text-[42px] leading-[0.9] tracking-[-0.02em] text-ink sm:text-[56px]">Skills Graph</h1>
          <p className="mt-4 max-w-[640px] text-[12px] leading-relaxed text-ink-2">
            Skills and keywords from your Discover preferences and resume are linked to saved postings and to each other whenever one is contained in the other. Hover a skill to reveal its label or a job for a preview; click a job to open its details.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="rule" className="min-h-10" onClick={() => { playSound("navigate"); graphRef.current?.zoomToFit(500); }}>
            <RefreshCw size={14} />Reset view
          </Button>
        </div>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: DISTANCE.rise }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...TRANSITION.hero, delay: STAGGER.section }}
        className="mt-5 flex flex-col gap-4 pb-5 sm:flex-row sm:items-center sm:justify-between"
        aria-label="Graph summary"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2 text-[12px] text-ink-2"><span className="h-2.5 w-2.5 rounded-full bg-verdigris" aria-hidden="true" />Job posting</span>
          <span className="flex items-center gap-2 text-[12px] text-ink-2"><span className="h-2.5 w-2.5 rounded-full bg-oxblood" aria-hidden="true" />Preference skill</span>
          <span className="flex items-center gap-2 text-[12px] text-ink-2"><span className="h-2.5 w-2.5 rounded-full bg-brass" aria-hidden="true" />Posting skill</span>
          <span className="flex items-center gap-2 text-[12px] text-ink-2"><span className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden="true" />Resume skill</span>
          <Badge variant="verdigris">{jobCount} jobs</Badge>
          <Badge variant="oxblood">{preferenceSkillCount} preference skills</Badge>
          <Badge variant="brass">{jobSkillCount} posting skills</Badge>
          <Badge variant="ink">{resumeSkillCount} resume skills</Badge>
          <Badge variant="mist">{links.length} connections</Badge>
        </div>
        <label className="relative block w-full sm:w-[260px]">
          <span className="sr-only">Filter nodes</span>
          <Search size={14} className="absolute left-0 top-2.5 text-ink-3" />
          <Input variant="rule" className="pl-6" placeholder="Filter skills or jobs" value={filter} onChange={(event) => setFilter(event.target.value)} />
        </label>
      </motion.div>

      <div
        ref={containerRef}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setMousePosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        }}
        className="relative h-[62vh] min-h-[440px] w-full overflow-hidden rounded-sm border border-hairline bg-paper-raised"
      >
        {nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-[460px] text-center">
              <Network className="mx-auto mb-4 text-ink-3" size={30} strokeWidth={1.4} />
              <p className="font-display text-[22px] leading-snug text-ink">Nothing linked yet.</p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{emptyReason}</p>
            </div>
          </div>
        ) : (
          <>
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={size.width}
              height={size.height}
              backgroundColor="transparent"    
              nodeId="id"
              nodeVal={(node: any) => Math.pow((node as NodeData).size / 4, 2)}
              nodeCanvasObjectMode="replace"
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                const data = node as NodeData;
                const hoveredId = hoveredNodeRef.current?.id;
                const isHovered = hoveredId === data.id;
                const connected = hoveredId != null && isLinkedToHover(data.id, hoveredId);
                const dimmed = hoveredId != null && !isHovered && !connected;
                const radius = data.size / globalScale;

                ctx.save();
                ctx.globalAlpha = dimmed ? 0.22 : 1;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, 2 * Math.PI);
                ctx.fillStyle = NODE_FILL_COLORS[data.kind];
                ctx.fill();
                ctx.restore();

                if (isHovered) {
                  ctx.beginPath();
                  ctx.arc(0, 0, radius + 4 / globalScale, 0, 2 * Math.PI);
                  ctx.lineWidth = 1.5 / globalScale;
                  ctx.strokeStyle = "rgb(var(--ink))";
                  ctx.stroke();
                }

                const label = data.kind === "job" ? (data.application?.title ?? data.label) : data.label;
                const showLabel = data.kind === "job" || isHovered;
                const fontSize = data.kind === "job" ? 11 : 10;
                if (showLabel) {
                  ctx.save();
                  ctx.globalAlpha = dimmed ? 0.35 : 1;
                  ctx.font = `${data.kind === "job" ? 600 : 400} ${fontSize / globalScale}px ${CANVAS_FONT_FAMILY}`;
                  ctx.textAlign = "center";
                  ctx.textBaseline = "top";
                  ctx.fillStyle = data.kind === "job" ? "rgb(var(--ink))" : "rgb(var(--ink-2))";
                  const maxWidth = 96 / globalScale;
                  let text = label;
                  if (ctx.measureText(text).width > maxWidth) {
                    while (ctx.measureText(`${text}…`).width > maxWidth && text.length > 0) text = text.slice(0, -1);
                    text = `${text}…`;
                  }
                  ctx.fillText(text, 0, radius + 3 / globalScale);
                  ctx.restore();
                }
              }}
              linkSource="source"
              linkTarget="target"
              linkCanvasObjectMode="replace"
              linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D) => {
                const start = link.source && typeof link.source === "object" ? link.source : null;
                const end = link.target && typeof link.target === "object" ? link.target : null;
                if (!start || !end || start.x == null || end.x == null) return;
                const hoveredId = hoveredNodeRef.current?.id;
                const active = hoveredId != null && (start.id === hoveredId || end.id === hoveredId);
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.lineWidth = active ? 2.5 : 1;
                ctx.strokeStyle = active ? "rgb(var(--oxblood))" : "var(--hairline)";
                ctx.globalAlpha = hoveredId != null && !active ? 0.25 : active ? 1 : 0.8;
                ctx.stroke();
                ctx.restore();
              }}
              onNodeHover={handleNodeHover}
              onNodeClick={handleNodeClick}
              onNodeDragEnd={(node: any) => {
                if (node.x == null || node.y == null) return;
                node.fx = node.x;
                node.fy = node.y;
              }}
            />

            <AnimatePresence>
              {hoveredNode && (
                <motion.div
                  key={hoveredNode.id}
                  initial={{ opacity: 0, y: -3, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: DURATION.quick, ease: EASE.out }}
                  className={cn(
                    "pointer-events-none absolute z-10 flex flex-col gap-0.5 rounded-sm border bg-paper-raised px-2.5 py-1.5 shadow-[5px_5px_0_0_var(--card-shadow)]",
                    KIND_BORDER[hoveredNode.kind],
                  )}
                  style={{ left: Math.min(tooltipX + 12, size.width - 260), top: Math.min(tooltipY + 12, size.height - 60) }}
                >
                  <span className={cn("text-[10px] font-medium uppercase tracking-[0.14em]", KIND_TEXT[hoveredNode.kind])}>
                    {KIND_LABEL[hoveredNode.kind]}
                  </span>
                  {hoveredNode.kind === "job" ? (
                    <>
                      <span className="max-w-[220px] truncate text-[11px] font-semibold text-ink">
                        {hoveredNode.application?.title ?? hoveredNode.label}
                      </span>
                      <span className="max-w-[220px] truncate text-[10px] capitalize text-ink-2">
                        {hoveredNode.application?.company} · {hoveredNode.application?.status}
                      </span>
                    </>
                  ) : (
                    <span className="max-w-[200px] truncate text-[11px] text-ink">{hoveredNode.label}</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedApplication && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="graph-application-title">
            <motion.button
              type="button"
              variants={modalBackdrop}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0 cursor-default bg-ink/40"
              aria-label="Close job details"
              onClick={closeApplication}
            />
            <motion.section
              variants={modalPanel}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden border border-hairline bg-paper-raised shadow-2xl"
            >
              <header className="flex items-start justify-between gap-5 border-b border-hairline px-5 py-4 sm:px-7">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-ink-3">{selectedApplication.status}</p>
                  <h2 id="graph-application-title" className="mt-1 break-words font-display text-[28px] leading-tight text-ink sm:text-[34px]">{selectedApplication.title}</h2>
                  <p className="mt-1 text-[13px] text-ink-2">{selectedApplication.company}</p>
                </div>
                <button type="button" onClick={closeApplication} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-hairline text-ink-2 transition-colors hover:border-ink hover:text-ink" aria-label="Close job details" title="Close job details">
                  <X size={15} strokeWidth={2} />
                </button>
              </header>

              <div className="overflow-y-auto px-5 py-5 sm:px-7">
                <dl className="grid gap-x-6 gap-y-4 border-b border-hairline pb-5 text-[13px] sm:grid-cols-2">
                  <div><dt className="text-[11px] text-ink-3">Stage</dt><dd className="mt-1 capitalize text-ink">{selectedApplication.status}</dd></div>
                  <div><dt className="text-[11px] text-ink-3">Location</dt><dd className="mt-1 text-ink">{selectedApplication.location || "Not specified"}</dd></div>
                  <div><dt className="text-[11px] text-ink-3">Source</dt><dd className="mt-1 text-ink">{selectedApplication.source}</dd></div>
                  <div><dt className="text-[11px] text-ink-3">Saved</dt><dd className="mt-1 text-ink">{new Date(selectedApplication.dateFound).toLocaleDateString()}</dd></div>
                  <div><dt className="text-[11px] text-ink-3">Applied</dt><dd className="mt-1 text-ink">{selectedApplication.dateApplied ? new Date(selectedApplication.dateApplied).toLocaleDateString() : "Not applied"}</dd></div>
                  <div><dt className="text-[11px] text-ink-3">Last activity</dt><dd className="mt-1 text-ink">{new Date(selectedApplication.lastActivityAt).toLocaleDateString()}</dd></div>
                </dl>

                <div className="mt-5">
                  <h3 className="font-display text-[22px] text-ink">Job description</h3>
                  <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{selectedApplication.jobDescription || "No job description was saved for this application."}</p>
                </div>

                <a href={selectedApplication.jobUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block break-all text-[12px] text-oxblood underline underline-offset-4">
                  Open original job posting
                </a>
              </div>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}