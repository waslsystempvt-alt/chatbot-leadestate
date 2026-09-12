# Manual QA — LeadEstate

A step-by-step checklist to click through everything yourself and decide
what's actually launch-ready. Read **Section 0** first — it's the honest
"what's real vs not yet built" list, so you don't go looking for something
that doesn't exist yet.

---

## 0. Current status — read this first

**✅ Built and working today:**
- Super admin: create/activate/suspend/expire brokers (manual billing-lite)
- Super admin dashboard flags any broker expiring within 7 days, with one-click **Renew +30 days** and an **Email broker** button (opens your own mail client via `mailto:` — no backend email sender at all, by design)
- Broker login, broker-scoped access (a broker can never see another broker's data)
- Broker: create microsites, edit theme (color/agent name), get an embed snippet
- Broker: connect a CRM webhook per microsite, see delivery status/history
- Lead delivery: webhook (signed, retried) → dashboard notification if no CRM/CRM is down, with a "Forward by email" `mailto:` action (again, no backend sender — you type the destination, your own mail app opens)
- No lead PII (name/phone) is stored durably — a lead-fallback notification holds it only until you mark it handled, which clears the payload server-side (verified in this session)

**❌ Not built yet — do not expect these to work:**
- **The actual chatbot widget is NOT wired to any of this yet.** It still runs the old hardcoded flow and posts to the old Google Sheet / hardcoded CRM URL from before this project started. Pasting the new embed snippet on a real site will show the chatbot, but leads won't reach the new CRM connector system yet.
- **No per-broker flow editor.** Every broker/microsite shows the exact same scripted conversation (same questions, same buttons). Only the *color/agent name/avatar* differ per broker today — the actual conversation steps do not. This is the biggest gap if "different brokers, different flows" is a launch requirement.
- No self-signup, no billing/payment (intentional — you manage brokers manually)
- **No automated email sending anywhere, on purpose** — no SES/Resend/3rd-party dependency at all. Every notification lives on the dashboard; any actual email is you clicking a `mailto:` link and hitting send yourself.
- No password-reset / "forgot password" flow
- No BROKER_AGENT-facing screens (that role has nothing to do in the new no-PII model)

**Bottom line:** the *broker management + CRM delivery* engine is solid and tested. The *chatbot-customization* half of the product (what you'd actually hand a broker to configure their bot) isn't built. Treat this as backend/dashboard infrastructure ready for the next phase, not a shippable product yet.

---

## 1. Start everything locally

```bash
cd /Users/seherkhan/Downloads/chatbot
docker compose up -d postgres redis      # Postgres + Redis

cd apps/api
npm run start:dev                        # -> http://localhost:4000

# in another terminal
cd apps/dashboard
npm run dev                              # -> http://localhost:5174

# in another terminal (the chatbot widget itself)
cd apps/widget/widget
npm run dev                              # -> http://localhost:5173
```

First time only:
```bash
cd apps/api
cp .env.example .env
npx prisma migrate dev
npm run prisma:seed        # creates the super admin login below
```

---

## 2. Test as Super Admin

**URL:** http://localhost:5174
**Login:** `admin@leadestate.local` / `changeme123` (or whatever you set in `.env`)

Checklist:
- [ ] Log in — should land on the **Brokers** screen
- [ ] Click **+ New broker** — fill name/slug/admin email → submit
- [ ] Confirm the one-time **admin temp password** is shown — copy it, you'll need it for Section 3
- [ ] Confirm the new broker appears in the list as **ACTIVE**
- [ ] Click **Suspend** on it — confirm status flips to **SUSPENDED**
- [ ] Click **Activate** — confirm it flips back
- [ ] Log out, then try logging in as that broker's admin *while suspended* — should be rejected with `"Broker account is suspended"` (re-activate before continuing)
- [ ] (Optional, deeper check) Open Prisma Studio and confirm every action above wrote a row to `AuditLog`:
  ```bash
  cd apps/api && npx prisma studio    # http://localhost:5555
  ```

That's the full extent of what the super admin can do today — no cross-broker analytics or impersonation screens yet (both were in the original plan, not built).

### 2a. Test the expiry/renewal banner

- [ ] Set a broker's expiry to 3 days from now and confirm the yellow **"N broker(s) need attention"** banner appears above the table:
  ```bash
  curl -X PATCH http://localhost:4000/brokers/BROKER_ID/status \
    -H "authorization: Bearer $SUPER_TOKEN" -H 'content-type: application/json' \
    -d "{\"status\":\"ACTIVE\",\"subscriptionEndsAt\":\"$(node -e 'console.log(new Date(Date.now()+3*864e5).toISOString())')\"}"
  ```
- [ ] Click **Email [broker]** — confirm it opens your default mail app with a prefilled subject/body addressed to that broker's admin email (nothing is sent by the server — check the link's `href` if your mail client doesn't open)
- [ ] Click **Renew +30d** — confirm the banner disappears and the broker's expiry date in the table jumped forward 30 days

---

## 3. Test broker onboarding

Using the broker you just created (or the admin email + temp password from Section 2):

- [ ] Log out of super admin, log back in at http://localhost:5174 as the broker admin
- [ ] Confirm you land on **Your microsites**, not the Brokers screen (role-based view working)
- [ ] Confirm you see *only this broker's* microsites, never another broker's

---

## 4. Test microsite creation + theme

- [ ] Click **+ New microsite** — give it a slug/project name/agent name
- [ ] Click **Manage** on it
- [ ] Change the primary color, click **Save theme**
- [ ] Refresh the page — confirm the color persisted (proves it's really saved, not just local state)

---

## 5. Test CRM connect + lead delivery

You need something to receive the webhook. Easiest: open https://webhook.site in a browser tab — it gives you a unique URL and shows every request it receives, no setup needed.

- [ ] Paste that webhook.site URL into **Webhook URL**, check **Active**, click **Save CRM connection**
- [ ] Note the **signing secret** shown below the field
- [ ] Send a test lead directly to the API (simulates what the widget will eventually do):
  ```bash
  curl -X POST http://localhost:4000/public/leads \
    -H 'content-type: application/json' \
    -d '{"micrositeId":"PASTE_MICROSITE_ID","fullName":"Test Lead","phone":"9999999999","sourceAction":"Prices & Floor Plans"}'
  ```
  (get the microsite id from the dashboard's browser dev tools network tab, or `npx prisma studio`)
- [ ] Confirm the request shows up on your webhook.site tab, with header `x-leadestate-signature`
- [ ] Confirm it appears in the dashboard's **Recent lead deliveries** table as `CRM webhook / DELIVERED`
- [ ] Now **uncheck Active** (or clear the URL) and send another test lead the same way
- [ ] Confirm the delivery log shows `Dashboard notification / DELIVERED` instead
- [ ] Go to **Your microsites** (top level, not inside a specific microsite) — confirm a yellow **"N lead(s) waiting"** panel shows the lead's name/phone/interest
- [ ] Type an email address into **forward to email…** and click **Forward by email** — confirm it opens your mail client prefilled with the lead's details (check the link `href` if it doesn't open)
- [ ] Click **Mark handled** — confirm the notification disappears from the dashboard
- [ ] Confirm the lead's PII is actually gone server-side, not just hidden client-side:
  ```bash
  docker exec chatbot-postgres-1 psql -U leadestate -d leadestate \
    -c "select type, payload, \"readAt\" from \"Notification\" order by \"createdAt\" desc limit 3;"
  ```
  `payload` should be `null` for anything with a `readAt` set.
- [ ] Open Postgres and confirm no name/phone is stored anywhere in the delivery log either:
  ```bash
  docker exec chatbot-postgres-1 psql -U leadestate -d leadestate \
    -c "select method, status, \"sourceAction\" from \"LeadDeliveryLog\" order by \"createdAt\" desc limit 5;"
  ```

---

## 6. Embed on a real microsite (current limitation)

The dashboard gives you a copy-paste snippet per microsite (open a microsite → scroll to **Embed snippet**). Pasting it on a real page will show the working chatbot UI — but per Section 0, it won't yet send leads through the new CRM connector. Treat this as a preview of the intended experience, not something to hand to a real broker yet.

---

## 7. Changing the chat flow per broker (not built — what exists instead)

Today: **there is no per-broker flow editor.** The conversation script (questions, buttons, order) lives hardcoded in the widget's source code at
[`apps/widget/widget/src/components/ChatWidget.tsx`](apps/widget/widget/src/components/ChatWidget.tsx)
(or wherever the flow steps are defined in that component) and is identical for every broker. Only branding (`themeConfig`) differs per microsite right now.

The schema is already designed for this (`ChatFlow` / `ChatFlowVersion` tables, step-graph shape, DFS validation in [`packages/shared-types`](packages/shared-types/src/index.ts)) — but there's no API endpoints or dashboard screen yet to create/edit/publish a flow, and the widget doesn't fetch a flow from the API at all. This is the next major build if "each broker customizes their own flow" is a launch requirement.

---

## 8. Launch-readiness checklist (go/no-go)

Use this as your decision list:

| Capability | Status |
|---|---|
| Manage brokers (activate/suspend/expiry) | ✅ Ready |
| Broker login + tenant isolation | ✅ Ready |
| Broker manages microsites + theme | ✅ Ready |
| Broker connects their own CRM | ✅ Ready |
| Lead delivery reliability (retry + fallback) | ✅ Ready |
| No PII stored durably on our servers | ✅ Verified |
| Dashboard notifications (expiry + lead fallback) | ✅ Ready |
| Manual `mailto:` forwarding (renewal + leads) | ✅ Ready |
| Widget actually uses any of the above | ❌ Not wired up |
| Per-broker custom chat flow | ❌ Not built |
| Automated email sending | N/A — intentionally not built (no SES/3rd-party) |
| Self-signup / payments | ❌ Not built (intentionally manual) |

If "different brokers get different chatbot conversations" is a must-have for launch, **this is not launch-ready yet** — that's the one core piece missing. Everything else checked ✅ has been manually clicked through and verified in this session.
