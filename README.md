# CHP-SCIS Prototype

**Integrating CHP Referral Data as Demand Signals into Kenya's National Health Supply Chain**

> University of Nairobi · MSc Applied Computing · DSR Dissertation Prototype  
> Researcher: George Ngambi Githae (P51/6194/2017)  
> Supervisor: Prof. Peter Waiganjo

---

## The Problem This Solves

Community Health Promoters (CHPs) in Nairobi conduct household health screenings and issue
paper referral slips directing patients to health facilities. The paper slips get lost, leaving
**no data trail**. Kenya's supply chain (iLMIS/KEMSA) is therefore blind to community-generated
demand — facilities run out of medicines because no one can see patients coming.

**This prototype demonstrates:** CHPs record digital referrals in eCHIS → an ICD-10
referral-to-commodity mapping engine derives demand signals → FHIR `ServiceRequest` resources
are routed via an OpenHIE mediator to **KenyaEMR** (facility EMR) and **KEMSA iLMIS**
(national supply chain) → facility managers and county planners see anticipated demand
before patients arrive.

---

## Architecture

```
Android Phone (CHP)
      │
  CHT App (referral form — ICD-10 condition, facility, urgency)
      │
  Medic CHT 4.7  ◄──►  CouchDB
      │
  POST /referral (JSON CHT document)
      │
  ┌───▼──────────────────────────────────────────┐
  │  FHIR Mediator (Node.js / OpenHIM)           │
  │                                               │
  │  1. Map CHT doc → FHIR R4 ServiceRequest     │
  │  2. ICD-10 → commodity demand lookup         │
  │  3. Route to KenyaEMR (facility EMR)         │
  │  4. Route demand signal to iLMIS             │
  │  5. Log referral event to DHIS2 Tracker      │
  │  6. Persist to PostgreSQL for dashboard      │
  └──┬───────────┬──────────────┬────────────────┘
     │           │              │
KenyaEMR    iLMIS stub     DHIS2 stub
  stub       (KEMSA)        (county)
     │
  Decision Dashboard (React)
  - Referral Log (all ServiceRequests)
  - Emergency Alerts
  - Commodity Demand chart (referral count per commodity)
```

---

## Repository Structure

```
chp-scis-prototype/
├── docker-compose.yml
├── postgres/
│   └── init.sql                     ← referrals table schema + indexes
├── cht-app/
│   ├── app_settings.json
│   ├── contact-summary.js
│   ├── targets.js
│   ├── tasks.js                     ← referral_submission + emergency_followup tasks
│   └── forms/
│       └── stock_report.json        ← CHT referral form (condition, facility, urgency)
├── fhir-mediator/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js                 ← Express server + OpenHIM registration
│       ├── mapper.js                ← CHT doc → FHIR R4 ServiceRequest
│       ├── mapping/
│       │   ├── icd10-commodity-map.json   ← 7 conditions → 10 commodities
│       │   └── referral-mapper.js         ← getCommodityDemand(), getConditionLabel()
│       ├── adapters/
│       │   └── kenyaemr-adapter.js        ← OAuth2 + POST to KenyaEMR FHIR endpoint
│       └── routes/
│           ├── stock.js             ← POST /referral (full pipeline)
│           └── reports.js           ← GET /reports/referrals|summary|demand|alerts
├── stubs/
│   ├── ilmis/index.js               ← Mock KEMSA iLMIS — accepts ServiceRequest
│   └── dhis2/index.js               ← Mock DHIS2 Tracker — referral demand events
└── dashboard/
    └── src/
        ├── App.jsx
        └── components/
            ├── SummaryCards.jsx     ← Total referrals, emergencies, active CHUs
            ├── StockTable.jsx       ← Referral log table (sortable)
            ├── StockoutAlerts.jsx   ← Emergency referrals panel
            └── StockChart.jsx       ← Commodity demand bar chart
```

---

## ICD-10 → Commodity Mapping

