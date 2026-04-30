# CHP-SCIS Prototype

**Integrating Community Health Promoters into Kenya's National Health Supply Chain Information System**

> University of Nairobi · MSc Information Systems · DSR Dissertation Prototype
> Simulation-based evaluation with 5–10 CHPs in Nairobi County

---

## Architecture Overview

```
Android Phone (CHP)
      |
   CHT App (stock_report form)
      |
   Medic CHT 4.7  <-->  CouchDB
      |
   OpenHIM Core  <-->  MongoDB
      |
   FHIR Mediator (Node.js)
      |         |
 iLMIS Stub   DHIS2 Stub
      |
   Decision Dashboard (React)
```

> **Note:** CHT-Sync (CouchDB → PostgreSQL) is disabled in this prototype — no pre-built
> image exists. Enable it by cloning https://github.com/medic/cht-sync and updating
> the commented-out service in `docker-compose.yml`.

---

## Repository Structure

```
chp-scis-prototype/
├── docker-compose.yml              # Full stack (9 active services)
├── cht-app/
│   ├── app_settings.json           # CHT configuration + CHP role
│   ├── contact-summary.js          # CHP contact card with stock levels
│   ├── targets.js                  # Analytics targets (reports, stockouts)
│   ├── tasks.js                    # Monthly report + stockout follow-up tasks
│   ├── .eslintrc                   # ESLint config required by cht-conf
│   └── forms/
│       └── stock_report.json       # CHP stock reporting form
├── fhir-mediator/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js                # Express server + OpenHIM registration
│       ├── mapper.js               # CHT -> FHIR R4 SupplyDelivery transformer
│       └── routes/
│           ├── stock.js            # POST /stock-report
│           └── reports.js          # GET /reports/stock|summary|alerts
├── stubs/
│   ├── ilmis/                      # Mock KEMSA iLMIS FHIR R4 endpoint (port 4500)
│   └── dhis2/                      # Mock DHIS2 Tracker endpoint (port 4501)
└── dashboard/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── public/index.html
    └── src/
        ├── index.js
        ├── App.jsx                 # Main dashboard with tabs
        └── components/
            ├── SummaryCards.jsx    # KPI cards (total, alerts, OK, last date)
            ├── StockTable.jsx      # Sortable stock table with stockout highlights
            ├── StockoutAlerts.jsx  # Alert list for CHPs below threshold
            └── StockChart.jsx      # Bar chart (Recharts) of aggregate stock
```

---

## Prerequisites

- Windows 10/11 with WSL 2 enabled
- Docker Desktop 4.x (with WSL2 backend)
- Git (or GitHub Desktop)
- Node.js LTS (for CHT CLI — see Step 4)
- ~8 GB RAM allocated to Docker

---

## Quick Start (Windows + Docker Desktop)

### 1. Clone the repository

```bash
git clone https://github.com/gabzsmallz/chp-scis-prototype.git
cd chp-scis-prototype
```

### 2. Pull CHT images from Amazon ECR

CHT 4.x images are hosted on Amazon ECR Public. Pull them one at a time to avoid
rate limits:

```bash
docker pull public.ecr.aws/medic/cht-couchdb:4.7.0
docker pull public.ecr.aws/medic/cht-api:4.7.0
docker pull public.ecr.aws/medic/cht-sentinel:4.7.0
docker pull public.ecr.aws/medic/cht-haproxy:4.7.0
```

### 3. Start all services

```bash
docker compose up -d
```

First run takes ~5–10 minutes. Verify with:

```bash
docker compose ps
```

All services should show `running`. Key access points:

| Service | URL | Credentials |
|---|---|---|
| CHT WebApp | http://localhost:5988 | admin / medic |
| OpenHIM Console | http://localhost:9000 | root@openhim.org / openhim1 |
| FHIR Mediator | http://localhost:3000/health | (no auth) |
| Decision Dashboard | http://localhost:4000 | (no auth) |
| iLMIS Stub | http://localhost:4500/health | (no auth) |
| DHIS2 Stub | http://localhost:4501/health | admin / district |
| CouchDB | http://localhost:5984 | admin / medic |
| PostgreSQL | localhost:5432 | cht / cht |

### 4. Install Node.js and CHT CLI (once)

```powershell
winget install OpenJS.NodeJS.LTS
```

Reopen your terminal, then install the CHT CLI:

```bash
npm install -g cht-conf
```

> The package is `cht-conf` — not `@medic/cht-conf`.

### 5. Deploy CHT app config

From the `cht-app/` directory:

```bash
cd cht-app
cht --url=http://admin:medic@localhost:5988
```

### 6. Create CHP simulation users

In the CHT WebApp (http://localhost:5988), go to **Admin > Users** and create 5–10
CHP users with:

- Role: `chp`
- Place: assign to a CHU clinic contact

---

## Simulation Session Instructions

### For the Facilitator

1. Start all services: `docker compose up -d`
2. Open the Decision Dashboard: http://localhost:4000
3. Give each CHP participant the CHT WebApp URL and their login credentials
4. Ask CHPs to complete the simulation tasks in the observation checklist (B.4)

### For CHP Participants (Android phone)

1. Open Chrome on your Android phone
2. Navigate to: `http://<facilitator-laptop-IP>:5988`
3. Log in with your username and password
4. Tap the **Tasks** tab — you should see "Monthly Stock Report Due"
5. Tap the task and fill in current stock counts for each commodity
6. Submit the form

### Observing Data Flow

After a CHP submits a stock report, verify the data flow:

```bash
# Check FHIR mediator logs
docker compose logs fhir-mediator

# Check iLMIS stub received data
curl http://localhost:4500/fhir/SupplyDelivery

# Check DHIS2 stub received events
curl -u admin:district http://localhost:4501/api/events

# Dashboard auto-refreshes every 60 seconds
# http://localhost:4000
```

---

## Stockout Thresholds

| Commodity | Threshold | Unit |
|---|---|---|
| Amoxicillin 250mg | 10 | tablets |
| ORS sachets | 5 | sachets |
| Zinc sulfate 20mg | 10 | tablets |
| Malaria RDT | 5 | tests |
| Combined OCP | 3 | cycles |
| DMPA injectable | 2 | vials |

---

## Stopping Services

```bash
docker compose down
```

Full reset (removes all data volumes):

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
Pull images one at a time (see Step 2), or authenticate via AWS CLI:
```bash
winget install Amazon.AWSCLI
aws configure
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
```

**Port conflicts:**
Edit `docker-compose.yml` and change the host port (left side of `:`).

**WSL memory issues:**
Create `%USERPROFILE%\.wslconfig` with:
```
[wsl2]
memory=6GB
processors=4
```
Then restart WSL: `wsl --shutdown`

---

## Technology Stack

| Component | Technology |
|---|---|
| Community Health App | Medic CHT 4.7 |
| Integration Engine | OpenHIM Core v8.5.1 |
| FHIR Mediator | Node.js 20 + Express |
| Supply Chain | iLMIS stub (FHIR R4 SupplyDelivery) |
| Health Information | DHIS2 Tracker stub |
| Decision Dashboard | React 18 + MUI + Recharts |
| Database | CouchDB (ECR) + MongoDB 6 |
| Containerisation | Docker Compose |

---

## Research Context

This prototype supports a simulation-based evaluation (DSR Cycle 3) assessing:

- **SUS score** (System Usability Scale) — target ≥ 68
- **Task completion rate** — % of CHPs who submit stock report within 7 minutes
- **Time-on-task** — median time to submit stock report form
- **Perceived utility** — qualitative interviews (Appendix B.3)

Evaluation instruments are in the research document (Appendices B.1–B.4).
