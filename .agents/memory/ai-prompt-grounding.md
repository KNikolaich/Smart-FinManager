---
name: AI prompt grounding
description: Avoiding cross-request detail leakage from prompt examples in financial-assistant outputs.
---

Financial AI prompts must explicitly ground amounts, dates, people, and account details in the current user request. Keep examples generic or use placeholders; a concrete amount in a prompt example can be repeated in an unrelated reminder.

**Why:** A specific loan example in the system prompt was followed by an unrelated reminder response that included the example's amount.

**How to apply:** When changing AI prompts, remove incidental example values and state that reminder text must not acquire unstated amounts or transaction details. For clear date-specific reminders, prefer deterministic parsing so model classification cannot silently drop the action.