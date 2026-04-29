# CHP-SCIS Prototype

**Integrating Community Health Promoters into Kenya's National Health Supply Chain Information System**

> University of Nairobi · MSc Information Systems · DSR Dissertation Prototype
> > Simulation-based evaluation with 5-10 CHPs in Nairobi County
> >
> > ---
> >
> > ## Architecture Overview
> >
> > ```
> > Android Phone (CHP)
> >       |
> >    CHT App (stock_report form)
> >       |
> >    Medic CHT 4.x  <-->  CouchDB
> >       |
> >    CHT-Sync  -->  PostgreSQL
> >       |
> >    OpenHIM Core  <-->  MongoDB
> >       |
> >    FHIR Mediator (Node.js)
> >       |         |
> >  iLMIS Stub   DHIS2 Stub
> >       |
> >    Decision Dashboard (React)
> > ```
> >
> > ## Repository Structure
> >
> > ```
> > chp-scis-prototype/
> > ├── docker-compose.yml          # Full 10-service stack
> > ├── cht-app/
> > │   ├── app_settings.json       # CHT configuration + CHP role
> > │   ├── forms/
> > │   │   └── stock_report.json   # CHP stock reporting form
> > │   └── tasks.js                # Monthly report + stockout follow-up tasks
> > ├── fhir-mediator/
> > │   ├── Dockerfile
> > │   ├── package.json
> > │   └── src/
> > │       ├── index.js            # Express server + OpenHIM registration
> > │       ├── mapper.js           # CHT -> FHIR R4 SupplyDelivery transformer
> > │       └── routes/
> > │           ├── stock.js        # POST /stock-report
> > │           └── reports.js      # GET /reports/stock|summary|alerts
> > ├── stubs/
> > │   ├── ilmis/                  # Mock KEMSA iLMIS FHIR R4 endpoint (port 4500)
> > │   └── dhis2/                  # Mock DHIS2 Tracker endpoint (port 4501)
> > └── dashboard/
> >     ├── Dockerfile
> >     ├── nginx.conf
> >     ├── package.json
> >     ├── public/index.html
> >     └── src/
> >         ├── index.js
> >         ├── App.jsx             # Main dashboard with tabs
> >         └── components/
> >             ├── SummaryCards.jsx   # KPI cards (total, alerts, OK, last date)
> >             ├── StockTable.jsx     # Sortable stock table with stockout highlights
> >             ├── StockoutAlerts.jsx # Alert list for CHPs below threshold
> >             └── StockChart.jsx    # Bar chart (Recharts) of aggregate stock
> > ```
> >
> > ---
> >
> > ## Prerequisites
> >
> > - Windows 10/11 with WSL 2 enabled
> > - - Docker Desktop 4.x (with WSL2 backend)
> >   - - Git (or GitHub Desktop)
> >     - - ~8 GB RAM allocated to Docker
> >      
> >       - ---
> >
> > ## Quick Start (Windows + WSL + Docker Desktop)
> >
> > ### 1. Clone the repository
> >
> > Open PowerShell or WSL terminal:
> >
> > ```bash
> > git clone https://github.com/gabzsmallz/chp-scis-prototype.git
> > cd chp-scis-prototype
> > ```
> >
> > ### 2. Start all services
> >
> > ```bash
> > docker compose up -d
> > ```
> >
> > This starts 10 services. First run takes ~5-10 minutes to pull images.
> >
> > ### 3. Verify services are running
> >
> > ```bash
> > docker compose ps
> > ```
> >
> > All services should show `running`. Key ports:
> >
> > | Service | URL | Credentials |
> > |---|---|---|
> > | CHT WebApp | http://localhost:5988 | admin / medic |
> > | OpenHIM Console | http://localhost:9000 | root@openhim.org / openhim-password |
> > | Decision Dashboard | http://localhost:4000 | (no auth) |
> > | FHIR Mediator | http://localhost:3000/health | (no auth) |
> > | iLMIS Stub | http://localhost:4500/health | (no auth) |
> > | DHIS2 Stub | http://localhost:4501/health | admin / district |
> >
> > ### 4. Deploy CHT app config
> >
> > Install CHT CLI:
> > ```bash
> > npm install -g @medic/cht-conf
> > ```
> >
> > Deploy from the cht-app directory:
> > ```bash
> > cd cht-app
> > cht --url=http://admin:medic@localhost:5988 deploy-app-settings
> > cht --url=http://admin:medic@localhost:5988 upload-app-forms
> > ```
> >
> > ### 5. Create CHP simulation users
> >
> > In the CHT WebApp (http://localhost:5988), go to **Admin > Users** and create 5-10 CHP users with:
> > - Role: `chp`
> > - - Place: assign to a CHU clinic contact
> >  
> >   - ---
> >
> > ## Simulation Session Instructions
> >
> > ### For the Facilitator
> >
> > 1. Start all services: `docker compose up -d`
> > 2. 2. Open the Decision Dashboard: http://localhost:4000
> >    3. 3. Give each CHP participant the CHT WebApp URL and their login credentials
> >       4. 4. Ask CHPs to complete the simulation tasks in the observation checklist (B.4)
> >         
> >          5. ### For CHP Participants (Android phone)
> >         
> >          6. 1. Open Chrome on your Android phone
> >             2. 2. Navigate to: `http://<facilitator-laptop-IP>:5988`
> >                3. 3. Log in with your username and password
> >                   4. 4. Tap the **Tasks** tab — you should see "Monthly Stock Report Due"
> >                      5. 5. Tap the task and fill in current stock counts for each commodity
> >                         6. 6. Submit the form
> >                           
> >                            7. ### Observing Data Flow
> >                           
> >                            8. After a CHP submits a stock report, you can verify the data flow:
> >                           
> >                            9. ```bash
> > # Check FHIR mediator logs
> > docker compose logs fhir-mediator
> >
> > # Check iLMIS stub received data
> > curl http://localhost:4500/fhir/SupplyDelivery
> >
> > # Check DHIS2 stub received events
> > curl -u admin:district http://localhost:4501/api/events
> >
> > # Refresh the dashboard
> > # http://localhost:4000 auto-refreshes every 60 seconds
> > ```
> >
> > ---
> >
> > ## Stockout Thresholds
> >
> > | Commodity | Threshold | Unit |
> > |---|---|---|
> > | Amoxicillin 250mg | 10 | tablets |
> > | ORS sachets | 5 | sachets |
> > | Zinc sulfate 20mg | 10 | tablets |
> > | Malaria RDT | 5 | tests |
> > | Combined OCP | 3 | cycles |
> > | DMPA injectable | 2 | vials |
> >
> > ---
> >
> > ## Stopping Services
> >
> > ```bash
> > docker compose down
> > ```
> >
> > To also remove volumes (full reset):
> > ```bash
> > docker compose down -v
> > ```
> >
> > ---
> >
> > ## Troubleshooting
> >
> > **CHT not starting:**
> > ```bash
> > docker compose logs cht-api
> > ```
> >
> > **Port conflicts:**
> > Edit `docker-compose.yml` and change the host port (left side of `:`).
> >
> > **WSL memory issues:**
> > Create `%USERPROFILE%\.wslconfig` with:
> > ```
> > [wsl2]
> > memory=6GB
> > processors=4
> > ```
> > Then restart WSL: `wsl --shutdown`
> >
> > ---
> >
> > ## Technology Stack
> >
> > | Component | Technology |
> > |---|---|
> > | Community Health App | Medic CHT 4.x |
> > | Data Sync | CHT-Sync (CouchDB -> PostgreSQL) |
> > | Integration Engine | OpenHIM Core 8 |
> > | FHIR Mediator | Node.js 20 + Express |
> > | Supply Chain | iLMIS stub (FHIR R4 SupplyDelivery) |
> > | Health Information | DHIS2 Tracker stub |
> > | Decision Dashboard | React 18 + MUI + Recharts |
> > | Database | CouchDB 4 + PostgreSQL 15 |
> > | Containerisation | Docker Compose |
> >
> > ---
> >
> > ## Research Context
> >
> > This prototype supports a simulation-based evaluation (DSR Cycle 3) assessing:
> > - **SUS score** (System Usability Scale) — target ≥ 68
> > - - **Task completion rate** — % of CHPs who submit stock report within 7 minutes
> >   - - **Time-on-task** — median time to submit stock report form
> >     - - **Perceived utility** — qualitative interviews (Appendix B.3)
> >      
> >       - Evaluation instruments are in the research document (Appendices B.1-B.4).
> >      
> >       - ---
