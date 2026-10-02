---
name: ui-ux
description: Use when building or changing anything in inertia/ — pages, components, forms, tables, dialogs, editor UI, loading/empty/error states, theming, accessibility, copy, responsive behaviour. Triggers on "make a page", "add a form", "design the UI", "style this", "button", "dialog", "modal", "toast", "skeleton", "empty state", "responsive", "dark mode", "accessible", "aria", "tailwind", "shadcn", "layout", "dashboard", "looks off". Enforces this repo's tokens, shadcn/ui + Tailwind v4 conventions, and WCAG 2.2 AA.
---

# UI/UX for capstone_demo

Stack: React 19 + Inertia + Tailwind v4 + shadcn/ui (Radix primitives) + Lucide icons,
styled by `next-themes` for light/dark. Aliased imports: `@/components/ui/*`,
`@/components/*`, `@/lib/utils` (`cn`), `@generated/*` for route/entity types.

## Tokens only — never raw values

`inertia/css/app.css` defines the whole design system. There are no arbitrary hex
values in component code.

| Token group | Use |
|---|---|
| `bg-background` / `text-foreground` | page base |
| `bg-card` / `text-card-foreground` | surfaces, elevated panels |
| `bg-primary` / `text-primary-foreground` | the single accent action (yellow) |
| `bg-secondary`, `bg-muted`, `bg-accent` | subtle surfaces, hover fills |
| `text-muted-foreground` | secondary/helper text |
| `border-border`, `bg-input` | dividers, field borders |
| `bg-destructive` / `text-destructive` | errors, delete confirmations |
| `ring-ring` | focus rings |
| `--font-sans` (Instrument Sans) | body/UI |
| `--font-heading` (`font-heading`) | headings via DM Serif Display |
| `--color-ink`, `--color-paper`, `--color-yellow` | named brand tokens |
| `--color-ink-muted`, `--color-ink-faint` | text hierarchy |

**Sharp corners are the identity.** `app.css` forces
`* { border-radius: 0 !important }`, so `rounded-*` utilities in the shadcn stubs are
intentionally dead. Do not fight it by removing the override or adding `!important`
rounding. Cards get their softness from `ring-1 ring-foreground/5` and `shadow-sm`, not
from border-radius.

Dark mode is `.dark` on `<html>`; every token has a `.dark` counterpart. Never
hard-code a light-only color. Verify both themes.

## Component rules

- Reuse before building. Available in `inertia/components/ui/`: button, input, textarea,
  label, card (+Header/Title/Description/Action/Content/Footer), dialog, alert_dialog,
  dropdown_menu, select, tabs, table, badge, separator, skeleton, tooltip, popover, sonner.
- Adding a component: `npx shadcn add <name>` (`shadcn@^4` is already a dependency; config
  and aliases live in `components.json`). Do not hand-copy from the shadcn site.
- shadcn is **your** code to edit. Fix a bug in `inertia/components/ui/*` in place rather
  than wrapping it in a divergent local copy.
- Use `cn()` to merge classes — it flattens Tailwind v4 conflicts. The `cn` package is a
  direct dependency and the shadcn stubs import it as `from 'cn'`; `@/lib/utils`
  re-exports it plus repo helpers (`duplicateContent`, `isValidUrl`). Match whichever
  import the neighbouring file uses. Never hand-roll a conditional class string.
- Variants via `cva` — extend `buttonVariants`, don't add conditional ternary soup in
  JSX. The stubs use `data-variant` / `data-size` attributes for this.
- Prefer composition over config props. `<Card><CardHeader>…` beats `<Card title
  description action>`.
- Icons: `lucide-react`. Convention is a `size-4` icon in a `gap-1.5` button, `shrink-0`,
  `aria-hidden` when decorative.
- New primitives keep `data-slot="…"` (that's how the Tailwind variants target them).

## Inertia conventions

- Page components in `inertia/pages/**` (one dir per resource), feature components in
  `inertia/components/**`. Pages compose; they don't inline everything.
- Shared props via `@generated/data`'s `Data.SharedProps` — `children.props.user`,
  `children.props.flash`. The default layout (`inertia/layouts/default.tsx`) already
  handles auth-aware nav, theme toggle, and flash → toast.
- Use `Form`/`Link` from `@adonisjs/inertia/react` so Inertia gets `route`, `method`,
  `data` props. Don't hand-roll `href="/documents/create"` — that breaks the route
  registry.
- Type pages against generated types; run `node ace codegen` after backend changes.

## Every interactive state

A control is not done until all of these exist:

- **default / hover / active / focus-visible / disabled** — the button stub already
  covers these; you're responsible for other primitives
- **loading** — disable the control and show progress; disable double-submit
- **error** — `aria-invalid` + `destructive` border; message adjacent to the field
- **empty** — an intentional empty state, not a blank div. Say what's missing and give
  the action that fixes it
- **loading skeleton** — `<Skeleton />`, not a spinner, for content that replaces a
  known layout
- **success/failure feedback** — `toast.success` / `toast.error` via `sonner`, already
  wired to `flash` in the layout

## Accessibility (WCAG 2.2 AA)

Non-negotiable:

- Keyboard operability: every interactive element reachable and operable by keyboard,
  visible focus, logical tab order, `Escape` closes dialogs/popovers (Radix gives this
  free — don't break it)
- `Dialog`: Radix `DialogTitle` is mandatory; use `DialogDescription` or
  `aria-describedby={undefined}`. Focus is trapped and restored for you
- Icon-only control → `<span className="sr-only">Label</span>` or `aria-label`. An
  unlabelled icon button fails
- Form fields need a real `<Label htmlFor>`; placeholders are not labels
- `aria-live="polite"` for async results (search results, save confirmation);
  `role="alert"` / `aria-live="assertive"` for errors
- **Contrast ≥ 4.5:1** for body text, ≥ 3:1 for large text and UI borders. `--color-ink-faint`
  on `--color-paper` is borderline — verify before using for anything but decoration.
- **Never color alone**: status needs text or an icon too. `status.tsx` shows the pattern
- Respect `prefers-reduced-motion`; avoid gratuitous animation
- Target ≥ 24×24 CSS px for touch targets (AA 2.2); the repo's `size-xs` buttons (h-6 =
  24px) are the floor
- Alt text on meaningful images; `alt=""` on decorative ones

## Layout & responsiveness

- Content max-width `max-w-5xl` inside `mx-auto px-4` (matches the header)
- Header is `h-14`; keep page rhythm on that scale
- Mobile-first: no fixed widths on containers, use `grid-cols-1 sm:grid-cols-*`,
  wrap toolbars, collapse tables to stacked cards on small screens
- Long text truncates with `truncate`; never let it break the layout
- Consistency over novelty: identical card header/action placement across the app

## Forms

- Validate on the server with a VineJS validator (`app/validators/*.ts`) — the client
  mirror is UX polish, never the source of truth
- Show errors where the field is, not only in a toast
- Disable the submit button while in flight, restore on error
- Keep the user's input on validation failure; never clear a form because of a server error
- Destructive actions require `AlertDialog` confirmation naming the specific thing

## Before calling a UI change done

- [ ] Tokens only, no raw hex/`text-[13px]` unless the scale truly lacks a value
- [ ] Dark mode checked
- [ ] All interactive states present
- [ ] Keyboard-only walkthrough: tab, activate, escape
- [ ] Screen-reader labels on every control
- [ ] Contrast checked
- [ ] Mobile viewport checked
- [ ] Empty and error states designed, not accidental
- [ ] `npm run typecheck && npm run lint` passes