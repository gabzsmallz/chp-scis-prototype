# CHP-SCIS Prototype

**Improving Community Health Promoter Commodity Management Through FHIR-Based Stock Visibility in Kenya's Community Health Supply Chain**

> University of Nairobi · MSc Applied Computing · DSR Dissertation Prototype
> Researcher: George Ngambi Githae (P51/6194/2017)
> Supervisor: Prof. Peter Waiganjo

---

## The Problem This Solves

Community Health Promoters (CHPs) in Nairobi record commodity stock-on-hand largely on paper or in siloed eCHIS records that never reach the facility or county level. Kenya's supply chain (iLMIS/KEMSA) is therefore blind to CHP-level stock status — facilities and counties only learn about a stockout long after it has already disrupted service delivery.

**This prototype demonstrates:** CHPs record multi-commodity stock reports in eCHIS (CHT) → a FHIR mediator transforms each report into a FHIR R5 `InventoryReport` → the report is forwarded to the facility LMIS (iLMIS stub), county aggregate reporting (DHIS2 stub), and a PostgreSQL store for the dashboard → any commodity at zero stock is detected and a formal FHIR `SupplyRequest` is escalated to the CHP's attached facility (AfyaKE stub), with an in-app alert written back into eCHIS so the CHA can see and track the escalation.

