# LeadEstate — Architecture, Roles, & Implementation Guide

A complete, visualized guide explaining how the LeadEstate multi-tenant chatbot platform works, who has what access, how to manage CRM webhooks, and how to embed the chatbot on any client microsite.

---

## 1. System Architecture & Flow

```mermaid
flowchart TB
    subgraph ClientSites["Client Microsites (Lotus The Arcadian, Sugam, etc.)"]
        Visitor["Visitor on Website"]
        Widget["Chatbot Widget (embed.js)"]
        LocalJS["Page JS (e.g., submitLeadToBlox)"]
    end

    subgraph LeadEstateBackend["LeadEstate Platform"]
        API["NestJS API (Port 4001)<br/>POST /public/leads"]
        TemplateEngine["Dynamic Template Engine<br/>(renderTemplate)"]
        Dashboard["React Dashboard (Port 5174)"]
        Postgres[(PostgreSQL DB<br/>Port 5433)]
    end

    subgraph ClientCRMs["Client Destinations (Parallel Fan-Out)"]
        Blox["Blox Marketing Leads API<br/>{first_name, contact, comment...}"]
        CRM2["Client Salesforce / CRM<br/>{FirstName, MobilePhone...}"]
        Internal["Dashboard Notification<br/>(Fallback if CRM down)"]
    end

    Visitor -->|Enters Name & Phone| Widget
    Widget -->|1. Direct Ingestion| API
    Widget -.->|2. Optional Window Event| LocalJS
    API --> Postgres
    API --> TemplateEngine
    TemplateEngine -->|Formatted JSON + Auth Headers| Blox
    TemplateEngine -->|Formatted JSON + Auth Headers| CRM2
    TemplateEngine -.->|If all fail| Internal

    Dashboard -->|Admin Configures Connectors| API
```

---

## 2. Roles & Access Control Matrix

LeadEstate enforces strict multi-tenant isolation. Users only see and manage what their role permits.

| Feature / Action | `SUPER_ADMIN` | `BROKER_ADMIN` | `BROKER_AGENT` | Public Visitor |
| :--- | :---: | :---: | :---: | :---: |
| **Manage Brokers** (Create, suspend, activate, extend subscription) | ✅ Full | ❌ No | ❌ No | ❌ No |
| **View Other Brokers' Data** | ✅ Cross-tenant | ❌ Tenant isolated | ❌ Tenant isolated | ❌ No |
| **Create & Edit Microsites** | ❌ No | ✅ Yes (own only) | ❌ Read only | ❌ No |
| **Create CRM Connectors** (Blox, Webhooks, Templates) | ❌ No | ✅ Yes (own only) | ❌ No | ❌ No |
| **Attach Connectors to Microsites** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **Test Webhooks with Mock Leads** | ❌ No | ✅ Yes | ❌ No | ❌ No |
| **View Lead Delivery Logs** | ❌ No | ✅ Yes (own only) | ❌ No | ❌ No |
| **Interact with Chatbot & Submit Lead** | ❌ No | ❌ No | ❌ No | ✅ Yes (`POST /public/leads`) |

### Default Credentials:
* **Super Admin**: `admin@leadestate.local` / `changeme123`
* **Broker Admin (Demo)**: `e2e-admin@example.com` / `changeme123`

---

## 3. How to Use the Dashboard

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Broker Admin
    participant UI as Dashboard (:5174)
    participant API as API (:4001)
    participant CRM as Client CRM / Webhook

    Note over Admin,UI: Step 1: Create Reusable Connector
    Admin->>UI: Go to "CRM connections" -> "+ New connection"
    Admin->>UI: Select "Blox Marketing Leads API" preset (or Custom)
    Admin->>UI: Paste Webhook URL & Auth Headers
    Admin->>UI: Click "Test webhook"
    UI->>API: POST /crm-connectors/:id/test
    API->>CRM: Dispatches test lead
    CRM-->>API: 200 OK
    API-->>UI: Displays test success response

    Note over Admin,UI: Step 2: Attach to Microsite
    Admin->>UI: Go to "Your microsites" -> Select Microsite
    Admin->>UI: Check the box next to your new connector
    UI->>API: Links Connector to Microsite

    Note over Admin,UI: Step 3: Get Embed Code
    Admin->>UI: Copy the generated script snippet
    Admin->>Admin: Paste snippet before </body> on client website
