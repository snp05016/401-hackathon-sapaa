---
name: "resume-surgeon"
description: "Tailors a user's LaTeX resume to a specific job description using declared preferences, evidence-grounded rewriting, ATS-oriented review, and strict anti-hallucination checks. Use for resume tailoring, resume-to-job scoring, and gap analysis when a resume and job description are available."
---

# Resume Surgeon

Resume Surgeon is a candidate-agnostic instruction set for producing a truthful, job-specific resume from a user's master LaTeX resume. It is designed for a cloud LLM, but keeps deterministic parsing, validation, storage, and compilation outside the model whenever the host application can provide them.

The skill never assumes a particular person, school, employer, project, repository, directory layout, or technical domain. Candidate facts, source files, evidence, and preferences are runtime inputs.

## Required runtime inputs

The host must provide or explicitly mark as unavailable:

- `master_resume_tex`: the immutable source resume;
- `job_description`: normalized job text plus source URL when available;
- `candidate_profile`: candidate identity and verified background facts;
- `evidence_records`: optional structured evidence for claims, projects, metrics, and skills;
- `tailoring_preferences`: the schema in `references/candidate_preferences.md`;
- `output_context`: application identifier and safe destination for a separate tailored version.

If the resume or job description is missing, stop and request it. Missing optional evidence stays unknown; never infer personal facts from a job description.

## Non-negotiable rules

1. Never overwrite the master resume.
2. Never invent or upgrade a skill, employer, role, project, date, metric, credential, scope, or outcome.
3. A job-description keyword may appear only when supported by the resume, candidate profile, evidence records, or an explicit current-session statement from the user.
4. Treat unverified skills as gaps. Do not add them to the resume merely because they are learnable.
5. Respect the user's declared preferences unless they conflict with truthfulness, privacy, or document validity.
6. Send only the minimum resume, job, preference, and evidence context needed for a cloud-model call.
7. Keep every proposed change reviewable and preserve the original source.
8. Fail safely on provider errors, invalid LaTeX, suspicious output, or unverifiable claims.

## Intent routing

| Intent | Required inputs | Action |
|---|---|---|
| `tailor_resume` | Resume + job description | Run the complete workflow in `workflow.md`. |
| `score_resume` | Resume + job description | Run intake, parsing, and baseline evaluation only. Do not edit files. |
| `analyze_gaps` | Resume + job description | Identify supported matches, unknowns, and truthful gaps. Do not add unsupported claims. |

Application tracking, job fetching, user-profile collection, and cloud-provider orchestration belong to the host product and are outside this skill.

## Progressive module loading

Load only what the current stage needs:

- Intake and preferences: `references/candidate_preferences.md`
- Parsing and ATS review: `methodology/ats_forensics_and_parsing.md`
- Matching: `methodology/matching_and_scoring.md`
- Evidence and gaps: `methodology/gap_closing_and_interview_risk.md`
- Truth constraints: `rules/preservation_and_anti_hallucination.md`
- LaTeX validation: `rules/latex_and_layout_qa.md`
- Reports and examples: `examples/ats_report_templates.md`, `examples/bullet_diff_examples.md`
- Host architecture and optional evidence storage: `references/ats_system_specification.md`, `references/second_brain_templates.md`

## Output contract

A successful tailoring run returns:

- a separate tailored `.tex` document;
- a change report with literal before/after diffs;
- a claim-evidence ledger for every added or materially changed claim;
- validation results, including compile and page-count status when tooling exists;
- unresolved gaps and questions, without fabricating answers.

The host application decides where artifacts are stored and whether the user must approve changes before saving. Default to explicit review when that preference is absent.
