# Project Context

This document is the engineering map for the Personal OS / knowledge workbench. Keep it current. Any major iteration must update this file before handoff.

## Product Overview

The app is a local-first personal knowledge and task workspace. It combines:

- Spaces / knowledge bases for organizing work areas.
- Ideas / notes for quick capture and AI-assisted metadata.
- Markdown documents for longer-form knowledge.
- Todo tasks with board/list workflows.
- Attachments linked to spaces, notes, or documents.
- A context panel that shows real related data for the selected scope.

The product should feel like a focused operating surface for repeated daily work, not a marketing site or decorative dashboard.

## Technical Stack

- Next.js 16 with the App Router.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Supabase for optional cloud auth, database, and file storage.
- localStorage for local-first mode.
- lucide-react for icons.
- react-markdown and remark-gfm for Markdown rendering.
- MiniMax-compatible AI endpoint at `src/app/api/ai/ideas/analyze/route.ts`.

Important: because this is Next.js 16, read local framework docs under `node_modules/next/dist/docs/` before framework-level edits.

## Key Paths

- `src/app/page.tsx`: root page entry.
- `src/components/app-shell.tsx`: top-level state orchestration, auth/session, optimistic mutations, autosave, import/export, upload flow, and view selection.
- `src/components/workbench/views.tsx`: presentational UI for sidebar, dashboard, notes, documents, todos, context panel, settings, and command palette.
- `src/components/ui.tsx`: shared UI primitives such as buttons, dialogs, loading, empty states, and toast stack.
- `src/lib/types.ts`: shared workspace domain types.
- `src/lib/repository.ts`: persistence boundary for localStorage and Supabase.
- `src/lib/supabase.ts`: Supabase client setup.
- `supabase/schema.sql`: cloud schema, RLS policies, and storage bucket policies.

## Current Data Model

Workspace data contains:

- `Space`
- `Note`
- `DocumentItem`
- `Todo`
- `Attachment`

Todo and Attachment both use a real parent relation:

- `entity_type`: `"space" | "note" | "document"`
- `entity_id`: parent id, or the owning `space_id` for space-level Todo.

Important invariants:

- `Todo.space_id` is always the owning space.
- `Todo.entity_type/entity_id` is the displayed relationship source for Related Todo.
- `Attachment.entity_type/entity_id` controls context attachment visibility.
- `Todo.due_date` is date-only: `YYYY-MM-DD | null`.
- Do not parse date-only values with `new Date("YYYY-MM-DD")`; compare local date strings.
- Cloud imports must remap object ids and `user_id` for the current user.
- Local imports still need normalization and legacy migration.

## Design Direction

The current visual direction is quiet, utilitarian, compact, and work-focused:

- Prefer dense but readable layouts.
- Keep cards restrained and purposeful.
- Use real data for metrics, tags, related todos, attachments, and AI information.
- Use icons for compact commands.
- Keep editing controls close to their object but collapsed when they are secondary.
- Avoid large decorative hero sections, fake preview content, one-note palettes, gradient blobs, and decorative filler.
- Empty states should be honest and lightweight.

The sidebar knowledge base list should remain compact. Editing space metadata should be hidden behind an explicit edit control instead of permanently expanded.

## What You Can Do

- Refactor UI into smaller components when it reduces complexity and keeps data flow clear.
- Add focused repository helpers for local/cloud parity.
- Add migrations or normalization when domain types evolve.
- Improve accessibility, keyboard flow, and browser verification.
- Improve visual consistency while preserving the current product direction.
- Add tests or verification scripts when risk warrants it.

## What You Should Not Do

- Do not reintroduce hardcoded fake operational data.
- Do not infer relationships from shared tags when a persisted relation exists or is required.
- Do not serialize full Todo objects for drag/drop updates.
- Do not use one global debounce timer for unrelated autosaves.
- Do not upsert imported cloud records with external `user_id`, `space_id`, or entity references.
- Do not convert date-only Todo due dates to ISO datetimes.
- Do not move major persistence behavior into UI components if it belongs in `repository.ts`.
- Do not revert unrelated dirty files or generated experiments unless the user explicitly asks.

## Known Bug History

The project previously had these issues and they must not come back:

- Autosave dropped earlier edits because notes/documents shared one debounce timer.
- Cloud JSON import preserved foreign/local ownership data.
- Todo drag/drop serialized stale full Todo objects and overwrote fresh fields.
- Related Todo was inferred from tags and sometimes fell back to all scoped todos.
- Todo date filtering shifted by timezone because date-only strings were parsed as datetimes.
- Knowledge base sidebar cards expanded too much editing UI by default and became visually inconsistent.

## Verification Checklist

Before handoff on functional changes:

```bash
npm run lint
npm run build
```

Browser verification at `http://127.0.0.1:3000` should cover relevant changed flows:

- Dashboard metrics come from real workspace data.
- Todo create/edit/drag/drop persists after refresh.
- Note and Document autosave do not cancel each other.
- Related Todo is based on true `entity_type/entity_id`.
- JSON import/export preserves connected references after normalization/remapping.
- Attachments write the correct local or Supabase path.
- Date filters do not shift days in local timezone.

## Update Rule

After a major iteration, update this document with:

- New or changed architecture.
- New domain models or schema fields.
- Changed UX/design rules.
- New verification steps.
- Known risks or intentionally deferred work.

