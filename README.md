# PriceWise

PriceWise is a static e-commerce comparison front end with modular product, filter, sort, and detail/comparison views. This project now includes a backend-ready architecture for real external product data integration.

## Architecture

- Frontend: Vanilla JavaScript, HTML, CSS
- Public data: `public/data/*.json`
- Runtime modules: `public/js/*.js`
- API-ready backend: `server/`

## Product import model

Pasting a real Amazon India or Flipkart product URL into either search bar
imports live product data through the backend:

Browser → `POST /api/products/import` → `ProductService` →
`AmazonProvider` / `FlipkartProvider` → `ExternalProductApiClient` →
DataBlue → normalized product → frontend details page.

### Supported URL flows

- Amazon India product URLs
- Flipkart product URLs

### Live vs mock behavior

- When `PRODUCT_DATA_API_KEY` is configured, supported URLs return live
  data labeled with `sourceType: "live"` and a fetch date
  ("Live data · fetched …") on the details page.
- When the key is absent (tests, offline development), the same providers
  return the long-standing demo data labeled `sourceType: "mock"`.
  Mock data is never labeled live.
- Supported URLs are validated client-side before import
- Import requests always go through the backend `ProductDataService` API provider
- No Amazon or Flipkart scraping is performed in frontend JavaScript
- No product-data API key ever reaches the browser

## Local demo product links

PriceWise also supports local catalog links in the format:

`https://pricewise.local/product/<product-slug>`

Pasting one of these URLs into either search bar opens the matching local product details page. They are only identifiers for the bundled demo catalog; they do not query an external provider. Search priority is empty input, a PriceWise local link, a supported Amazon/Flipkart URL (mock/provider flow), then normal local text search. Unknown or malformed local links show a friendly validation message.

The five verified demo links are:

- `https://pricewise.local/product/galaxy-s24-ultra`
- `https://pricewise.local/product/iphone-15-pro-max`
- `https://pricewise.local/product/oneplus-12`
- `https://pricewise.local/product/sony-wh-1000xm5`
- `https://pricewise.local/product/macbook-air-m3`

Product records live in `public/data/products.json`; supplied images are in `public/images/products/`. Products without a supplied JPG/PNG deliberately use `public/images/placeholders/product-placeholder.svg`. To add a sixth product, add a unique `id` and URL-safe `slug`, the product fields and one or more numeric offers to the JSON, then use the generated `https://pricewise.local/product/<slug>` link. The product details page includes **Copy Product Link**; it reports gracefully if the browser blocks clipboard access.

## API contract

POST `/api/products/import`

Request:

```json
{
  "url": "https://www.amazon.in/dp/B09X3P5QK5"
}
```

Success:

```json
{
  "success": true,
  "product": {
    "id": "external-amazon-B09X3P5QK5",
    "source": "amazon",
    "sourceType": "mock",
    "externalId": "B09X3P5QK5",
    "url": "https://www.amazon.in/dp/B09X3P5QK5",
    "name": "Demo Amazon Product",
    "description": "This is development/mock data.",
    "image": "images/placeholders/product-placeholder.svg",
    "brand": "Amazon",
    "category": "electronics",
    "rating": 4.6,
    "reviewCount": 1284,
    "availability": "Demo data",
    "currency": "INR",
    "offers": [
      {
        "storeId": "amazon",
        "storeName": "Amazon",
        "price": 29999,
        "currency": "INR",
        "url": "https://www.amazon.in/dp/B09X3P5QK5",
        "availability": "Demo data",
        "lastUpdated": "2026-08-17T00:00:00.000Z"
      }
    ],
    "fetchedAt": "2026-08-17T00:00:00.000Z"
  }
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_NOT_CONFIGURED",
    "message": "No authorized provider is configured for this store."
  }
}
```

### Price intelligence endpoints

Every successful **live** import (`sourceType: "live"`) also stores a price
snapshot in MongoDB. Mock, failed, or malformed imports never create
snapshots. Snapshots record only public listing data (store, product id,
name, price, MRP, discount, URL, availability, capture time) — never user
or credential data.

GET `/api/products/history/:store/:externalProductId?days=30`

