# Finance Dashboard

Upload a bank statement (`.xls`, `.xlsx`, or `.pdf`) and get a full visual
spending report - no spreadsheet knowledge required. Every number on the
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
│   ├── models/User.js          # Google-authenticated account record
│   ├── middleware/requireAuth.js  # session cookie -> req.userId, else 401
│   ├── controllers/authController.js, routes/auth.js
│   └── utils/jwt.js            # signs/verifies the app's own session JWT
├── frontend/
│   ├── src/pages/LandingPage.jsx  # public, signed-out entry point (Google button)
│   ├── src/pages/UploadPage.jsx, DashboardPage.jsx
│   ├── src/components/        # KpiCards, charts, FilterBar, StatementSwitcher, etc.
│   └── src/hooks/              # useAuth, useStatements, useMetrics
└── README.md (this file)
```

## Why this stack

- **MongoDB** stores three collections: `statements` (metadata per upload),
  `transactions` (normalized, strictly-typed, one document per transaction),
  `parseerrors` (rows that couldn't be verified - shown to you, not hidden).
- **Express** does all parsing, validation, categorization, and metrics
  computation. The frontend never computes a statistic itself - it only
  renders what the API returns.
- **React + Recharts**, light theme, KPI cards + charts + a searchable
  transaction table.
- **Python + pdfplumber** for PDF table extraction specifically - pdfplumber's
  table detection is meaningfully better than any pure-Node library at the
  time of writing, so `pdfParser.js` shells out to a small Python script
  (`scripts/pdf_extract.py`) via `child_process`. This is the one place the
  stack isn't pure Node, called out here rather than hidden.

## Authentication

Sign-in is **Google-only** - there's no email/password signup or login form
anywhere in this app. That's a deliberate choice: no password storage,
hashing, reset-flow, or leak surface to build or secure.

- The frontend renders Google's own "Sign in with Google" button (via
  Google Identity Services) on the public landing page and gets back a
  Google-signed ID token - no redirect, no backend callback URL.
- The backend verifies that ID token server-side (`google-auth-library`),
  finds-or-creates a `User`, and issues its **own** short-lived session —
  a JWT stored in an `httpOnly, Secure, SameSite=None` cookie. The raw
  Google token is never used as the session itself.
- Every protected route (`/api/upload`, `/api/statements`, `/api/metrics`,
  `/api/transactions`) requires that cookie via `requireAuth` middleware.
- **All data is strictly scoped per Google account.** `Statement`,
  `Transaction`, `ParseError`, and `CategoryOverride` documents all carry a
  `userId`, and every query filters on it - one signed-in user can never
  read, list, or delete another user's statements or transactions, even by
  guessing an ID.
- `GET /api/auth/me` reports the current session (or `401`); `POST
  /api/auth/logout` clears the cookie.

Signed-out visitors land on the **public landing page**
(`frontend/src/pages/LandingPage.jsx`) - hero, what-it-does, supported
banks, privacy, and FAQs - with the Google button as its call to action.
No dashboard route is reachable until that sign-in completes. Keep this
page updated whenever bank support or features change, since its "Supported
banks" and "What it does" sections are meant to describe the app exactly as
it behaves.

### Google Cloud setup (one-time, per environment)

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs &
   Services → OAuth consent screen** → configure (External; add your app
   name/logo; scopes: `email`, `profile`).
2. **Credentials → Create Credentials → OAuth Client ID** → Application
   type: **Web application**.
3. **Authorized JavaScript origins**: add `http://localhost:5173` (dev) and
   your production frontend URL (e.g.
   `https://finance-dashboard-frontend.onrender.com`). No redirect URI is
   needed - the GIS token flow doesn't redirect.
4. Copy the generated **Client ID** into both `GOOGLE_CLIENT_ID` (backend)
   and `VITE_GOOGLE_CLIENT_ID` (frontend) - same value, both places.

## 1. Prerequisites