| ICD-10 | Condition | Commodities triggered |
|--------|-----------|----------------------|
| B50–B54 | Malaria | Malaria RDT + ACT (AL) |
| A09 | Diarrhoea | ORS + Zinc |
| J06 | Acute Upper Respiratory Infection | Amoxicillin 250mg |
| J22 | Pneumonia / Acute Lower RI | Amoxicillin 250mg |
| Z30 | Family Planning Consultation | Combined OCP + Condoms |
| Z34 | Antenatal Care | SP/Fansidar (IPTp) + Iron/Folate |
| P00–P04 | Newborn / Neonatal Referral | Chlorhexidine (cord care) |

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

First run: ~5–10 minutes. The PostgreSQL `referrals` table is created automatically
from `postgres/init.sql` on first boot.

### 2. Access points

| Service | URL | Credentials |
|---------|-----|-------------|
| CHT WebApp | http://localhost:5988 | admin / medic |
| OpenHIM Console | http://localhost:9000 | root@openhim.org / openhim1 |
| FHIR Mediator | http://localhost:3000/health | — |
| Decision Dashboard | http://localhost:4000 | — |
| iLMIS Stub | http://localhost:4500/health | — |
| DHIS2 Stub | http://localhost:4501/health | admin / district |
| CouchDB | http://localhost:5984 | admin / medic |
| PostgreSQL | localhost:5432 | cht / cht |

### 3. Deploy CHT app config

```bash
npm install -g cht-conf
cd cht-app
cht --url=http://admin:medic@localhost:5988
```

### 4. Create CHP simulation users

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
3. Tap **Tasks** → tap **Record Referral**
4. Fill in:
   - **Condition:** select an ICD-10 condition (e.g. Malaria)
   - **Destination Facility:** select a health centre
   - **Urgency:** Routine / Urgent / Emergency
   - **Patient Age Group:** select one
5. Submit

### What happens after submission
```
CHT form submitted
  → CHT stores document in CouchDB
  → FHIR Mediator receives POST /referral
  → Maps to FHIR R4 ServiceRequest (with ICD-10 code + commodity demand extension)
  → Posts to KenyaEMR stub (facility receives referral)
  → Posts to iLMIS stub (demand signal recorded)
  → Posts to DHIS2 stub (Tracker event logged)
  → Persists to PostgreSQL
  → Dashboard auto-refreshes within 60 seconds
```

### Verifying data flow
```bash
# Mediator logs (watch in real time)
docker compose logs -f fhir-mediator

# Confirm iLMIS received the ServiceRequest
curl http://localhost:4500/fhir/ServiceRequest

# Confirm DHIS2 received the referral event
curl -u admin:district http://localhost:4501/api/events

# Query the PostgreSQL referrals table directly
docker exec -it postgres psql -U cht -d cht -c "SELECT doc_id, condition_code, urgency, destination_facility, commodity_codes FROM referrals ORDER BY reported_date DESC LIMIT 10;"
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

**`referrals` table doesn't exist (PostgreSQL was already initialised):**
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
| FHIR Standard | HL7 FHIR R4 — ServiceRequest |
| ICD-10 Mapping | Custom JSON engine (`icd10-commodity-map.json`) |
| Facility EMR | KenyaEMR stub (OpenMRS FHIR R4) |
| Supply Chain | iLMIS stub (KEMSA) |
| Health Information | DHIS2 Tracker stub |
| Decision Dashboard | React 18 + MUI + Recharts |
| Persistence | PostgreSQL 15 (referrals table) |
| Containerisation | Docker Compose |

---

## Research Context

Prototype supports DSR Cycle 3 simulation-based evaluation:

- **SUS score** (System Usability Scale) — target ≥ 68
- **Task completion rate** — % of CHPs who submit a referral within 5 minutes
- **Time-on-task** — median time from task trigger to referral submission
- **Demand signal latency** — time from CHP submission to iLMIS/DHIS2 receipt
- **Perceived utility** — qualitative interviews (Appendix B.3)

Evaluation instruments: Appendices B.1–B.4 of the thesis document.
