# Финансист AI (Financier AI)

## Overview
An AI-powered personal finance management web application. Users can track transactions, plan budgets, set financial goals, and interact with an AI assistant for financial insights.

## Architecture

### Full-stack TypeScript (Monolith)
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Backend**: Node.js + Express (served via `server.ts`)
- **Database**: PostgreSQL via Prisma ORM
- **AI**: Google Gemini API / DeepSeek integration
- **Auth**: JWT-based authentication with bcrypt password hashing

### How it runs
In development, `tsx server.ts` starts Express which integrates the Vite dev server as middleware — serving both the API and the React SPA on **port 5000**.

In production, the frontend is built with `vite build` (into `dist/`) and Express serves the static files.

## Key Files
- `server.ts` — Main Express server with all API routes and Vite middleware integration
- `prisma/schema.prisma` — Database schema (Users, Accounts, Transactions, Goals, Categories, etc.)
- `src/` — React frontend source
- `src/lib/api.ts` — API client using relative `/api` paths
- `vite.config.ts` — Vite configuration (host: 0.0.0.0, allowedHosts: true for Replit proxy)

## Database
- Replit built-in PostgreSQL
- Prisma ORM for type-safe queries
- Schema pushed via `npx prisma db push`

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection (auto-set by Replit)
- `JWT_SECRET` — Token signing secret (set in shared env)
- `NODE_ENV` — "development" or "production"
- `GEMINI_API_KEY` — (optional) Google Gemini AI key
- `DEEPSEEK_API_KEY` — (optional) DeepSeek AI key

## Development
```bash
npm run dev       # Start dev server (tsx server.ts) on port 5000
npm run build     # Build frontend (vite build)
npx prisma db push  # Sync schema changes to database
```

## Port Configuration
- Port **5000** — Main app (frontend + API combined)

## Workflow
- "Start application" — runs `npm run dev`, waits for port 5000