- `:store` is `amazon` or `flipkart`; `:externalProductId` is the ASIN/PID.
- `days` is clamped to 1–90 (default 30).
- Returns current reading, lowest/highest/average price with dates,
  data-point count, and the snapshot series. With no history it returns
  `dataAvailable: false` instead of invented data.

GET `/api/products/compare?store=amazon&externalProductId=B0…`

- Compares the product against same-product listings from the other store,
  matched conservatively by brand + full variant identity (storage, color,
  and size included, so 256 GB never matches 512 GB).
- Returns per-store entries, the best price, and the price difference — or
  an honest message when only one store (or no store) has data.

Discount math (also used on the details page):

```text
discountAmount = MRP - currentPrice
discountPercent = ((MRP - currentPrice) / MRP) * 100
```

calculated only when both values are valid and MRP > price.

### Price history honesty

Price history is built exclusively from snapshots PriceWise collects at
import time. A newly tracked product shows "Not enough historical data
yet" / "Price history is being collected…" until real observations
accumulate. History is never fabricated and is not automatically available
for products that were never imported.

## Required credentials for production

Add real credentials in a secure environment, not in browser JavaScript.

- `AMAZON_API_KEY` (reserved for a future official Amazon integration)
- `AMAZON_API_SECRET` (reserved for a future official Amazon integration)
- `FLIPKART_API_KEY` (reserved for a future official Flipkart integration)
- `API_BASE_URL`
- `PRODUCT_DATA_API_KEY` — DataBlue Bearer key enabling live Amazon India /
  Flipkart imports (leave unset for mock/offline mode)
- `PRODUCT_DATA_API_BASE_URL` — optional override, defaults to
  `https://api.datablue.dev`

Use `.env` locally and keep it excluded from version control.

### Live product data (DataBlue)

1. Create a free DataBlue account and API key (1,000 one-time signup
   credits, no credit card; credits are consumed per successful lookup).
2. Set `PRODUCT_DATA_API_KEY` in your local `.env` (never commit it).
3. Restart with `node server/server.js`.
4. Paste a real `amazon.in/dp/…` or `flipkart.com/…/p/…` URL into the site
   search. Live products show "Live data · fetched …" with `fetchedAt`;
   quota/auth/outage failures surface as friendly messages, never secrets.

Security warning: the key is sent only as a server-side
`Authorization: Bearer` header with a 20s timeout. It must never appear in
HTML, `public/js/`, localStorage, logs, responses, or commits.

## Run locally

```bash
npm install
node server/server.js
```

The server requires a MongoDB connection string (see Authentication below).
Without `MONGODB_URI` it exits during startup with a clear error.

Then open the app at `http://localhost:3000/` (e.g. `http://localhost:3000/signup.html`).
The Express server serves both the frontend (`public/`) and the `/api/*`
endpoints from this single origin — signup/login pages must be opened here,
not via `file://` or a separate static server, otherwise the relative
`/api/auth/*` requests cannot reach the backend.

## Authentication (Phase 4 — MongoDB)

PriceWise uses real persistent authentication:

Frontend → Express Authentication API → MongoDB Atlas.

MongoDB is the source of truth for user accounts.
localStorage holds only client-side session information.
Passwords are never stored in localStorage.

