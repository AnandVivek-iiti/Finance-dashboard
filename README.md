# Finance Dashboard

Upload a bank statement (`.xls`, `.xlsx`, or `.pdf`) and get a full visual
spending report — no spreadsheet knowledge required. Every number on the
dashboard is computed live from a strictly-typed, validated JSON record of
each transaction; nothing is estimated or guessed.

```
finance-dashboard/
├── backend/
│   ├── bankProfiles/        # Per-bank header detection + column mapping
│   │   ├── canara.js        #   Canara Bank profile (used for your statement)
│   │   ├── generic.js       #   Fallback for other banks
│   │   └── index.js         #   Tries each profile, first match wins
│   ├── parsers/
│   │   ├── xlsParser.js      # .xls/.xlsx -> raw 2D row array (SheetJS)
│   │   ├── pdfParser.js      # .pdf -> raw 2D row array (via Python/pdfplumber)
│   │   ├── tableParser.js    # raw rows -> normalized transactions (the core engine)
│   │   ├── categorizer.js    # rule-based categorization + merchant extraction
│   │   └── dateParser.js     # multi-format date parsing
│   ├── scripts/pdf_extract.py  # pdfplumber table extractor, called via child_process
│   ├── models/                # Statement, Transaction, ParseError, CategoryOverride
│   ├── services/metricsEngine.js  # computes every dashboard metric from transactions
│   ├── controllers/, routes/, middleware/
│   └── server.js
├── frontend/
│   ├── src/pages/UploadPage.jsx, DashboardPage.jsx
│   ├── src/components/        # KpiCards, charts, FilterBar, StatementSwitcher, etc.
│   ├── src/hooks/              # useStatements, useMetrics
│   └── .env.example            # VITE_API_BASE (set at build time)
├── render.yaml                 # Render Blueprint — deploys backend + frontend together
└── README.md (this file)
```

## Why this stack

