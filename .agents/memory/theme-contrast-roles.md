---
name: Theme contrast roles
description: Durable rules for keeping the application's light and dark theme families visually consistent.
---

Every theme should provide complete semantic roles for page, card, input, primary text, muted text, borders, action color, and `color-scheme`. Light themes use soft light surfaces and dark text; dark themes use dark surfaces and light text.

**Why:** Components still contain many palette utility classes. Complete theme roles and theme-scoped overrides prevent those legacy classes from leaking light panels or dark text into the opposite theme family.

**How to apply:** When adding or editing a theme, verify all semantic variables and check common pastel backgrounds, colored status text, and shadow strength in both theme families.