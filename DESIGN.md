# Personal OS Design Direction

This project uses a DESIGN.md-style design brief inspired by the `awesome-design-md` collection, especially the warm content-first minimalism of Notion, the precise operational density of Linear, the command-first speed of Raycast, and the restrained monochrome discipline of Vercel.

## Product Mood

Personal OS is a quiet, premium knowledge workbench. It should feel like a focused operating surface, not a marketing page: dense enough for repeated daily use, calm enough for thinking, and polished enough that every action feels intentional.

## Visual Principles

- Use warm neutral surfaces rather than cold grays.
- Use one dominant accent per view: emerald/teal for creation, selection, and AI insight.
- Prefer whisper borders and subtle tonal separation over heavy shadows.
- Keep cards compact, scannable, and information-rich.
- Use typography, spacing, and state feedback to create hierarchy before adding decoration.
- Avoid gradients, glowing blobs, nested cards, and oversized hero sections.

## Layout System

- Three-column desktop shell: left navigation, central work surface, right context.
- Mobile shell: top navigation tabs, content-first layout, context as a bottom drawer.
- Main content width should be constrained where reading/editing benefits from focus.
- Todo and idea surfaces should use compact repeated rows/cards rather than large preview panels.

## Component Rules

- Buttons: 8px radius or less, clear hover/pressed states, icon-first when the action is familiar.
- Cards: subtle border, low shadow, 12px radius only for primary content cards.
- Inputs: quiet background, visible focus ring, no decorative effects.
- Tags/chips: small, rounded, text-first, used for metadata and filtering.
- Empty states: one clear primary action.

## Motion

- Micro-interactions only: opacity and transform, 160-200ms max.
- Respect `prefers-reduced-motion`.
- No large layout or blur animations.

## Typography

- Use the app sans font for all UI.
- Headings use `text-balance`.
- Body text uses `text-pretty`.
- Counts and dates use `tabular-nums`.
- Do not add negative letter-spacing.
