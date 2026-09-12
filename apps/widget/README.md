# LeadEstate Chatbot

A brand-agnostic real-estate lead chatbot built with **React + Vite**. One
Cloudflare-hosted bundle powers every microsite — pass the project's name,
broker, agent, and brand color via `data-*` on `embed.js` (or
`window.LEADESTATE_EMBED`) and leads land in a Google Sheet via Google Apps
Script. The widget mounts **directly on the page** (no iframe), which fixes
scroll and mobile layout issues.

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

Every chatbot lead is appended as a row to a Google Sheet via a Google Apps
Script Web App. That's the only backend — no CRM, no extra services.

## 1) Backend — Google Apps Script

1. Create a Google Sheet. Copy its ID from the URL
   (`https://docs.google.com/spreadsheets/d/`**`SHEET_ID`**`/edit`).
2. Open <https://script.google.com> → **New project** → paste the contents of
   `google-apps-script/LeadsWebhook.gs`.
3. **Project Settings → Script properties → Add property**:
   - Name: `SHEET_ID`
   - Value: your sheet id
4. *(Optional but recommended)* Hit **Run ▶** on the `setup` function once to
   grant permissions and write a smoke-test row.
5. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the Web App URL. It looks like
   `https://script.google.com/macros/s/AKfy.../exec`.

The script auto-creates a `Leads` tab with these columns on first use:

`Timestamp | MicrositeId | ProjectName | BrokerName | AgentName | Name | Phone | Configuration | SourceAction | Budget | PropertyType`

If you add fields later, just extend `EXPECTED_HEADERS`; missing columns are
appended to the sheet on the next request — existing rows are untouched.

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
  data-script-url=""
  data-crm-url="https://leads-api.leadestate.in/api/lead"
  data-form-id="chatbot-sky-estates"
  data-redirect-url="thankyou.html"
  async></script>
```

`data-src` is **optional**: if you omit it, the bundle URL is inferred from where `embed.js` is hosted (`…/embed.js` → `…/chatbot.js`). Use `data-src` only if the widget lives on a **different** domain than `embed.js`.

| Attribute | Same as test form | Purpose |
| --- | --- | --- |
| `data-ms` | Microsite ID | Stable slug saved on every lead. |
| `data-project` | Project name | Shown in the chat intro. |
| `data-broker` | Broker / company | Company line + Sheet column. |
| `data-agent` | Agent name | Header + teaser + Sheet column. |
| `data-primary` | Brand color | Hex with or without `#`. |
| `data-avatar` | Agent avatar URL | Optional photo URL. |
| `data-script-url` | Apps Script URL | Optional; overrides Sheet webhook per site. |
| `data-crm-url` | CRM endpoint URL | **Optional.** If set, lead also POSTs to this CRM in parallel with the sheet. |
| `data-form-id` | CRM form ID | **Optional.** Sent in CRM payload. Defaults to `chatbot-{ms}`. |
| `data-redirect-url` | Thank-you URL | **Optional.** When set, the microsite page navigates here after the lead is saved (same as the existing form). |
| `data-redirect-delay` | Redirect delay (ms) | **Optional.** Defaults to `500`. |
| `data-auto-open` | (optional) | Desktop auto-open delay in ms; `0` = off. |
| `data-gtm-event` | (optional) | Custom dataLayer event name. Default `formSubmitted`. |
| `data-test` | (optional) | Set to `"1"` to force test mode for this site (no GTM / no CRM). |

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

## 3a) Send leads to a CRM (in addition to the Google Sheet)

Add **one** attribute — `data-crm-url` — to forward every chatbot lead to your CRM
in parallel with the existing Google Sheet. The sheet keeps working unchanged.

```html
<script
  src="https://YOUR-CHATBOT-DOMAIN/embed.js"
  data-ms="rayansh"
  data-project="Rayansh"
  data-broker="Homesfy"
  data-agent="Ziya"
  data-primary="#047857"
  data-crm-url="https://leads-api.leadestate.in/api/lead"
  async></script>
```

### CRM payload (sent as JSON `POST`)

`embed.js` reads UTM params, `pageUrl`, and `userAgent` from the **parent
microsite** and passes them into the widget config. The chatbot then sends:

```json
{
  "fullName": "Ziya",
  "phone": "9876543210",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "summer-launch",
  "utmTerm": "",
  "utmContent": "",
  "gclid": "Cj0KCQ...",
  "fbclid": "",
  "formId": "chatbot-rayansh",
  "micrositeId": "rayansh",
  "projectName": "Rayansh",
  "brokerName": "Homesfy",
  "agentName": "Ziya",
  "configuration": "2 BHK",
  "sourceAction": "Prices & Floor Plans",
  "pageUrl": "https://rayansh.com/?utm_source=google",
  "userAgent": "Mozilla/5.0 ...",
  "timestamp": "2026-05-11T10:26:30.777Z"
}
```

### Behaviour

| Sheet | CRM URL set | CRM | Result |
| --- | --- | --- | --- |
| ✅ ok | ✅ | ✅ ok | Lead saved to **both**. UI shows success. |
| ✅ ok | ✅ | ❌ fail | Lead saved to **sheet**. UI shows success. CRM error logged to console. |
| ✅ ok | ❌ blank | — | Sheet only. Existing behaviour. |
| ❌ fail | ✅ | ✅ ok | Lead saved to **CRM**. UI shows success. Sheet error logged. |
| ❌ fail | ✅ | ❌ fail | UI shows failure with both errors. |

### Test mode skips CRM

Visit the microsite with `?test=1` and CRM submission is **skipped**
(`[LeadEstate] TEST MODE — skipping CRM submission.` in console). The Google
Sheet still receives the lead so you can verify the full flow.

### Different CRM per microsite

Just change `data-crm-url` (and optionally `data-form-id`) per site. The
chatbot doesn't care — it just POSTs JSON to whatever endpoint you provide.

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
| `script` / `scriptUrl`      | Override the Apps Script URL per microsite.         | `https%3A%2F%2F...`  |
| `autoOpen`                  | Desktop auto-open delay in ms. `0` disables.        | `0` or `5000`        |

Greeting bubble reads **"Hi, I'm `{agent}` from `{broker}` 👋"**.
Header shows **`{agent}`**. Lead rows record both `BrokerName` and `AgentName`.

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
| `... — SHEET_ID not configured`                                 | Set Script property `SHEET_ID`, or `SHEET_ID_FALLBACK` in the .gs file. Redeploy a **new version**.  |
| `... — You do not have permission to call SpreadsheetApp.openById` | Share the sheet (Editor) with the same Google account selected under "Execute as: Me".            |
| `... — Missing script URL`                                      | `cfg.scriptUrl` is empty or still placeholder. Set it via `DEFAULT_CHAT.scriptUrl` or `?script=`.    |
| CORS preflight failure                                          | The widget already POSTs as `text/plain` to avoid this. If you changed it, revert.                   |
| Edits to `.gs` don't take effect                                | Apps Script caches deployments. **Deploy → Manage deployments → ✎ → New version → Deploy.**         |

## License

MIT — use it, fork it, ship it.
