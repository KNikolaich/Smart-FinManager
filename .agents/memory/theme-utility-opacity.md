---
name: Theme utility opacity
description: How project-specific semantic Tailwind-like color utilities behave when used with opacity suffixes.
---

Custom semantic utilities such as `bg-theme-surface` do not reliably provide slash-opacity variants automatically. Define each opacity variant explicitly with `color-mix` and the semantic CSS variable.

**Why:** A missing custom opacity class leaves the element transparent, which can expose an unintended light page background or make contrast appear wrong in dark themes.

**How to apply:** When adding a new `theme-*` utility with `/NN` usage, add the escaped selector to the shared utility block and use the corresponding semantic variable rather than a hardcoded light color.