- **MongoDB** stores three collections: `statements` (metadata per upload),
  `transactions` (normalized, strictly-typed, one document per transaction),
  `parseerrors` (rows that couldn't be verified — shown to you, not hidden).
- **Express** does all parsing, validation, categorization, and metrics
  computation. The frontend never computes a statistic itself — it only
  renders what the API returns.
- **React + Recharts**, light theme, KPI cards + charts + a searchable
  transaction table.
- **Python + pdfplumber** for PDF table extraction specifically — pdfplumber's
  table detection is meaningfully better than any pure-Node library at the
  time of writing, so `pdfParser.js` shells out to a small Python script
  (`scripts/pdf_extract.py`) via `child_process`. This is the one place the
  stack isn't pure Node, called out here rather than hidden.

## 1. Prerequisites

- Node.js 18+
- Python 3 with `pdfplumber` installed (only needed if you'll upload PDFs):
  ```bash
  pip install pdfplumber --break-system-packages
  ```
- A MongoDB instance — local (`mongod` on `localhost:27017`) or a free
  [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

## 2. Run the backend

```bash
cd backend
npm install
cp .env.example .env      # edit MONGO_URI if using Atlas, or PYTHON_BIN if needed
npm run dev                # http://localhost:5000
```

## 3. Run the frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173, proxies /api -> :5000
```

Open the printed URL, drag in your statement, and the dashboard appears
automatically once parsing finishes.

## 4. How a file becomes a dashboard (the accuracy pipeline)

1. **Read raw rows.** `.xls`/`.xlsx` via SheetJS; `.pdf` via the pdfplumber
   Python helper. Both produce the same shape: a plain 2D array of cells.
2. **Detect the bank & find the header row.** `bankProfiles/index.js` tries
   each profile's header-matching rules against the raw rows. Your Canara
   Bank export is matched by `canara.js` (it even tolerates the bank's own
   "Trasnaction ID" typo). Unrecognized layouts fall back to `generic.js`;
   if nothing matches at all, the upload is rejected with a clear message
   instead of guessing a column layout.
3. **Normalize every row** (`tableParser.js`) into:
   ```json
   {
     "date": "2024-08-05T00:00:00.000Z",
     "transactionId": "20240805000001",
     "withdrawalPaise": null,
     "depositPaise": 700000,
     "balancePaise": 700000,
     "remarks": "CASH DEPOSIT SELF SIMROL IIT",
     "type": "credit",
     "category": "Cash Deposit",
     "merchantOrSource": "CASH DEPOSIT SELF SIMROL IIT",
     "reconciled": true
   }
   ```
   Amounts are stored as **integer paise**, never floats (see
   `utils/money.js`) — this is what makes exact reconciliation possible.
   A blank withdrawal/deposit cell is `null` ("no value"), never `0`.
4. **Reconcile every row.** Each row's stated balance is checked against
   `previousBalance ± thisTransactionAmount`. If it doesn't match, the row
   is flagged `reconciled: false` and logged to `parseErrors` — and is then
   **excluded from every metric** (see step 6), because an unverified amount
   shouldn't silently count toward your totals. On your actual statement,
   this caught one real row where the bank recorded a negative value in the
   Deposits column that breaks the running balance — it's excluded from
   totals and flagged in the UI rather than silently miscounted.
5. **Categorize.** `categorizer.js` runs an ordered, extendable rules array
   against each row's remarks (ATM, UPI, NEFT, salary, rent, etc.), and
   extracts a best-effort merchant/payee name. If you manually correct a
   category in the transaction table, that correction is saved as a
   `CategoryOverride` keyed by a normalized version of the remarks — so the
   same remark (in this statement or a future one) is auto-categorized
   correctly from then on.
6. **Compute metrics** (`services/metricsEngine.js`), live, per request,
   filtered by whatever's active in the UI:
   1. Total spent · 2. Total received · 3. Net savings + savings rate ·
   4. Avg monthly spend · 5. Avg monthly income · 6. Avg yearly spend ·
   7. Highest withdrawal · 8. Highest deposit · 9. Spend by category ·
   10. Monthly spend/income trend · 11. Balance over time ·
   12. Day-of-week pattern · 13. Top merchants · 14. Transactions/month +
   avg size · 15. Recurring payments (rule: same payee, amount within ±2%,
   ~25-35 days apart, ≥2 occurrences) · 16. Cash vs digital split ·
   17. Biggest expense category per month · 18. Lowest balance point.
7. **Multi-statement continuity check.** When you upload a new statement for
   an account you've already uploaded one for, the API checks that this
   statement's opening balance matches the previous statement's closing
   balance. A mismatch is surfaced as a warning banner (missing statement,
   date gap, or duplicate/overlapping upload) rather than silently combined.

## 5. Correcting a category

Click any category pill in the transaction table, type the right one, hit
the checkmark. That single correction is remembered — re-uploading the same
statement, or seeing the same remark in a future statement, applies it
automatically.

## 6. Deleting your data

Every statement in the switcher dropdown has a delete icon — it removes the
statement, all its transactions, and its parse errors from MongoDB
permanently. This matters because these files contain a real account number,
IFSC code, and your name.

## 7. Adding support for another bank

Copy `backend/bankProfiles/canara.js` to e.g. `hdfc.js`, adjust
`HEADER_MATCHERS` to that bank's column names and `extractMetadata` to its
letterhead layout, then add it to the `PROFILES` array in
`bankProfiles/index.js` (before `generic`). Nothing else needs to change —
the parser, categorizer, reconciliation, and metrics engine are all
bank-agnostic.

## 8. Known limitations (documented, not hidden)

- PDF parsing needs a text-based table (via pdfplumber). Scanned/image-only
  PDF statements would need OCR, which isn't implemented.
- Merchant-name extraction is rule-based pattern matching on remarks text,
  not NLP — good enough for "Top Merchants" but won't be perfect on every
  bank's remarks format.
- No authentication is included. If you deploy this anywhere beyond your own
  machine, put it behind basic auth or a login before exposing real account
  data.

## 9. Production build (local)

```bash
cd frontend && npm run build   # outputs to frontend/dist/
```
Serve `frontend/dist/` behind any static host, and set `VITE_API_BASE` at
build time to point at your deployed API.

## 10. Deploying to Render (backend + frontend)

The repo ships with a `render.yaml` Blueprint that deploys both services in
one go. The backend is a Node **Web Service** that also installs the Python
PDF-parsing dependencies from `backend/scripts/requirements.txt` during its
build step; the frontend is a **Static Site** built from `frontend/`.

### Option A — one-click with the Blueprint

1. Push this repo to GitHub/GitLab.
2. In the Render dashboard: **New → Blueprint**, pick this repo. Render reads
   `render.yaml` and creates both services automatically.
3. Render will pause and ask for the env vars marked `sync: false` — fill in:
   - **finance-dashboard-backend**: `MONGO_URI` (your Atlas connection
     string), `FRONTEND_URL` (leave blank for the first deploy, see step 5)
   - **finance-dashboard-frontend**: `VITE_API_BASE` (leave blank for the
     first deploy, see step 5)
4. Deploy. Once both services are live, note their URLs, e.g.:
   - Backend: `https://finance-dashboard-backend.onrender.com`
   - Frontend: `https://finance-dashboard-frontend.onrender.com`
5. Go back into each service's **Environment** tab and set the values that
   depend on each other, then trigger a redeploy of each:
   - Backend `FRONTEND_URL` = the frontend URL from step 4
   - Frontend `VITE_API_BASE` = `<backend URL>/api` (e.g.
     `https://finance-dashboard-backend.onrender.com/api`) — this only takes
     effect on a fresh build, since Vite bakes it in at build time.

### Option B — manual setup (no Blueprint)

**Backend (Web Service):**
- Root directory: `backend`
- Runtime: Node
- Build command: `npm install && pip3 install -r scripts/requirements.txt --break-system-packages`
  — this is the step that installs `pdfplumber` and `msoffcrypto-tool` (the
  `scripts/requirements.txt` file) into Render's build image; nothing else
  is needed to "deploy" that file, it just needs to be picked up by `pip3`
  during the build.
- Start command: `npm start`
- Environment variables: `MONGO_URI`, `FRONTEND_URL`, `PYTHON_BIN=python3`, `NODE_ENV=production`

**Frontend (Static Site):**
- Root directory: `frontend`
- Build command: `npm install && npm run build`
- Publish directory: `dist`
- Environment variables: `VITE_API_BASE=<backend URL>/api`
- Add a rewrite rule `/*` → `/index.html` (single-page app fallback)

### Database

Use a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster for
`MONGO_URI` — Render's free tier has no persistent disk suitable for running
MongoDB yourself. Whitelist `0.0.0.0/0` in Atlas's network access (or
Render's outbound IPs) so the backend can connect.

### Notes specific to this stack

- **Uploaded files never persist**: `uploadController.js` deletes the
  temporary file from `backend/uploads/` immediately after parsing (success
  or failure), so Render's ephemeral filesystem is fine — no paid persistent
  disk is required.
- **CORS is locked down in production**: `server.js` only allows the
  origin(s) listed in `FRONTEND_URL`. If you skip setting it, the API falls
  back to allowing all origins (fine for local dev, not recommended for a
  public deployment).
- **Free-tier cold starts**: Render's free web services spin down after
  inactivity; the first request after idling can take 30-60s while the
  instance (and the Mongo connection) wake up.
- Add authentication in front of this app before deploying with real
  statement data - see the "Known limitations" section above.