# LeadEstate Chatbot

A brand-agnostic real-estate lead chatbot built with **React + Vite**. One
Cloudflare-hosted bundle powers every microsite — pass the project's name,
broker, agent, and brand color via `data-*` on `embed.js` (or
`window.LEADESTATE_EMBED`) and every captured lead POSTs to the LeadEstate
API (`apps/api`), which fans it out to whatever CRM connectors that
microsite has attached (see `apps/api/src/crm-connectors`). The widget
mounts **directly on the page** (no iframe), which fixes scroll and mobile
layout issues.

> The old Google-Sheets-only delivery path (Apps Script webhook +
> `data-crm-url`) has been replaced by this API-backed flow. The Apps
> Script source is kept under `legacy/google-apps-script/` for reference
> only — the widget no longer calls it.

## Project layout

```
chatbot/
├── widget/                          # React source (Vite)
├── dist/                            # production build — deploy this folder
│   ├── index.html                   # standalone preview
│   ├── chatbot.js                   # React embed bundle (IIFE)
│   ├── chatbot.css                  # widget styles
│   ├── embed.js                     # microsite loader (one script tag)
│   └── profile.webp
├── embed.js                         # source loader (copied to dist on build)
├── google-apps-script/
│   └── LeadsWebhook.gs              # Apps Script web app (Sheet writer)
└── README.md
```

## Build

```bash
cd widget
npm install
npm run build
```

Deploy the contents of **`dist/`** to Cloudflare Pages / Workers.

## Where leads go

Every chatbot lead is `POST`ed to `${apiBase}/public/leads` on the
LeadEstate API. From there `LeadsService` looks up the microsite, and:

- fans the lead out in parallel to every active `CrmConnector` attached to
  that microsite (each with its own webhook URL, headers, HTTP method, and
  a custom payload template — see `packages/shared-types`'s
  `renderTemplate`/`WEBHOOK_PRESETS`), or
- if no connector is attached (or all of them fail), drops a `Notification`
  on the broker's dashboard instead, so the lead is never silently lost.

A broker manages their connectors from the dashboard (`apps/dashboard`) —
create one, pick a preset (LeadEstate standard / Blox / custom schema) or
write your own `{{variable}}` template, then attach it to any of their
microsites.

## 1) Backend — the LeadEstate API

Run `apps/api` (see its own README) and set `apiBase` for the widget to
point at it — see the `data-api-base` attribute below.

## 2) Frontend — deploy to Cloudflare

Upload the **`dist/`** folder (after `npm run build` in `widget/`):

| File | Role |
| --- | --- |
| `index.html` | Standalone chat preview. |
| `chatbot.js` + `chatbot.css` | React widget bundle + styles (loaded by `embed.js`). |
| `embed.js` | One-line loader every microsite pastes. |
| `profile.webp` | Default agent avatar (optional). |

After deploy, open in a browser:

- `https://YOUR-DOMAIN/` — standalone chatbot preview.
- `https://YOUR-DOMAIN/embed.js` — loader source (not 404).
- `https://YOUR-DOMAIN/chatbot.js` — widget bundle (not 404).

## 3) One script on every microsite

Each microsite only adds **one** external script. Change the `data-*` values per project (same fields as `test.html` defaults: `ms`, `project`, `broker`, `agent`, `primary`, `avatar`, `script`).

### Option A — `data-*` on the tag (recommended)

Paste just before `</body>`:

```html
<script
  src="https://YOUR-CHATBOT-DOMAIN/embed.js"
  data-ms="sky-estates"
  data-project="Sky Estates"
  data-broker="Homesfy"
  data-agent="Ziya"
  data-primary="#047857"
  data-avatar=""
  data-api-base="https://YOUR-API-DOMAIN"
  data-redirect-url="thankyou.html"
  async></script>
```

`data-src` is **optional**: if you omit it, the bundle URL is inferred from where `embed.js` is hosted (`…/embed.js` → `…/chatbot.js`). Use `data-src` only if the widget lives on a **different** domain than `embed.js`.

