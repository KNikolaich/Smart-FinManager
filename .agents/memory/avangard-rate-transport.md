---
name: Avangard rate transport
description: Why Avangard cashless quotes need a safe fallback transport in Replit.
---

Keep the HTTPS reader fallback for Avangard quotes unless direct access is confirmed to work reliably in the current environment. Do not solve access failures by globally disabling TLS certificate verification.

**Why:** Avangard's official server requires legacy TLS renegotiation and then presents a chain rejected as self-signed from Replit. A normal direct request fails, while the reader transport returns the same official page and current cashless quotes over a valid TLS connection.

**How to apply:** When changing the bank-rate provider or fetch path, test a real refresh in Replit and verify the parsed source timestamp plus USD/EUR/CNY buy and sell values. Preserve explicit failure when neither safe transport works.