# Smart-FinManager design system

## What was extracted

This system is an observation of the current Smart-FinManager interface, not a replacement identity. The source combines an approachable personal workspace with compact, precise finance patterns: a sticky branded header, a balance-and-trend card, horizontally scrolling account tiles, grouped transaction rows, a floating mobile navigation bar, and settings organized into generous rounded groups.

The visual language is **Nordic utility**: cool, bright surfaces and sky-blue actions create calm; emerald and rose are reserved for financial polarity; soft shadows and rounded geometry keep money operations friendly rather than institutional. Inter carries both the everyday and analytical voices.

## Product principles

1. **Clarity before decoration.** The amount, direction, account, and date should scan in that order.
2. **Calm confidence.** Cool surfaces, restrained borders, and soft elevation make the workspace feel dependable.
3. **Polarity is explicit.** Income is emerald, expense is rose, transfer is blue; labels and signs reinforce the color.
4. **Offline is a first-class state.** Cached data, staleness, queued operations, and automatic retry should be understandable without panic.
5. **Small-screen competence.** Cards scroll horizontally, navigation floats within thumb reach, and modal forms become full-height on mobile.

## Observed source tokens

The source `src/index.css` defines Inter, `#0ea5e9` Nordic primary, `#e0f2fe` primary-light, `#0284c7` primary-dark, `#f8fafc` page background, `#ffffff` surfaces, `#0f172a` text, `#ff6b3d` muted text in the Nordic variant, and `#e2e8f0` borders. Shared shadows are `0 2px 15px -3px rgba(0,0,0,.07), 0 4px 6px -2px rgba(0,0,0,.05)` and `0 20px 25px -5px rgba(0,0,0,.05), 0 10px 10px -5px rgba(0,0,0,.02)`. The UI also uses emerald `#10b981`, rose `#f43f5e`/`#e11d48`, blue `#3b82f6`, amber `#f59e0b`, and translucent primary-light fills.

`src/tokens.css` keeps these observed values and adds recommended semantic aliases so artifacts can consume roles without coupling to implementation names.

## Typography

Inter is loaded at 300, 400, 500, 600, and 700. Compact labels use 10–12px, body copy 14px, controls 14–16px, section titles 18px, and hero balance values 28–36px. Labels often use bold uppercase tracking; body copy stays sentence case and relaxed.

## Component taxonomy

- **Shell:** AppHeader, OfflineBanner/Chip, BottomNav.
- **Financial summary:** TotalBalanceCard, income/expense stat tiles, area trend chart.
- **Entity browsing:** account tiles with currency marker, comment badge, balance polarity, and context action.
- **Activity:** grouped transaction surface with date dividers, account/category metadata, signed amounts, empty state, and add action.
- **Entry:** full-height mobile / centered desktop transaction modal with segmented type control, amount field, date, account selectors, category, description, calculator, and save/cancel bar.
- **Feedback:** success/error/info toasts, offline and stale-cache banners, disabled/loading states.
- **Management:** rounded settings groups, icon-leading rows, theme picker, data tools, and confirmation surfaces.

## Theme strategy

Nordic is the default light theme. Existing alternatives are preserved as families: light-green, light-blue, light-ruby, light-orange, light-violet, midnight, carbon, OLED, forest-dark, nocturnal, cyber, and black-and-white. Each changes primary, page, surface, text, muted text, border, and input roles while component geometry remains stable. Dark families set `color-scheme: dark`; artifacts should use the same semantic roles rather than special-casing components.

## Application boundary

This documentation and catalog are design-system artifacts only. They do not modify the existing application screens. Apply these tokens to the main app only after explicit user approval.