| Attribute | Same as test form | Purpose |
| --- | --- | --- |
| `data-ms` | Microsite ID | Stable slug saved on every lead — must match a `Microsite.slug` in the API. |
| `data-project` | Project name | Shown in the chat intro. |
| `data-broker` | Broker / company | Company line in the greeting. |
| `data-agent` | Agent name | Header + teaser + greeting. |
| `data-primary` | Brand color | Hex with or without `#`. |
| `data-avatar` | Agent avatar URL | Optional photo URL. |
| `data-api-base` | LeadEstate API base URL | Where leads are POSTed (`${apiBase}/public/leads`). Required for real delivery. |
| `data-redirect-url` | Thank-you URL | **Optional.** When set, the microsite page navigates here after the lead is saved (same as the existing form). |
| `data-redirect-delay` | Redirect delay (ms) | **Optional.** Defaults to `500`. |
| `data-auto-open` | (optional) | Desktop auto-open delay in ms; `0` = off. |
| `data-gtm-event` | (optional) | Custom dataLayer event name. Default `formSubmitted`. |
| `data-test` | (optional) | Set to `"1"` to force test mode for this site (no GTM / no API submission). |

### Option B — `window.LEADESTATE_EMBED` (when the builder strips `data-*`)

Some page builders remove custom attributes from `<script>`. Put a tiny inline block **above** `embed.js`:

```html
<script>
  window.LEADESTATE_EMBED = {
    ms: "sky-estates",
    project: "Sky Estates",
    broker: "Homesfy",
    agent: "Ziya",
    primary: "#047857",
    avatar: "",
    script: "",
    autoOpen: "5000"
  };
</script>
<script src="https://YOUR-CHATBOT-DOMAIN/embed.js" async></script>
```

Any non-empty `data-*` on the external script tag still **overrides** `LEADESTATE_EMBED`.

## 3a) Send leads to a CRM

There's no `data-crm-url` attribute anymore — CRM delivery is configured
**per broker, in the dashboard**, not per script tag:

1. In the dashboard, create a `CrmConnector` (name, webhook URL, HTTP
   method, optional custom headers, and a payload template — pick a preset
   or write your own `{{variable}}` template).
2. Attach that connector to any of the broker's microsites. One connector
   can be reused across many microsites; one microsite can have several
   connectors attached at once (e.g. Blox + an internal Zapier hook) — the
   API fans a lead out to all of them in parallel.
3. Use **Test webhook** in the dashboard to send a sample payload through
   the exact same code path a real lead uses, before going live.

The widget itself only needs `data-api-base` pointed at the API — it has no
idea which (if any) CRMs are attached.

### What the API sends

For a connector's `payloadTemplate`, every `{{variable}}` is filled in from
the captured lead — see `TEMPLATE_VARIABLES` in `packages/shared-types` for
the full list (`fullName`, `phone`, `utmSource`, `pageUrl`, `timestamp`,
etc.). Leaving `payloadTemplate` unset falls back to the LeadEstate standard
shape:

```json
{
  "micrositeId": "rayansh",
  "fullName": "Ziya",
  "phone": "9876543210",
  "projectName": "Rayansh",
  "brokerName": "Homesfy",
  "agentName": "Ziya",
  "configuration": "2 BHK",
  "sourceAction": "Prices & Floor Plans",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "summer-launch",
  "utmTerm": "",
  "utmContent": "",
  "gclid": "Cj0KCQ...",
  "fbclid": "",
  "pageUrl": "https://rayansh.com/?utm_source=google",
  "timestamp": "2026-05-11T10:26:30.777Z"
}
```

### Behaviour

| Connectors attached | Delivery result |
| --- | --- |
| None | Lead shows up as a dashboard `Notification` — the broker forwards it manually. |
| One or more, at least one succeeds | Lead delivered to whichever connectors accepted it; failures are logged per-connector but don't block the others. |
| One or more, all fail | Falls back to a dashboard `Notification` so the lead is never silently lost. |

### Test mode

Visit the microsite with `?test=1` and lead submission is **skipped
entirely** (`[LeadEstate] TEST MODE — skipping lead submission.` in
console) — nothing reaches the API. Use the dashboard's own **Test
webhook** button on a connector to verify delivery without going through
the chat UI.

## 3b) Track chatbot leads in GTM (Google Ads / GA4 / Meta conversions)

`embed.js` listens for lead events from the widget and pushes the following to
the page's `window.dataLayer`:

```js
{
  event: "leadestate_lead",
  chatbot_lead: true,
  form_source: "leadestate-chatbot",
  microsite_id: "neelam-senroofs",
  project_name: "Neelam Senroofs",
  phone_number: "9876543210",
  lead_name: "Ziya",
  configuration: "2 BHK",
  source_action: "Prices & Floor Plans"
}
```

