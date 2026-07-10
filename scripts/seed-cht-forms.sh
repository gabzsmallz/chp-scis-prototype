#!/bin/sh
# seed-cht-forms.sh
# Uploads the CHP Stock Report form (JSON metadata + XForm XML) and English
# translations to CouchDB. Runs on every docker compose up — safe to re-run.

set -e

COUCH="http://admin:medic@couchdb:5984/medic"
FORM_ID="form:stock_report"
TRANS_ID="messages-en"

echo "[seeder] Waiting for CouchDB to be ready..."
until curl -sf "http://admin:medic@couchdb:5984/_up" > /dev/null 2>&1; do
  sleep 2
done
echo "[seeder] CouchDB is ready."

# ── Upload form JSON metadata ─────────────────────────────────────────────────
REV=$(curl -sf "$COUCH/$FORM_ID" | grep -o '"_rev":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "$REV" ]; then
  echo "[seeder] Updating existing form doc (rev=$REV)..."
  curl -sf -X PUT "$COUCH/$FORM_ID?rev=$REV" \
    -H "Content-Type: application/json" \
    --data-binary @/seed/stock_report.json
else
  echo "[seeder] Creating new form doc..."
  curl -sf -X PUT "$COUCH/$FORM_ID" \
    -H "Content-Type: application/json" \
    --data-binary @/seed/stock_report.json
fi

# ── Attach XForm XML ──────────────────────────────────────────────────────────
REV=$(curl -sf "$COUCH/$FORM_ID" | grep -o '"_rev":"[^"]*"' | cut -d'"' -f4)
echo "[seeder] Attaching XForm XML (rev=$REV)..."
curl -sf -X PUT "$COUCH/$FORM_ID/xml?rev=$REV" \
  -H "Content-Type: application/xml" \
  --data-binary @/seed/stock_report.xml
echo "[seeder] Form upload complete."

# ── Upload English translations ───────────────────────────────────────────────
REV=$(curl -sf "$COUCH/$TRANS_ID" | grep -o '"_rev":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "$REV" ]; then
  echo "[seeder] Updating existing translations doc (rev=$REV)..."
  # Merge _rev into the JSON before PUT
  TRANS_JSON=$(cat /seed/translations-en.json)
  TRANS_WITH_REV=$(printf '%s' "$TRANS_JSON" | sed "s/\"_id\"/\"_rev\":\"$REV\",\"_id\"/")
  printf '%s' "$TRANS_WITH_REV" | curl -sf -X PUT "$COUCH/$TRANS_ID" \
    -H "Content-Type: application/json" \
    --data-binary @-
else
  echo "[seeder] Creating new translations doc..."
  curl -sf -X PUT "$COUCH/$TRANS_ID" \
    -H "Content-Type: application/json" \
    --data-binary @/seed/translations-en.json
fi

echo "[seeder] Translations upload complete."
