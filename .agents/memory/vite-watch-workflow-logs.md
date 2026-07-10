---
name: Vite watch loop on Replit workflow logs
description: Infinite dev-server reload loop caused by Vite watching Replit's own workflow log directory inside the project root.
---

Replit writes live workflow stdout/stderr into `.local/state/workflow-logs/<id>/<workflow>.shell.exec.0`, which lives inside the project root. Vite's default file watcher (chokidar) does not ignore this path.

**Symptom:** the running app enters a tight reload loop — full-page reload every ~1s, each one re-triggering `/auth/me` + `/initial-data` fetches and a new socket.io connect/disconnect, visible as thousands of repeated log lines in a short window. It can look like an app bug (e.g. a mis-keyed `useEffect`) but is actually infra-level: every reload's own console/API-request output gets appended to the log file Vite is watching, which re-triggers another reload, forever.

**Why:** the log file grows because the app itself is running and logging; Vite sees that file change and does a full-reload; the reload produces more logs; the loop is self-sustaining and can persist for many minutes without any code changes.

**How to apply:** add `server.watch.ignored` in `vite.config.ts` excluding `**/.local/**` (and similarly `.agents/**`, `.git/**`) so Vite never watches Replit's own state/log directories. If a dev server appears stuck in a reload storm right after a restart, check `.local/state/workflow-logs/*/*.shell.exec.0` line counts over a few seconds before assuming it's a real app bug.
