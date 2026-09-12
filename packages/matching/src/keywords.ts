import type { Keyword, KeywordCategory, KeywordResult } from "@ghostboard/shared";

interface VocabularyEntry {
  term: string;
  category: KeywordCategory;
  aliases?: string[];
}

// Adapted from career-ops/skill-extract.mjs. Exact aliases intentionally map
// only equivalent spellings; broad concepts such as "cloud" never imply AWS.
const VOCABULARY: VocabularyEntry[] = [
  ...["JavaScript", "TypeScript", "Python", "Ruby", "Java", "Go", "Rust", "PHP", "Kotlin", "Swift", "Scala", "Elixir", "C++", "C#", ".NET", "SQL", "R"].map((term) => ({ term, category: "language" as const })),
  ...["React Native", "React", "Angular", "Vue.js", "Svelte", "Next.js", "Django", "Flask", "FastAPI", "Rails", "Laravel", "Spring", "Node.js", "Express", "NestJS"].map((term) => ({ term, category: "framework" as const })),
  ...["MongoDB", "MySQL", "PostgreSQL", "Redis", "Elasticsearch", "Snowflake", "BigQuery", "Databricks", "DynamoDB", "Cassandra", "SQLite"].map((term) => ({ term, category: "database" as const })),
  ...["AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "Ansible", "Helm", "Jenkins", "GitHub Actions", "GitLab CI", "CI/CD", "Prometheus", "Grafana", "Datadog", "Cloudflare"].map((term) => ({ term, category: "cloud" as const })),
  ...["GraphQL", "gRPC", "Kafka", "RabbitMQ", "Git", "Linux", "Vite", "Playwright", "REST APIs", "Microservices"].map((term) => ({ term, category: "tool" as const })),
  ...["PyTorch", "TensorFlow", "scikit-learn", "Pandas", "NumPy", "Spark", "Airflow", "dbt", "MLOps", "MLflow", "LangChain", "LlamaIndex", "Hugging Face", "RAG", "LLMs", "Prompt Engineering", "Fine-tuning", "Computer Vision", "NLP", "Machine Learning", "Artificial Intelligence", "Distributed Systems", "Data Engineering", "Cybersecurity"].map((term) => ({ term, category: "domain" as const })),
  ...["Agile", "Scrum", "Kanban", "DevOps", "Test-Driven Development", "Object-Oriented Programming"].map((term) => ({ term, category: "methodology" as const })),
  ...["PMP", "PMI-ACP", "PRINCE2", "ITIL", "TOGAF", "Lean Six Sigma", "CISSP", "Bachelor's degree", "Master's degree"].map((term) => ({ term, category: "qualification" as const })),
  ...["Communication", "Leadership", "Collaboration", "Problem Solving", "Mentoring"].map((term) => ({ term, category: "soft_skill" as const })),
];

const ALIASES: Record<string, string[]> = {
  Go: ["Golang"],
  Kubernetes: ["k8s"],
  PostgreSQL: ["Postgres"],
  "Node.js": ["NodeJS", "Node js"],
  "Vue.js": ["VueJS", "Vue js"],
  "Next.js": ["NextJS", "Next js"],
  "REST APIs": ["REST API", "RESTful API", "RESTful APIs"],
  LLMs: ["LLM", "large language model", "large language models"],
  "Fine-tuning": ["finetuning", "fine tuning"],
  "GitHub Actions": ["Github Actions"],
  "CI/CD": ["continuous integration", "continuous delivery", "continuous deployment"],
  "Machine Learning": ["ML"],
  "Artificial Intelligence": ["AI"],
  "Test-Driven Development": ["TDD"],
  "Object-Oriented Programming": ["OOP"],
  "Bachelor's degree": ["Bachelor degree", "Bachelors degree"],
  "Master's degree": ["Master degree", "Masters degree"],
};

const REQUIREMENT_HEADER = /^(?:requirements?|qualifications?|must[- ]haves?|preferred|nice[- ]to[- ]haves?|what (?:we(?:'|’)re looking for|you(?:'|’)ll bring)|who you are|about you|you(?:'|’)ll have)\b/i;
const SECTION_END = /^(?:responsibilities|what you(?:'|’)ll do|benefits?|perks?|compensation|salary|about (?:us|the company|the role)|equal opportunity)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term: string): RegExp {
  const body = escapeRegExp(term).replace(/\\ /g, "\\s+");
  // Unicode letter/number lookarounds work for C++, C#, and .NET where \b does not.
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, "giu");
}

function requirementsText(description: string): string {
  const selected: string[] = [];
  let active = false;
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.replace(/^\s*(?:#{1,6}|[-*•])\s*/, "").trim();
    if (SECTION_END.test(line)) active = false;
    if (REQUIREMENT_HEADER.test(line)) {
      active = true;
      continue;
    }
    if (active) selected.push(raw);
  }
  return selected.join("\n");
}

function countMatches(text: string, variants: string[]): number {
  let count = 0;
  for (const variant of variants) count += [...text.matchAll(termPattern(variant))].length;
  return count;
}

function variantsFor(term: string): string[] {
  return [term, ...(ALIASES[term] ?? [])];
}

function mentionsTerm(text: string, term: string): boolean {
  if (term !== "Go") return countMatches(text, variantsFor(term)) > 0;
  return countMatches(text, ["Golang"]) > 0 || /(?<![\p{L}\p{N}_])Go(?![\p{L}\p{N}_-])/u.test(text);
}

export interface KeywordExtractionOptions {
  title?: string;
  requirements?: string[];
  limit?: number;
}

/** Deterministic ranked keyword extraction; scores are relevance signals, not ATS scores. */
export function extractJobKeywords(description: string, options: KeywordExtractionOptions = {}): Keyword[] {
  const text = String(description ?? "");
  if (!text.trim()) return [];
  const reqText = [requirementsText(text), ...(options.requirements ?? [])].join("\n");
  const title = options.title ?? "";
  const found: Keyword[] = [];

  for (const entry of VOCABULARY) {
    const variants = [...variantsFor(entry.term), ...(entry.aliases ?? [])];
    // "Go" is ordinary prose when lowercase. Career-ops uses this same
    // case-sensitive exception to avoid "go the extra mile" false positives.
    const safeVariants = entry.term === "Go" ? variants.filter((variant) => variant !== "Go") : variants;
    let occurrences = countMatches(text, safeVariants);
    if (entry.term === "Go") occurrences += [...text.matchAll(/(?<![\p{L}\p{N}_])Go(?![\p{L}\p{N}_-])/gu)].length;
    if (occurrences === 0) continue;

    const requirementOccurrences = countMatches(reqText, variants);
    const titleOccurrences = countMatches(title, variants);
    const knownTermBoost = entry.category === "soft_skill" ? 0.05 : 0.14;
    const rawScore = 0.3 + Math.log2(occurrences + 1) * 0.13 + requirementOccurrences * 0.12 + titleOccurrences * 0.18 + knownTermBoost;
    found.push({
      term: entry.term,
      category: entry.category,
      occurrences,
      score: Math.min(1, Number(rawScore.toFixed(3))),
    });
  }

  return found
    .sort((a, b) => b.score - a.score || b.occurrences - a.occurrences || a.term.localeCompare(b.term))
    .slice(0, options.limit ?? 40);
}

/** Backward-compatible facade used by the current resume comparison UI. */
export function extractKeywords(jobDescription: string): KeywordResult[] {
  return extractJobKeywords(jobDescription).map((keyword) => ({
    keyword: keyword.term,
    score: keyword.score,
    frequency: keyword.occurrences,
    category: keyword.category,
    foundInResume: false,
  }));
}

export function compareResumeToJob(
  resumeText: string,
  jobDescription: string,
): { matched: KeywordResult[]; missing: KeywordResult[]; overallScore: number } {
  const keywords = extractKeywords(jobDescription);
  const matched: KeywordResult[] = [];
  const missing: KeywordResult[] = [];
  for (const keyword of keywords) {
    const foundInResume = mentionsTerm(resumeText, keyword.keyword);
    (foundInResume ? matched : missing).push({ ...keyword, foundInResume });
  }
  const totalWeight = keywords.reduce((sum, keyword) => sum + keyword.score, 0);
  const matchedWeight = matched.reduce((sum, keyword) => sum + keyword.score, 0);
  return {
    matched,
    missing,
    overallScore: totalWeight ? Number((matchedWeight / totalWeight).toFixed(3)) : 0,
  };
}
