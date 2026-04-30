# AGENT.md

This is the single required entry document for every human or agent working in this repository.

## Mandatory Reading Order

1. Read this file first.
2. Read `PROJECT_CONTEXT.md` before making any code, design, schema, or architecture change.
3. If touching Next.js APIs, routing, layouts, Server Components, Client Components, or build behavior, read the relevant local Next.js 16 guide under `node_modules/next/dist/docs/`.

## Next.js 16 Warning

This is not the Next.js version many agents remember from training data. APIs, conventions, routing behavior, and file structure may differ. Follow the local docs in `node_modules/next/dist/docs/` and heed deprecation notices before editing framework-level code.

## Engineering Contract

- All development must obey `PROJECT_CONTEXT.md`.
- Do not introduce fake demo data as if it were real data. Empty states are allowed; fake metrics, fake related items, fake AI output, and pseudo-connected data are not.
- Preserve user data in both localStorage mode and Supabase mode.
- Do not revert unrelated worktree changes. This repo may contain user changes or generated experiments outside the current task.
- Keep visual changes consistent with the existing quiet, dense, work-focused interface unless the task explicitly asks for a new design direction.
- Major iterations must update `PROJECT_CONTEXT.md` with any changed architecture, data model, workflows, constraints, or known risks.

## Verification Before Handoff

For functional changes, run:

```bash
npm run lint
npm run build
```

For UI/data-flow changes, also verify the app in the browser at `http://127.0.0.1:3000`.

## Current High-Risk Areas

- Autosave and persistence reliability.
- Supabase/localStorage parity.
- Todo drag/drop status updates.
- Entity relationships between Space, Note, Document, Todo, and Attachment.
- JSON import/export remapping.
- Date-only Todo due dates.