```

---

## 4. CRM Webhook Templates & Mapping Engine

When a visitor submits the chatbot, the backend generates a flat variable map from their answers and UTM parameters. You can use these placeholders in any custom JSON template:

### Available Template Placeholders
* `{{fullName}}` / `{{name}}`: Visitor's full name
* `{{phone}}`: Visitor's phone number
* `{{projectName}}`: Project name (e.g. "Lotus The Arcadian")
* `{{brokerName}}`: Broker/Agency name (e.g. "Blox")
* `{{configuration}}`: Property configuration chosen (e.g. "3 BHK", "4 BHK")
* `{{sourceAction}}`: Trigger intent (e.g. "brochure", "site_visit", "pricing")
* `{{utmSource}}`, `{{utmMedium}}`, `{{utmCampaign}}`, `{{utmTerm}}`, `{{utmContent}}`: Marketing attribution tags
* `{{pageUrl}}`: Full URL of the landing page where the lead was captured
* `{{timestamp}}`: ISO 8601 submission timestamp

---

### Popular Preset Configurations

#### A. Blox Marketing Leads API
```json
{
  "first_name": "{{fullName}}",
  "contact": "{{phone}}",
  "project_name": "{{projectName}}",
  "comment": "Chatbot: {{configuration}} ({{sourceAction}})",
  "source": "{{utmSource}}",
  "utm_campaign": "{{utmCampaign}}",
  "request_url": "{{pageUrl}}"
}
```
**Headers:**
```json
{
  "Authorization": "Bearer YOUR_BLOX_BEARER_TOKEN",
  "Content-Type": "application/json"
}
```

#### B. Standard Salesforce / HubSpot
```json
{
  "FirstName": "{{fullName}}",
  "MobilePhone": "{{phone}}",
  "LeadSource": "Website Chatbot",
  "Project_Interest__c": "{{projectName}}",
  "Notes__c": "Interested in {{configuration}}"
}
```

#### C. Nested Webhook Structure (e.g. Zapier / Make / Custom Webhooks)
```json
{
  "lead": {
    "contact": {
      "name": "{{fullName}}",
      "mobile": "{{phone}}"
    },
    "project": "{{projectName}}",
    "tracking": {
      "source": "{{utmSource}}",
      "campaign": "{{utmCampaign}}"
    }
  }
}
```

---

## 5. How to Implement on Client Microsites

### Standard Implementation (Recommended)
Paste this script tag immediately before the closing `</body>` tag on any client microsite HTML (e.g., *Lotus The Arcadian*, *Sugam Urban Lakes*, *Mahindra Vista 3*):

```html
<!-- LeadEstate Chatbot Loader -->
<script
  src="http://localhost:5173/embed.js"
  data-ms="lotus-the-arcadian"
  data-project="Lotus The Arcadian"
  data-broker="Blox"
  data-agent="Pooja"
  data-primary="#d4af37"
  data-api-base="http://localhost:4001"
  data-redirect-url="thankyou.html"
  async>
</script>
```

#### Configuration Attributes:
| Attribute | Example Value | Description |
| :--- | :--- | :--- |
| `src` | `http://localhost:5173/embed.js` | Hosted loader script URL |
| `data-ms` | `"lotus-the-arcadian"` | Unique slug for this project in your dashboard |
| `data-project` | `"Lotus The Arcadian"` | Project name shown in conversation bubbles |
| `data-broker` | `"Blox"` | Broker agency name |
| `data-agent` | `"Pooja"` | Virtual agent name shown in the chat header |
| `data-primary` | `"#d4af37"` or `"#047857"` | Primary brand hex color for buttons & header |
| `data-api-base` | `http://localhost:4001` | LeadEstate API base URL where leads are delivered |
| `data-redirect-url`| `"thankyou.html"` | Page to redirect visitor to upon successful submission |
| `data-auto-open` | `"8000"` | Milliseconds before auto-opening (or `0` to disable) |

---

## 6. In-Page Event Bridging (Local JavaScript Integration)

If your landing page already contains existing scripts (like `assets/js/api.js` with `submitLeadToBlox(...)`), the chatbot automatically broadcasts a standard `window.parent.postMessage` event.

You can listen for this event and call the local page function directly:

```html
<!-- LeadEstate Chatbot Script -->
<script
  src="http://localhost:5173/embed.js"
  data-ms="lotus-the-arcadian"
  data-project="Lotus The Arcadian"
  data-primary="#d4af37"
  data-api-base="http://localhost:4001"
  async>
</script>

<!-- Local Page Bridge Script -->
<script>
(function() {
  const handledLeads = new Set();

  window.addEventListener("message", function(event) {
    const data = event.data;
    if (!data || data.type !== "leadestate:lead" || !data.ok) return;

    const name = (data.name || "").trim();
    const phone = (data.phone || "").trim();
    if (!phone) return;

    // Deduplication check
    const dedupKey = name + "_" + phone.replace(/\D/g, "");
    if (handledLeads.has(dedupKey)) return;
    handledLeads.add(dedupKey);

    const configuration = data.configuration || "";
    const sourceAction = data.sourceAction || "";

    console.log("[Chatbot] Captured lead on page:", name, phone);

    // Call local existing API function if present:
    if (typeof submitLeadToBlox === "function") {
      submitLeadToBlox({
        name: name,
        phone: phone,
        comment: "Chatbot: " + [configuration, sourceAction].filter(Boolean).join(" | ")
      }).then(function(res) {
        console.log("[Chatbot] Lead submitted via local submitLeadToBlox");
      }).catch(function(err) {
        console.error("[Chatbot] Local API error:", err);
      });
    }

    // Optional: Redirect after delay
    setTimeout(function() {
      window.location.href = "thankyou.html";
    }, 500);
  });
})();
</script>
```

---

## 7. Delivery Safety & Fallback System

```mermaid
flowchart TD
    LeadSubmitted["Lead Submitted in Chatbot"] --> Ingest["POST /public/leads"]
    Ingest --> FetchConnectors["Query Active Connectors for Microsite"]
    
    FetchConnectors --> HasConnectors{"Are Connectors Configured?"}
    
    HasConnectors -- Yes --> Dispatch["Fan-out Parallel Webhook POSTs"]
    Dispatch --> AnySuccess{"Did at least 1 deliver?"}
    
    AnySuccess -- Yes --> LogSuccess["Log status DELIVERED in LeadDeliveryLog"]
    AnySuccess -- No (All Failed) --> Fallback["Create Dashboard NEW_LEAD Notification"]
    
    HasConnectors -- No --> Fallback
    Fallback --> LogFallback["Log method DASHBOARD_NOTIFICATION"]
    Fallback --> BrokerReview["Broker Admin sees lead on dashboard to forward manually"]
```
