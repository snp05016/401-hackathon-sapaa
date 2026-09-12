# Codex Adapter

The vendor-neutral agent definitions live in `.agents/` at the repository root.
They are the only canonical source for role behavior.

This directory contains a thin Codex adapter:

- `config.toml` enables project-scoped subagents.
- `agents/*.toml` registers each portable role with Codex.
- Each TOML file instructs the spawned agent to read its corresponding canonical
  Markdown definition before beginning work.

Do not duplicate full agent prompts here. Make behavioral changes in
`.agents/*.md`, then update an adapter only when registration metadata changes.

See `.agents/README.md` for role selection, cross-model usage, task templates,
project constraints, and workflow examples.
