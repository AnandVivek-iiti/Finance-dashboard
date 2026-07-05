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
│   │   ├── sbi.js           #   State Bank of India profile
│   │   ├── generic.js       #   Fallback for other banks
│   │   └── index.js         #   Tries each profile, first match wins
│   ├── parsers/
│   │   ├── xlsParser.js      # .xls/.xlsx -> raw 2D row array (SheetJS + msoffcrypto for passwords)
│   │   ├── pdfParser.js      # .pdf -> raw 2D row array (pdfplumber; falls back to OCR if no text/tables found)
│   │   ├── tableParser.js    # raw rows -> normalized transactions (the core engine)
│   │   ├── categorizer.js    # rule-based categorization + merchant extraction
│   │   ├── dateParser.js     # multi-format date parsing
│   │   └── pythonRuntime.js  # resolves which `python`/`python3` binary to shell out to
│   ├── scripts/
│   │   ├── pdf_extract.py       # pdfplumber table extractor, called via child_process
│   │   ├── decrypt_office.py    # checks/decrypts password-protected .xls/.xlsx via msoffcrypto-tool
│   │   └── requirements.txt     # pdfplumber + msoffcrypto-tool, installed via pip
│   ├── services/
│   │   ├── metricsEngine.js     # computes every dashboard metric from transactions
│   │   └── groqOcrService.js  # OCR fallback for scanned/image-only PDFs (poppler + Groq API)
│   ├── models/                # Statement, Transaction, ParseError, CategoryOverride, User
│   ├── middleware/
│   │   ├── requireAuth.js         # session cookie -> req.userId, else 401
│   │   ├── errorHandler.js        # sanitizes all errors before they reach the client (see below)
│   │   ├── validateFileSignature.js  # checks uploaded file's magic bytes match its extension
│   │   └── security.js            # helmet, rate limiting, HPP, mongo-sanitize, XHR-header CSRF guard
│   ├── controllers/, routes/
│   └── server.js
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
- **Groq OCR fallback** (`services/groqOcrService.js`) for scanned or
  image-only PDF statements that have no selectable text/table at all: each
  page is rasterized to a PNG with poppler's `pdftoppm`, then sent to a
  Groq vision model to extract the same row shape the text-based parser
  produces. This only runs when pdfplumber genuinely finds nothing - a
  normal text-based PDF never touches it, and it's fully optional (disabled
  if `GROQ_API_KEY` isn't set; the upload is then rejected with a clear
  message instead of silently failing).