Earlier iterations of this prototype explored a CHP-to-CHP **lateral resupply** mechanism (matching a stockout against a neighbouring CHP's surplus before escalating). Field questionnaire findings (CHP/CHA pre- and post-demo instruments, July 2026) showed stockout duration is driven mainly by upstream supply availability and facility response capacity rather than by CHP-to-CHP data blindness, and that visibility does not, by CHAs' own account, automatically change resupply behaviour. The lateral mechanism was dropped accordingly; the current prototype focuses on stock visibility and formal facility escalation only, consistent with the revised conceptual framework and research questions.

---

## Architecture

```
Android Phone / Browser (CHP)
      │
  CHT App — stock_report form (multi-commodity: code, qty on hand/dispensed/received, expiry)
      │
  Medic CHT 4.7  ◄──►  CouchDB
      │
  POST /stock-report (JSON CHT document)
      │
  ┌───▼────────────────────────────────────────────────────────┐
  │  FHIR Mediator (Node.js / Express, registered with OpenHIM) │
  │                                                              │
  │  1. Map CHT doc → FHIR R5 InventoryReport                  │
  │  2. POST InventoryReport → iLMIS stub (facility visibility) │
  │  3. POST stock event → DHIS2 stub (county aggregate)        │
  │  4. Persist to PostgreSQL (dashboard)                       │
  │  5. If any commodity = 0: build FHIR SupplyRequest,         │
  │     POST to AfyaKE stub, write chp_stockout_alert to        │
  │     CouchDB so the CHA sees an in-app escalation task       │
  └──┬───────────┬──────────────┬───────────────┬───────────────┘
     │           │              │               │
  iLMIS stub  DHIS2 stub   AfyaKE stub      PostgreSQL
  (KEMSA)     (county)     (facility LMIS)  (stock_reports,
                                              supply_requests)
                                                  │
                                          Decision Dashboard (React)
                                          - Stock Overview table
                                          - Stockout Alerts panel
                                          - Commodity stock chart
```

---

## Repository Structure

```
chp-scis-prototype/
├── docker-compose.yml
├── postgres/
│   └── init.sql                        ← stock_reports + supply_requests schema, chp_stock_latest view
├── cht-app/
│   ├── app_settings.json
│   ├── contact-summary.js
│   ├── targets.js
│   ├── tasks.js                        ← monthly_stock_report, stockout_followup, stockout_escalation tasks
│   └── forms/app/
│       ├── stock_report.json
│       └── stock_report.xml            ← multi-commodity CHT stock reporting form
├── fhir-mediator/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js                    ← Express server + OpenHIM mediator registration
│       ├── mapper.js                   ← CHT stock_report doc → FHIR R5 InventoryReport
│       ├── engine/
│       │   └── stockout-detector.js    ← builds SupplyRequest + escalates to AfyaKE + CouchDB alert
│       ├── fhir/
│       │   └── supply-request-builder.js  ← FHIR R5 SupplyRequest (formal, CHP → facility)
│       ├── adapters/
│       │   ├── afyake-adapter.js       ← POSTs SupplyRequest to AfyaKE (facility LMIS)
│       │   └── couchdb-adapter.js      ← writes chp_stockout_alert back into CHT/CouchDB
│       └── routes/
│           ├── stock.js                ← POST /stock-report (full pipeline)
│           └── reports.js              ← GET /reports/stock|summary|alerts|supply-requests
├── stubs/
│   ├── ilmis/index.js                  ← Mock facility iLMIS — accepts InventoryReport
│   ├── dhis2/index.js                  ← Mock DHIS2 Tracker — CHP stock events + analytics
│   └── afyake/index.js                 ← Mock AfyaKE facility EMR/LMIS — accepts SupplyRequest
└── dashboard/
    └── src/
        ├── App.jsx
        └── components/
            ├── SummaryCards.jsx        ← Total reports, stockout count, CHPs with stockouts
            ├── StockTable.jsx          ← Latest stock per CHP × commodity (sortable)
            ├── StockoutAlerts.jsx      ← Commodities currently at zero, grouped by CHP
            └── StockChart.jsx          ← Commodity stock levels chart
```

---

## Commodity Master List (Kenya National CHP Kit)

| Code | Commodity |
|------|-----------|
| KE-RDT-MAL-001 | Malaria Rapid Diagnostic Test (RDT) |
| KE-ACT-AL-001 | Artemether-Lumefantrine ACT (6-dose) |
| KE-ORS-001 | Oral Rehydration Salts (ORS) — sachet |
| KE-ZINC-20MG-001 | Zinc Sulphate 20mg tablet |
| KE-VITA-200K-001 | Vitamin A 200,000 IU capsule |
| KE-ITN-001 | Insecticide-Treated Net (ITN/LLIN) |
| KE-AMOX-250-001 | Amoxicillin 250mg capsule |
| KE-CHLORHEX-001 | Chlorhexidine 7.1% gel (cord care) |
| KE-DEWORMING-ALB-001 | Albendazole 400mg tablet |
| KE-FANSIDAR-001 | Sulfadoxine-Pyrimethamine/Fansidar (IPTp) |
| KE-IRON-FOLATE-001 | Ferrous Sulphate + Folic Acid tablet |
| KE-FP-COND-001 | Male condom (pack of 3) |
| KE-BP-STRIPS-001 | Blood glucose test strips |

---

## Prerequisites

- Windows 10/11 with WSL 2 enabled
- Docker Desktop 4.x (WSL 2 backend)
- ~8 GB RAM allocated to Docker
- Node.js LTS + `cht-conf` CLI (for deploying the CHT app config)

---

## Quick Start

### 1. Clone and start

```bash
git clone https://github.com/gabzsmallz/chp-scis-prototype.git
cd chp-scis-prototype
```

Pull CHT images (Amazon ECR Public — pull one at a time to avoid rate limits):

```bash
docker pull public.ecr.aws/medic/cht-couchdb:4.7.0
docker pull public.ecr.aws/medic/cht-api:4.7.0
docker pull public.ecr.aws/medic/cht-sentinel:4.7.0
docker pull public.ecr.aws/medic/cht-haproxy:4.7.0
```

Start the stack:

```bash
docker compose up -d
```

First run: ~5–10 minutes. The `cht-seeder` service uploads the `stock_report` form to CouchDB automatically. The PostgreSQL schema (`stock_reports`, `supply_requests`, `chp_stock_latest` view) is created automatically from `postgres/init.sql` on first boot.

### 2. Access points

| Service | URL | Credentials |
|---------|-----|-------------|
| CHT WebApp | http://localhost:5988 | admin / medic |
| OpenHIM Console | http://localhost:9000 | root@openhim.org / openhim1 |
| FHIR Mediator | http://localhost:3000/health | — |
| Decision Dashboard | http://localhost:4000 | — |
| iLMIS Stub | http://localhost:4500/health | — |
| DHIS2 Stub | http://localhost:4501/health | admin / district |
| AfyaKE Stub | http://localhost:4502/health | — |
| CouchDB | http://localhost:5984 | admin / medic |
| PostgreSQL | localhost:5432 | cht / cht |

### 3. Create CHP simulation users

In CHT WebApp → **Admin > Users**, create 5–10 users with:
- Role: `chp`
- Place: assign to a CHU contact

---

## Simulation Session

### Facilitator setup
1. `docker compose up -d`
2. Open the Decision Dashboard: **http://localhost:4000**
3. Open a second browser tab on the FHIR Mediator logs (or run `docker compose logs -f fhir-mediator`)

### CHP participant steps (Android phone or browser)
1. Open Chrome → navigate to `http://<laptop-IP>:5988`
2. Log in with the CHP account you created
3. Tap **Tasks** → tap **Submit Stock Report**
4. Fill in, for each commodity in the kit:
   - **Commodity:** select from the commodity picker
   - **Quantity on hand / dispensed / received**
   - **Expiry date** (nearest expiry in stock)
5. Submit

### What happens after submission
```
CHT form submitted
  → CHT stores document in CouchDB
  → FHIR Mediator receives POST /stock-report
  → Maps to FHIR R5 InventoryReport (per-commodity items + stockout-codes extension)
  → Posts to iLMIS stub (facility visibility of CHP stock)
  → Posts to DHIS2 stub (county aggregate reporting)
  → Persists to PostgreSQL (stock_reports)
  → If any commodity = 0:
      → Builds FHIR SupplyRequest, posts to AfyaKE stub (facility LMIS)
      → Writes chp_stockout_alert back to CouchDB
      → CHA sees "CHP Stockout Escalated" task in eCHIS
  → Dashboard auto-refreshes within 60 seconds
```

### Verifying data flow
```bash
# Mediator logs (watch in real time)
docker compose logs -f fhir-mediator

# Confirm iLMIS received the InventoryReport
curl http://localhost:4500/fhir/InventoryReport

# Confirm AfyaKE received a formal SupplyRequest (after a stockout)
curl http://localhost:4502/fhir/SupplyRequest

# Confirm DHIS2 received the stock event
curl -u admin:district http://localhost:4501/api/events

# Query the PostgreSQL stock_reports table directly
docker exec -it postgres psql -U cht -d cht -c "SELECT chp_id, chu_id, commodity_code, quantity_on_hand, has_stockout, reported_date FROM chp_stock_latest ORDER BY reported_date DESC LIMIT 10;"
```

---

## Stopping Services

```bash
docker compose down
```

Full reset (wipes all data — required if you need init.sql to re-run):
```bash
docker compose down -v
```

---

## Troubleshooting

**CHT not starting:**
```bash
docker compose logs cht-api
```

**ECR rate limit on image pull:**
```bash
winget install Amazon.AWSCLI
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
```

**Port conflicts:** edit the left side of `:` mappings in `docker-compose.yml`.

**WSL memory issues:** create `%USERPROFILE%\.wslconfig`:
```
[wsl2]
memory=6GB
processors=4
```
Then: `wsl --shutdown`

**`stock_reports`/`supply_requests` tables don't exist (PostgreSQL was already initialised):**
```bash
docker compose down -v
docker compose up -d
```
The `-v` flag removes the old postgres data volume so `init.sql` runs fresh.

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Community Health App | Medic CHT 4.7 (eCHIS-compatible) |
| Integration Engine | OpenHIM Core v8.5.1 |
| FHIR Mediator | Node.js 20 + Express |
| FHIR Standard | HL7 FHIR R5 — InventoryReport, SupplyRequest |
| Facility LMIS | AfyaKE stub (formal resupply escalation) |
| Supply Chain | iLMIS stub (KEMSA — CHP stock visibility) |
| Health Information | DHIS2 Tracker stub (county aggregate) |
| Decision Dashboard | React 18 + MUI + Recharts |
| Persistence | PostgreSQL 15 (`stock_reports`, `supply_requests`) |
| Containerisation | Docker Compose |

Note: `cht-sync` (CouchDB → PostgreSQL, for population-level analytics) is scaffolded in `docker-compose.yml` but commented out — no pre-built image currently exists. Build it from [medic/cht-sync](https://github.com/medic/cht-sync) if that layer is needed; the mediator currently persists to PostgreSQL directly on each stock report.

---

## Research Context

Prototype supports DSR Cycle 3 evaluation:

- **SUS score** (System Usability Scale) — target ≥ 68
- **Data completeness / latency** — required FHIR InventoryReport fields present; time from CHP submission to iLMIS/DHIS2 receipt
- **Functional test pass rate** — InventoryReport/SupplyRequest FHIR conformance, stockout detection, formal escalation
- **Specialist-assessed feasibility and usability** — supply chain specialists evaluate workflow alignment and functional correctness
- **Stockout impact** — assessed via specialist-guided scenario analysis, conditional on facility response capacity and upstream (KEMSA/county) supply availability, per the revised conceptual framework

Evaluation instruments: Appendices B.1–B.4 of the thesis document.
