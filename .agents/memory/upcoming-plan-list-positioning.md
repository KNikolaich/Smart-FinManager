---
name: Upcoming plan list positioning
description: The intended initial scroll position for the calendar's upcoming-plan list.
---

The calendar list should open with the focused incomplete occurrence at the top of the visible window. Earlier completed or overdue occurrences remain in the same chronological list and must be reachable by scrolling upward, but should not occupy the initial viewport.

**Why:** Users need the first actionable plan immediately, while still retaining access to historical occurrences for review and editing where allowed.

**How to apply:** When changing occurrence filtering, focus selection, or list pagination, preserve this invariant and test both the visible first row and access to earlier history.