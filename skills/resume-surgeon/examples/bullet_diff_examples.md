# Truthful Bullet Editing Examples

These examples are synthetic and do not describe a real candidate.

## Verified terminology refinement

Evidence says the candidate built request validation with Pydantic across a Python API.

```diff
- Built Python API endpoints and added validation for incoming requests.
+ Built Python API endpoints with Pydantic request validation and typed response schemas.
```

Allowed because the added terminology is supported by evidence and does not change ownership or outcomes.

## Verified emphasis change

Evidence says the candidate built an internal inventory dashboard in React and created reusable components.

```diff
- Built an internal inventory dashboard for warehouse operations using React.
+ Created reusable React components for an internal inventory dashboard used in warehouse operations.
```

Allowed because the product identity stays fixed while a verified frontend facet is foregrounded.

## Unsupported skill substitution

The job description asks for Kubernetes, but the candidate evidence mentions only Docker.

```diff
- Containerized the service with Docker for local and test environments.
+ Deployed the service to Kubernetes with autoscaling and zero-downtime releases.
```

Rejected: the job description is not evidence, and the new platform, deployment scope, and outcomes are unsupported.

## Metric inflation

```diff
- Reduced report preparation time through an automated export workflow.
+ Reduced report preparation time by 70% for 10,000 monthly users.
```

Rejected unless both numbers and their measurement basis are verified.

## Accurate evidence depth

If the candidate confirms classroom exposure but no project use:

```diff
- Skills: Python, SQL
+ Skills: Python, SQL, GraphQL
```

This is allowed only if the candidate explicitly confirms GraphQL familiarity and the resume's skills format permits familiarity-level items. It must not be described as production experience.