- Node.js 18+
- Python 3 with `pdfplumber` installed (only needed if you'll upload PDFs):
  ```bash
  pip install pdfplumber --break-system-packages
  ```
- A MongoDB instance - local (`mongod` on `localhost:27017`) or a free
  [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.
- A Google OAuth Client ID (see Google Cloud setup above).

**Backend env vars** (`backend/.env`, copy from `.env.example`):

| Variable            | Required | Notes                                                                 |
|---------------------|----------|------------------------------------------------------------------------|
| `MONGO_URI`         | yes      | Local Mongo or Atlas connection string.                               |
| `PORT`              | no       | Defaults to `5000`.                                                    |
| `PYTHON_BIN`        | no       | Only needed if `python` isn't on your `PATH`, e.g. `python3`.          |
| `NODE_ENV`          | no       | `development` or `production`.                                        |
| `FRONTEND_URL`      | yes      | Comma-separated allowed origins for CORS (must match exactly, no trailing slash). |
| `GOOGLE_CLIENT_ID`  | yes      | From the Google Cloud setup step above.                               |
| `JWT_SECRET`        | yes      | Generate with `openssl rand -base64 32`.                               |
| `COOKIE_DOMAIN`     | no       | Only if sharing the cookie across subdomains of one parent domain.     |

**Frontend env vars** (`frontend/.env`, copy from `.env.example`):

| Variable                | Required | Notes                                              |
|--------------------------|----------|------------------------------------------------------|
| `VITE_API_BASE`          | no       | Defaults to `/api`; set to the deployed API URL in production. |
| `VITE_GOOGLE_CLIENT_ID`  | yes      | Same value as the backend's `GOOGLE_CLIENT_ID`.     |

## 2. Run the backend

```bash
cd backend
npm install
cp .env.example .env      # fill in GOOGLE_CLIENT_ID, JWT_SECRET, and MONGO_URI/PYTHON_BIN if needed
npm run dev                # http://localhost:5000
```

## 3. Run the frontend

```bash
cd frontend
npm install
cp .env.example .env       # fill in VITE_GOOGLE_CLIENT_ID
npm run dev                 # http://localhost:5173, proxies /api -> :5000
```

Open the printed URL. You'll land on the public landing page - sign in with
Google, and the upload flow appears automatically.

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
   `utils/money.js`) - this is what makes exact reconciliation possible.
   A blank withdrawal/deposit cell is `null` ("no value"), never `0`.
4. **Reconcile every row.** Each row's stated balance is checked against
   `previousBalance ± thisTransactionAmount`. If it doesn't match, the row
   is flagged `reconciled: false` and logged to `parseErrors` - and is then
   **excluded from every metric** (see step 6), because an unverified amount
   shouldn't silently count toward your totals. On your actual statement,
   this caught one real row where the bank recorded a negative value in the
   Deposits column that breaks the running balance - it's excluded from
   totals and flagged in the UI rather than silently miscounted.
5. **Categorize.** `categorizer.js` runs an ordered, extendable rules array
   against each row's remarks (ATM, UPI, NEFT, salary, rent, etc.), and
   extracts a best-effort merchant/payee name. If you manually correct a
   category in the transaction table, that correction is saved as a
   `CategoryOverride` keyed by a normalized version of the remarks - so the
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
the checkmark. That single correction is remembered - re-uploading the same
statement, or seeing the same remark in a future statement, applies it
automatically.

## 6. Deleting your data

Every statement in the switcher dropdown has a delete icon - it removes the
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
  not NLP - good enough for "Top Merchants" but won't be perfect on every
  bank's remarks format.
- Auth is Google-only - there's no account-recovery flow to build, since
  there's no password to lose in the first place. Each Google account's
  data (statements, transactions, parse errors, category corrections) is
  fully isolated from every other account's; see the Authentication
  section above.

## 9. Production build

```bash
cd frontend && npm run build   # outputs to frontend/dist/
```
Serve `frontend/dist/` behind any static host, and set `VITE_API_BASE` at
build time to point at your deployed API.

## 10. Deploying to Render

Deploy as **two separate Render services** - a web service for the backend,
a static site for the frontend:

1. **Backend (Web Service)**
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables: `MONGO_URI`, `PORT` (Render sets this
     automatically), `PYTHON_BIN`, `NODE_ENV=production`, `FRONTEND_URL`
     (your deployed static site URL, e.g.
     `https://finance-dashboard-frontend.onrender.com`), `GOOGLE_CLIENT_ID`,
     `JWT_SECRET`, and `COOKIE_DOMAIN` if you're using one.
   - If you'll accept PDF uploads, add a build step (or a `render-build.sh`)
     that installs `pdfplumber` for the Python runtime Render provisions.

2. **Frontend (Static Site)**
   - Root directory: `frontend`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
   - Environment variables: `VITE_API_BASE` (your backend service's URL,
     e.g. `https://finance-dashboard-backend.onrender.com/api`) and
     `VITE_GOOGLE_CLIENT_ID`.

3. Add **both** URLs to the OAuth Client's **Authorized JavaScript origins**
   in Google Cloud Console (see the Google Cloud setup section above).

4. The session cookie is set with `SameSite=None; Secure`, which is required
   because the frontend and backend are different origins - this only works
   over HTTPS. Render serves both services over HTTPS by default, so no
   action is needed here; just don't override it with a custom HTTP-only
   domain.