### Setup

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` to your MongoDB Atlas connection string.
3. Run `npm install` (installs `express`, `mongoose`, `bcryptjs`, `dotenv`).
4. Start the server: `node server/server.js`.

`.env` is git-ignored. Never commit real credentials.
The MongoDB URI is backend-only and is never exposed to frontend code.

### Features

**Signup Page** (`signup.html`)
- Create a new account with full name, email, and password
- Real-time form validation
- Password visibility toggle
- Password strength requirements (minimum 8 characters)
- Duplicate accounts are rejected by the server (HTTP 409)

**Login Page** (`login.html`)
- Login with registered email and password
- Form validation
- Password visibility toggle
- Redirect support (return to requested page after login)

**Session Management**
- Browser localStorage-based client session (`pricewise-session`)
- Login state persists across page refreshes
- Automatic navigation state updates
- Logout clears the session (client-side; no server logout endpoint in Phase 4)

**User Experience**
- Dynamic navigation: "Login" / "Sign Up" links when logged out
- Dynamic navigation: "Welcome, [Name]" / "Logout" when logged in
- Error messages with clear validation feedback
- Success messages on account creation and login

### Test Credentials

After creating an account on the signup page, use those credentials to login:

1. Visit `signup.html`
2. Create an account (e.g., email: demo@example.com, password: Demo12345)
3. Verify success message
4. Visit `login.html`
5. Login with your credentials
6. See "Welcome, [Name]" in the navigation

Note: accounts from the old demo system (plaintext `pricewise-users`
localStorage database) were intentionally not migrated. The legacy key is
removed automatically on startup — please register again.

### Architecture

**Backend** (`server/`)
- `server/db/connection.js` — single shared Mongoose connection (`connectDB()`)
- `server/models/User.js` — User schema (normalized unique email, `passwordHash` with `select: false`, timestamps)
- `server/services/auth-service.js` — signup/login logic, bcryptjs hashing (cost 12)
- `server/routes/auth.js` — thin `POST /signup` and `POST /login` routes

**Authentication Module** (`public/js/auth.js`)

Central authentication module providing:
- API-backed account management (`POST /api/auth/signup`, `POST /api/auth/login`)
- Client session handling
- Form validation (email, password, name)
- Redirect safety validation

Key Functions:
- `Auth.signup(fullName, email, password)` - Create account via API
- `Auth.login(email, password)` - Authenticate via API, store safe session
- `Auth.logout()` - Clear session
- `Auth.isLoggedIn()` - Check login state
- `Auth.getCurrentUser()` - Get session user
- `Auth.requireAuth(redirectPath)` - Enforce authentication on pages
- `Auth.updateNavigationUI()` - Sync nav with auth state

**API contract**

`POST /api/auth/signup` → `201` on success:
```json
{
  "success": true,
  "user": { "id": "...", "fullName": "John Doe", "firstName": "John", "email": "john@example.com" }
}
```
Validation errors → `400`; duplicate email → `409`.

`POST /api/auth/login` → `200` on success (same safe user shape).
Invalid credentials → `401` with the generic message `"Invalid email or password."`

Responses never contain `password` or `passwordHash`.

**Storage Structure**

MongoDB `users` collection (source of truth):
```json
{
  "_id": "ObjectId",
  "fullName": "John Doe",
  "firstName": "John",
  "email": "john@example.com",
  "passwordHash": "$2b$12$...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

Sessions stored in `pricewise-session` (localStorage, client state only):
```json
{
  "userId": "64f...",
  "email": "john@example.com",
  "fullName": "John Doe",
  "firstName": "John",
  "loginTime": "2026-08-29T10:18:30.230Z"
}
```

### Security Notes

- Passwords are hashed with bcryptjs (cost factor 12) before insertion.
- Only `passwordHash` is stored in MongoDB — never plaintext.
- `passwordHash` is `select: false` and is never returned by the API.
- Emails are normalized (trim + lowercase) and unique (app check + MongoDB unique index).
- Login failures always return the generic `"Invalid email or password."`
- Server-side validation is authoritative; client validation is for UX.
- `MONGODB_URI` lives in git-ignored `.env` and never reaches the frontend.
- localStorage holds display-safe session fields only; sessions carrying password material are rejected.
- Remaining demo-scope limitations: no rate limiting, no HTTPS enforcement, no account lockout — add before any production use.

### Testing

Run all tests (unit + API-contract tests use mocks; no live Atlas needed):
```bash
npm test
```

Test coverage includes:
- Email validation
- Password strength validation
- Name validation
- Signup success, validation, and duplicate prevention (incl. MongoDB 11000 mapping)
- Email normalization
- Password hashing (hash stored, plaintext never stored)
- Login (success, wrong password, unknown email, generic error)
- Safe responses (no `password`/`passwordHash`)
- localStorage session creation without password material
- Unsafe-session rejection
- Legacy `pricewise-users` removal
- Logout
- Redirect safety

### Protected Features

Currently, all PriceWise features (browsing, search, filtering, comparison) remain publicly accessible without login. The authentication system is modular and ready to protect specific features:

```javascript
// Example: Require login for a feature
Auth.requireAuth();  // Redirects if not logged in

// Or with redirect after login:
Auth.requireAuth('products.html?search=galaxy');
```
