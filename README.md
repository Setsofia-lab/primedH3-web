# PrimedHealth — Phase 1 (Next.js)

AI-orchestrated perioperative coordination platform.

**Live demo:** https://primedh3-web.vercel.app
**Repo:** https://github.com/Setsofia-lab/primedH3-web

## What's in here

A pixel-exact Next.js 16 port of the Phase 1 prototype, end-to-end across every role:

| Route | Surface |
|---|---|
| `/` `/services` `/problem` `/contact` | Marketing site |
| `/login` `/role` `/onboarding` | Auth flow + facility-onboarding wizard |
| `/app/admin/...` | Dashboard · cases · users · agents · audit · prompts |
| `/app/surgeon/...` | Cases list · case cockpit · new case · schedule · messages · sign-offs |
| `/app/anesthesia/...` | Queue · clearance · cleared · deferred · guidelines |
| `/app/coordinator/...` | Board · tasks · messages · patients · providers |
| `/app/patient/...` | Mobile PWA: home · journey · prep · chat · learn · visits · profile |

## Tech stack

- **Next.js 16** (App Router, React 19, TypeScript strict)
- **Tailwind v4** with design tokens from `CONSTITUTION.md` §2
- **Zustand** (session) + **TanStack Query** (data, M11+)
- **React Hook Form + Zod** (login form)
- **MSW** (mock APIs, scaffolded for M11+)
- **Storybook 8** (scaffolded)
- **Vitest + Playwright + @axe-core/playwright**
- **next-pwa**-ready manifest at `/manifest.webmanifest`

## Running

```bash
pnpm install
pnpm dev               # http://localhost:3000
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:e2e
pnpm build
```

## Phase 1 demo flow

1. Land on `/` → click **Sign in**
2. Enter any email + 4-char password (or use SSO buttons) — emails containing `onboard` route to the wizard
3. Pick a role at `/role`
4. Admin first-time → 4-step `/onboarding` → `/app/admin`
5. Switch role any time from sidebar avatar (or the patient profile sign-out)

All data is hardcoded synthetic (`src/mocks/fixtures/admin.ts`); no PHI. Live agent activity stream simulates events every 5s on the admin dashboard.

## Ship history

| Milestone | Commit | Notes |
|---|---|---|
| M0  | `5090772` | Scaffold + tooling + design tokens |
| M1+M2 | `2e4be7c` | Design system + 4 marketing pages |
| Reworks | `7441355` | Drop SchedulingAgent, qualitative stats, animations, Calendar CTAs |
| M3 | `b14f70d` | Login + role picker + onboarding wizard |
| M4 | `ede6c1b` | App shell (sidebar, topbar, role modal) |
| M5 | `28732de` | Admin: 6 surfaces |
| M6 | `d8d7422` | Surgeon: 6 surfaces |
| M7 | `b14d283` | Anesthesia: 5 surfaces |
| M8 | `5e05d6d` | Coordinator: 5 surfaces (Kanban) |
| M9 | `93d703f` | Patient PWA: 7 surfaces + manifest + iOS install |
| M10 | (this) | Vercel cutover · 38/38 routes serving 200 |
