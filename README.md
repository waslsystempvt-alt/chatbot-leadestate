# LeadEstate — Multi-Broker Chatbot SaaS

A multi-tenant platform for real-estate brokers: each broker gets a login,
installs an embeddable lead-capture chatbot on any number of their own
microsites, customizes its conversation flow and branding from a dashboard,
and manages incoming leads in a broker-scoped CRM. A super admin manages
brokers centrally (manual activate/deactivate + expiry, no payment gateway
for now).

Full product plan (scope, data model, architecture, phased roadmap):
[`apps/api/README.md`](apps/api/README.md) covers what's implemented;
ask for the plan doc (`kind-purring-unicorn.md`) for the original design.

## Layout

```
leadestate/
├── apps/
│   ├── api/          # NestJS + Prisma/Postgres — auth, brokers, (soon) flows, leads, CRM
│   ├── dashboard/     # super-admin + broker dashboard (scaffolding pending)
│   └── widget/        # the embeddable chatbot — existing React/Vite widget + embed.js loader
├── packages/
│   └── shared-types/  # zod schemas shared by api/dashboard/widget (chat flow graph, lead payload)
├── legacy/
│   └── google-apps-script/  # old Google Sheets webhook — optional fallback, no longer source of truth
└── docker-compose.yml # local Postgres + Redis for apps/api
```

## Status

**Phase 1 (foundation) done:** monorepo scaffold, Prisma schema for the full
data model, JWT auth + role-based access (`SUPER_ADMIN` /
`BROKER_ADMIN` / `BROKER_AGENT`), broker CRUD with manual
activate/suspend/expire + `subscriptionEndsAt`, audit log.

**Next (Phase 2):** chat-flow editor (broker-side, edit step text/CTAs) +
widget wired to fetch its config from the API instead of being hardcoded.
See [`apps/api/README.md`](apps/api/README.md) for how to run what's here
today, and [`apps/widget/README.md`](apps/widget/README.md) for the current
(still fully working, unchanged) widget embed instructions.

## Quick start

```bash
npm install
docker compose up -d postgres redis     # requires Docker Desktop running
cd apps/api
cp .env.example .env
npx prisma migrate dev --name init
npm run prisma:seed                     # creates the first super-admin login
npm run start:dev                       # -> http://localhost:4000
```