#### GTM setup (one-time per container)

1. **Trigger** → New → *Custom Event*
   - Event name: `leadestate_lead`
   - This trigger fires on: *All Custom Events*
2. **Tag** → New → pick your conversion type:
   - **Google Ads — Conversion Tracking** (paste your Conversion ID + Label)
   - or **GA4 — Event** with event name `generate_lead`
   - or **Meta Pixel — Lead** event
   - Attach the **`leadestate_lead`** trigger created above.
3. *(Optional, to pass values)* Make Data Layer Variables for
   `phone_number`, `microsite_id`, etc. and reference them inside the tag.
4. Submit + publish the container.

Confirm with GTM **Preview** mode — submit a lead in the chat and you should
see `leadestate_lead` in the events sidebar with all the payload fields.

#### Vanilla JS (no GTM)

If you don't use GTM, listen for the postMessage directly:

```html
<script>
  window.addEventListener("message", function (e) {
    var d = e && e.data;
    if (!d || d.type !== "leadestate:lead" || d.ok !== true) return;

    // Google Ads conversion
    if (typeof gtag === "function") {
      gtag("event", "conversion", {
        send_to: "AW-XXXXXXXXXX/YYYYYYYY",
        value: 1, currency: "INR"
      });
    }
    // Meta Pixel
    if (typeof fbq === "function") fbq("track", "Lead");
  });
</script>
```

## 3c) Standalone / query-string config

Open `https://YOUR-DOMAIN/?ms=…&project=…&broker=…&agent=…&primary=…` for a
full-page preview without `embed.js`. Supported params are listed below.

### Supported URL params (all optional)

| Param                       | Purpose                                             | Example              |
| --------------------------- | --------------------------------------------------- | -------------------- |
| `ms` / `micrositeId`        | Stable slug saved on every lead.                    | `homesfy`            |
| `project` / `projectName`   | The real-estate project name.                       | `Sky Estates`        |
| `broker` / `brokerName`     | The brokerage / company (in intro + sheet).         | `Homesfy`            |
| `agent` / `agentName`       | The person shown in header, teaser, intro.          | `Ziya`               |
| `primary` / `color`         | Brand hex (with or without `#`).                    | `896b3b`             |
| `avatar` / `agentAvatar`    | URL-encoded agent photo URL.                        | `https%3A%2F%2F...`  |
| `apiBase` / `api`           | LeadEstate API base URL.                            | `https%3A%2F%2F...`  |
| `autoOpen`                  | Desktop auto-open delay in ms. `0` disables.        | `0` or `5000`        |

Greeting bubble reads **"Hi, I'm `{agent}` from `{broker}` 👋"**.
Header shows **`{agent}`**.

### Alternative: configure via JS object

If you can run JS on the page (not an iframe), set the config before loading
the widget script:

```html
<script>
  window.LEADESTATE_CHAT_CONFIG = {
    micrositeId: "homesfy",
    projectName: "Sky Estates",
    brokerName:  "Homesfy",
    agentName:   "Ziya",
    theme: { primary: "#896b3b" },
    autoOpenDelayMs: 0
  };
</script>
```

## 4) Local development

```bash
cd widget
npm install
npm run dev          # → http://localhost:5173
npm run build        # → ../dist/
```

Serve `dist/` to test the production embed:

```bash
cd ..
python3 -m http.server 5500
# → http://localhost:5500/dist/index.html
```

## 5) Troubleshooting

| Symptom in chat                                                 | Likely cause / fix                                                                                   |
| ----------------------------------------------------------------| ---------------------------------------------------------------------------------------------------- |
| `[LeadEstate] Lead submission failed: Unknown microsite`        | `data-ms` doesn't match any `Microsite.slug` in the API's database for this broker.                  |
| `[LeadEstate] Lead submission failed: Request failed (0)` / network error | `data-api-base` is wrong, unreachable, or the API isn't running. Check the Network tab.    |
| Success shown, but no CRM notification/webhook fired            | No `CrmConnector` is attached to this microsite — check the dashboard. Falls back to a dashboard `Notification`, which is expected, not a bug. |
| CORS error in console                                           | The API enables permissive CORS (`main.ts`) by default; if you changed that, re-check its origin config. |

## License

MIT — use it, fork it, ship it.
