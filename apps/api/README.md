# @leadestate/api

NestJS + Prisma/PostgreSQL backend for the LeadEstate multi-broker platform.
See the [root README](../../README.md) for the overall product/architecture
plan this implements.

## What's here (Phase 1)

- Prisma schema (`prisma/schema.prisma`) — Broker, User, Microsite, ChatFlow
  + ChatFlowVersion, Lead, LeadActivity, Notification, AuditLog, ChatEvent.
- JWT auth (`src/auth`) — `POST /auth/login`, roles: `SUPER_ADMIN`,
  `BROKER_ADMIN`, `BROKER_AGENT`.
- Broker lifecycle (`src/brokers`, super-admin only) — create a broker (spins
  up its first `BROKER_ADMIN` user), list, and `PATCH /brokers/:id/status`
  to manually activate/suspend/expire + set `subscriptionEndsAt`. This is
  the whole "billing-lite" story: no payment gateway, just a status you flip.
- Every broker create/status-change is written to `AuditLog`
  (`src/audit`).
- Tenant isolation pattern: `JwtAuthGuard` + `RolesGuard` handle authn/role,
  and every service method scopes its Prisma queries using the `brokerId`
  from the JWT (`CurrentUser()`), never from client input — see
  `src/common/guards/roles.guard.ts` for the reasoning.

Not built yet (see root plan, Phases 2–5): chat flow editor + widget
integration, CRM endpoints, expiry-notification cron + SES email,
rate limiting on the public embed endpoints.

## Local setup

```bash
cp .env.example .env        # then edit JWT_SECRET etc.
docker compose -f ../../docker-compose.yml up -d   # postgres + redis
npx prisma migrate dev --name init
npm run prisma:seed         # creates the first SUPER_ADMIN user
npm run start:dev           # -> http://localhost:4000
```

Try it:

```bash
curl -X POST http://localhost:4000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@leadestate.local","password":"changeme123"}'
```

Use the returned `accessToken` as `Authorization: Bearer <token>` to call
`POST /brokers`:

```bash
curl -X POST http://localhost:4000/brokers \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "name": "Homesfy",
    "slug": "homesfy",
    "adminEmail": "owner@homesfy.example",
    "subscriptionEndsAt": "2026-12-31T00:00:00.000Z"
  }'
```

The response includes `adminTempPassword` once — that's the broker admin's
first login password.
