# Smart-FinManager design-system instructions

Use this artifact as the visual source of truth for future Smart-FinManager mockups and artifacts. It describes the existing product language; it is not permission to redesign the application.

## Before authoring

- Read `docs/design-system.md`, then load `src/tokens.css`.
- Use Inter for all UI text. Keep the current Nordic light theme as the default: sky primary, emerald financial meaning, cool neutral surfaces, and warm coral as the existing muted-text exception.
- Prefer semantic aliases (`--color-action`, `--color-income`, `--surface-page`) over raw values in new work.
- Existing app screens and source files must not be changed until the user explicitly approves applying this system.

## Tokens and type

- Base text is Inter 400–700. Use `--type-display` for balances, `--type-title` for section headings, `--type-label` for compact uppercase metadata, and `--type-body` for explanations.
- Use the extracted 10 / 12 / 14 / 16 / 18 / 24 / 32px scale. Money figures may use 28–36px when they are the primary value.
- Keep labels short, sentence case where possible, and use uppercase tracking only for compact metadata.

## Layout

- Use the 4px rhythm: 4, 8, 12, 16, 24, 32, 40px.
- Use 12px for small controls, 16px for cards and account tiles, 24px for primary cards and 32px for modal tops on mobile.
- Keep content mobile-first. Bottom navigation is a floating rounded 54px bar on narrow screens; desktop may use a full-width bottom rail; landscape may use a 80px vertical rail.

## Color roles

- `--color-action` / `--color-action-strong`: Nordic sky blue for primary actions and selected navigation.
- `--color-income`: emerald for positive money movement and success.
- `--color-expense`: rose for negative balances and destructive/error states.
- `--color-warning`: amber for stale/offline caution.
- `--surface-page`, `--surface-card`, `--surface-input`: cool neutral layers, never arbitrary white/black substitutions.
- Always pair status color with text or an icon; do not communicate meaning by color alone.

## Shape and elevation

- Inputs and primary cards use rounded 2xl (16px); grouped settings and transaction surfaces use rounded 3xl (24px); compact navigation controls use 18px.
- Use `--shadow-soft` for normal cards and `--shadow-elegant` for floating surfaces. Avoid hard, dark, or colorful glows.
- Borders are quiet cool neutrals. Use backdrop blur only for sticky header and navigation surfaces.

## Interaction and accessibility

- Every control needs a visible hover, focus-visible, pressed, disabled, loading, and error treatment where applicable.
- Use a 2px action-colored focus ring with at least 2px offset. Preserve keyboard access for menus, tabs, tooltips, and dialogs.
- Icon-only actions need an accessible name and a 40px minimum hit area. Never rely on hover-only information on touch devices.
- Respect `prefers-reduced-motion`; transitions should primarily animate opacity and transform.
- Use semantic headings, `role="status"` for connectivity notices, and live regions for transient toasts.

## Do / don't

**Do:** show balances with aligned numerals, make income/expense polarity explicit, preserve calm whitespace, use real empty/error/offline states, and keep destructive actions visually distinct.

**Don't:** introduce a new brand palette, use emoji as icons, use neon gradients, use generic stock imagery, flatten all surfaces into one gray, or use colorless “minimalism” for financial meaning.