- **Security middleware** (`middleware/security.js`): Helmet for standard
  HTTP security headers, `express-rate-limit` (separate, tighter limits on
  auth and upload endpoints than general API traffic), `express-mongo-sanitize`
  against NoSQL injection, `hpp` against HTTP parameter pollution, and a
  custom `X-Requested-With` header check as a lightweight CSRF guard on the
  cookie-based session (see the comment in `security.js` for why a full CSRF
  token library isn't needed here).
- **Centralized error sanitization** (`middleware/errorHandler.js`): every
  route is wrapped in `asyncHandler`, so any thrown/rejected error - a bad
  `:id` param, a DB hiccup, an unexpected bug - ends up here. Only errors
  explicitly marked as safe/crafted for the user (bad password, unsupported
  file type, missing OCR config, etc.) are ever sent to the client as-is;
  everything else is logged in full (message + stack) to the server console
  and the client gets a generic "something went wrong" message instead, so
  internal details (stack traces, DB errors, file paths, model/field names)
  never leak to the browser.

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
- Python 3 with the parsing dependencies installed (only needed if you'll
  upload `.pdf` or password-protected `.xls`/`.xlsx` files):
  ```bash
  pip install -r backend/scripts/requirements.txt --break-system-packages
  ```
  (installs `pdfplumber` for PDF table extraction and `msoffcrypto-tool` for
  decrypting password-protected Excel files.)
- **poppler-utils** (only needed for scanned/image-only PDFs, which go
  through the OCR fallback): provides the `pdftoppm` binary used to
  rasterize pages before sending them to Groq.
  ```bash
  sudo apt-get install poppler-utils   # Debian/Ubuntu
  brew install poppler                 # macOS
  ```
- A MongoDB instance - local (`mongod` on `localhost:27017`) or a free
  [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.
- A Google OAuth Client ID (see Google Cloud setup above).
- (Optional) A **Groq API key** if you want OCR support for scanned PDF
  statements - get one from [Groq Console](https://console.groq.com/keys).
  Without it, a scanned PDF upload is rejected with a clear message rather
  than silently failing; text-based PDFs and Excel files work fine without it.
  A `429` from Groq is retried automatically with a wait (parsed from Groq's
  own "try again in Xs" message) rather than failing the upload outright.
  Multiple `GROQ_API_KEY` values only help against rate limits if they
  belong to *different* Groq orgs/projects - keys in the same org/project
  share one tokens-per-minute budget, so rotating between them doesn't
  bypass a 429.

**Backend env vars** (`backend/.env`, copy from `.env.example`):

| Variable            | Required | Notes                                                                 |
|---------------------|----------|------------------------------------------------------------------------|
| `MONGO_URI`         | yes      | Local Mongo or Atlas connection string.                               |
| `PORT`              | no       | Defaults to `5000`.                                                    |
| `PYTHON_BIN`        | no       | Only needed if `python` isn't on your `PATH`, e.g. `python3`.          |
| `NODE_ENV`          | no       | `development` or `production`.                                        |
| `FRONTEND_URL`      | yes      | Comma-separated allowed origins for CORS (must match exactly, no trailing slash). |
| `GOOGLE_CLIENT_ID`  | yes      | From the Google Cloud setup step above.                               |
| `GROQ_API_KEY`      | no       | Enables OCR (scanned/image-only PDFs) and the AI table-remapping fallback for unrecognized bank formats. Accepts a single key or a comma-separated list for rotation across rate limits. Omit to disable both (other uploads are unaffected). |
| `GROQ_OCR_MODEL`    | no       | Defaults to `qwen/qwen3.6-27b` (one of Groq's two current vision-capable models). Override if Groq's lineup changes. |
| `GROQ_FALLBACK_MODEL` | no     | Defaults to `openai/gpt-oss-120b` (text-only, no vision needed for this step). Override to use a different Groq model for the unrecognized-header table remap. |
| `GROQ_OCR_MAX_TOKENS` | no    | Defaults to `4000`. Lower this if you hit a 413 "tokens per minute" error on a free/on_demand Groq tier. |
| `GROQ_FALLBACK_MAX_TOKENS` | no | Defaults to `3000`. Same purpose as above, for the table-remapping fallback. |
| `GROQ_FALLBACK_ROWS_PER_CHUNK` | no | Defaults to `40`. Rows are sent to the AI fallback in batches of this size (rather than all at once) so large statements stay under a low TPM cap. If a chunk still exceeds `GROQ_FALLBACK_MAX_TOKENS` mid-response (e.g. unusually long remarks), it's automatically split in half and retried rather than failing the whole upload. |
| `GROQ_FALLBACK_CHUNK_DELAY_MS` | no | Defaults to `500`. Pause between chunk requests to the AI fallback, skipped before the first chunk. |
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

1. **Read raw rows.** `.xls`/`.xlsx` via SheetJS (password-protected files
   are decrypted first via `msoffcrypto-tool`); `.pdf` via the pdfplumber
   Python helper. Both produce the same shape: a plain 2D array of cells.
   If a PDF has no selectable text/table at all (a scanned/image-only
   statement), it automatically falls back to the Groq OCR service
   (`services/groqOcrService.js`) instead of being rejected - each page is
   rasterized and read by a Groq vision model, producing the same row shape.
   This step is skipped entirely, with no behavior change, if `GROQ_API_KEY`
   isn't set.
2. **Detect the bank & find the header row.** `bankProfiles/index.js` tries
   each profile's header-matching rules against the raw rows. Canara Bank
   and SBI exports are matched by `canara.js`/`sbi.js` (the Canara profile
   even tolerates the bank's own "Trasnaction ID" typo). Unrecognized
   layouts fall back to `generic.js`; if nothing matches at all, the upload
   is rejected with a clear message instead of guessing a column layout.
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

- Scanned/image-only PDF statements are handled via the Groq OCR fallback,
  but that requires `GROQ_API_KEY` to be set (see Prerequisites); without
  it, such a PDF is rejected with a clear message rather than misread. OCR
  accuracy also depends on scan quality - each response includes a
  confidence score, and low-confidence pages are still worth spot-checking
  against the original statement.
- Bank profiles currently cover Canara Bank and SBI, with a `generic.js`
  fallback for other layouts (see "Adding support for another bank" below).
- Merchant-name extraction is rule-based pattern matching on remarks text,
  not NLP - good enough for "Top Merchants" but won't be perfect on every
  bank's remarks format.
- Auth is Google-only - there's no account-recovery flow to build, since
  there's no password to lose in the first place. Each Google account's
  data (statements, transactions, parse errors, category corrections) is
  fully isolated from every other account's; see the Authentication
  section above.

## 9. Error handling & logging

The API never sends internal error details (stack traces, DB errors, raw
subprocess output) to the browser - see `middleware/errorHandler.js`. If
something goes wrong:

- The **full error** (message + stack) is always logged to the backend's
  console/server logs, tagged with the request method and URL.
- The **client** only ever gets one of: a crafted, actionable message for
  errors we expect (wrong password, unsupported file type, malformed ID,
  OCR not configured, etc.), or a generic "Something went wrong on our end"
  message for anything unexpected.
- When debugging a failed upload or request, check the backend's console
  output (or `npm run dev`'s terminal) rather than the browser - that's
  where the real error always is.

## 10. Running tests

```bash
cd backend
npm test              # vitest run - single run
npm run test:watch    # vitest, re-runs on file changes
npm run test:coverage # vitest run --coverage
```

## 11. Production build

```bash
cd frontend && npm run build   # outputs to frontend/dist/
```
Serve `frontend/dist/` behind any static host, and set `VITE_API_BASE` at
build time to point at your deployed API.

## 12. Deploying to Render

Deploy as **two separate Render services** - a web service for the backend,
a static site for the frontend:

1. **Backend (Web Service)** - see `render.yaml` for the exact config this
   project ships with (Render's "Blueprint" deploy can apply it directly).
   - Root directory: `backend`
   - Build command: `apt-get update && apt-get install -y poppler-utils && npm install && pip install -r scripts/requirements.txt --break-system-packages`
     (poppler-utils is only needed for the OCR fallback; the pip install
     covers both `pdfplumber` and `msoffcrypto-tool`).
   - Start command: `npm start`
   - Health check path: `/`
   - Environment variables: `MONGO_URI`, `PORT` (Render sets this
     automatically), `PYTHON_BIN=python`, `NODE_ENV=production`,
     `FRONTEND_URL` (your deployed static site URL, e.g.
     `https://finance-dashboard-frontend.onrender.com`), `GOOGLE_CLIENT_ID`,
     `GROQ_API_KEY` (optional - for scanned-PDF OCR and the unrecognized-format AI fallback), `JWT_SECRET`,
     and `COOKIE_DOMAIN` if you're using one.

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