---
name: Vite watch loop on Replit runtime files
description: Dev-server reloads caused by Vite watching Replit runtime logs or command-cache files inside the project root.
---

Replit writes live workflow stdout/stderr into `.local/state/workflow-logs/<id>/<workflow>.shell.exec.0`, which lives inside the project root. On-demand `npx` commands can also write under `.cache/checkpoint-nodejs/`. Vite's default file watcher (chokidar) does not ignore these paths.

**Symptom:** the running app enters a tight reload loop — full-page reload every ~1s, each one re-triggering `/auth/me` + `/initial-data` fetches and a new socket.io connect/disconnect, visible as thousands of repeated log lines in a short window. It can look like an app bug (e.g. a mis-keyed `useEffect`) but is actually infra-level: every reload's own console/API-request output gets appended to the log file Vite is watching, which re-triggers another reload, forever.

**Why:** Vite sees the runtime file change and performs a full reload. For live logs, that reload itself produces more logs and becomes self-sustaining. For request-triggered `npx` commands, it can terminate the very browser request that started the command.

**How to apply:** exclude `**/.local/**`, `**/.cache/**`, `.agents/**`, and `.git/**` in Vite's watcher. Prefer installed local CLI binaries for commands started by HTTP handlers over `npx`. If a dev server appears stuck in a reload storm right after a restart, check runtime-file writes before assuming it is an app bug.
