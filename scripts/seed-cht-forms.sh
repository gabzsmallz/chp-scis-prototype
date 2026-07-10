#!/bin/sh
# seed-cht-forms.sh
# Uploads the CHP Stock Report form (JSON metadata + XForm XML) and English
# translations to CouchDB. Runs on every docker compose up — safe to re-run.
#
# Two-phase wait:
#   1. CouchDB process is up   (_up endpoint)
#   2. medic database exists   (cht-api creates this; can take 30-90 s on cold start)

set -e

COUCH="http://admin:medic@couchdb:5984"
MEDIC="$COUCH/medic"
FORM_ID="form:stock_report"
TRANS_ID="messages-en"

# ── Phase 1: CouchDB process ──────────────────────────────────────────────────
echo "[seeder] Waiting for CouchDB process..."
until curl -sf "$COUCH/_up" > /dev/null 2>&1; do
  sleep 3
done
echo "[seeder] CouchDB process is up."

# ── Phase 2: medic database (created by cht-api on first boot) ───────────────
echo "[seeder] Waiting for medic database to be initialised by cht-api..."
until curl -sf "$MEDIC" > /dev/null 2>&1; do
  sleep 5
done
echo "[seeder] medic database is ready."

# ── Upload form JSON metadata ─────────────────────────────────────────────────
REV=$(curl -sf "$MEDIC/$FORM_ID" | grep -o '"_rev":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "$REV" ]; then
  echo "[seeder] Updating existing form doc (rev=$REV)..."
  curl -sf -X PUT "$MEDIC/$FORM_ID?rev=$REV" \
    -H "Content-Type: application/json" \
    --data-binary @/seed/stock_report.json
else
  echo "[seeder] Creating new form doc..."
  curl -sf -X PUT "$MEDIC/$FORM_ID" \
    -H "Content-Type: application/json" \
    --data-binary @/seed/stock_report.json
fi

# ── Attach XForm XML ──────────────────────────────────────────────────────────
REV=$(curl -sf "$MEDIC/$FORM_ID" | grep -o '"_rev":"[^"]*"' | cut -d'"' -f4)
echo "[seeder] Attaching XForm XML (rev=$REV)..."
curl -sf -X PUT "$MEDIC/$FORM_ID/xml?rev=$REV" \
  -H "Content-Type: application/xml" \
  --data-binary @/seed/stock_report.xml
echo "[seeder] Form upload complete."

# ── Upload English translations ───────────────────────────────────────────────
REV=$(curl -sf "$MEDIC/$TRANS_ID" | grep -o '"_rev":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "$REV" ]; then
  echo "[seeder] Updating existing translations doc (rev=$REV)..."
  TRANS_JSON=$(cat /seed/translations-en.json)
  TRANS_WITH_REV=$(printf '%s' "$TRANS_JSON" | sed "s/\"_id\"/\"_rev\":\"$REV\",\"_id\"/")
  printf '%s' "$TRANS_WITH_REV" | curl -sf -X PUT "$MEDIC/$TRANS_ID" \
    -H "Content-Type: application/json" \
    --data-binary @-
else
  echo "[seeder] Creating new translations doc..."
  curl -sf -X PUT "$MEDIC/$TRANS_ID" \
    -H "Content-Type: application/json" \
    --data-binary @/seed/translations-en.json
fi

echo "[seeder] Translations upload complete."
