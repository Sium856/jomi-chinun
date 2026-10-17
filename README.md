# 🏡 জমি চিনুন

১ মিনিটে জমির ঝুঁকি যাচাই (Check land risk in 1 minute). Bilingual: English / বাংলা.

A production-grade full-stack web application designed for Bangladesh land buyers to quickly verify land ownership risks, inspect official survey and plot features, check road authorities and setback building limits, and manage land records through a secure administration dashboard.

---

## 🚀 Quick Start & Run

### 1. Installation
```bash
npm install
```

### 2. Run the Application
```bash
npm start
```
The SQLite database creates its tables and seeds initial demo records automatically on first run. Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🔑 Demo Credentials (Shown on Login Page)

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@demo.com` | `admin123` |
| **User** | `252-15-856@diu.edu.bd` | `land123` |

*Passwords are securely hashed using bcrypt (salt rounds = 10).*

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite using Node.js built-in `node:sqlite` (DatabaseSync) — zero external build dependencies or C++ compilation issues.
- **Sessions**: `express-session` with a custom SQLite session store (`sessions` table), `httpOnly: true`, `sameSite: 'lax'`, `secure: true` in production.
- **Authentication & Security**:
  - `bcryptjs` password hashing (salt 10).
  - Role-based server-side middleware (`requireAuth`, `requireAdmin`).
  - `helmet` security headers.
  - `express-rate-limit` (brute-force protection on authentication and password reset routes).
  - Strictly parameterized SQL queries preventing SQL injection.
  - Bengali-to-English digit normalization and strict numerical dag/khatian validation.
  - Sensitive tables (full land records, plots, and rules) are restricted from normal users.
- **Frontend**: Vanilla HTML5, CSS3, and JavaScript served from `/public`, preserving the clean responsive UI, English/Bangla language toggle, and "Why this result?" breakdown.

---

## 📁 File Structure

```
├── .env.example                     # Environment variables template
├── .gitignore                       # Git ignore (.env, node_modules, *.db)
├── database/
│   └── land_features_seed.sql       # SQLite schema and idempotent 20+20 seed data
├── index.html                       # Root HTML synced with brand title and meta
├── metadata.json                    # Project configuration and capabilities
├── package.json                     # Project manifest (jomi-chinun)
├── public/
│   ├── app.js                       # Frontend vanilla logic & API client (SRC)
│   ├── index.html                   # HTML entry point (জমি চিনুন)
│   └── style.css                    # Responsive stylesheet
├── server.ts                        # Express server entry point and REST APIs
├── src/
│   ├── auth.ts                      # Authentication & RBAC middleware (requireAuth, requireAdmin)
│   ├── db.ts                        # SQLite database init & idempotent seeding
│   ├── rules.ts                     # 5-rule engine & setback rule evaluator
│   └── session-store.ts             # Custom SQLite session store
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # Documentation
```

---

## 🌐 API Endpoints

### Public & Authentication (`/api/auth/*`)
- `POST /api/auth/register` — Create new user account with hashed password and session.
- `POST /api/auth/login` — Authenticate credentials, set session cookie.
- `POST /api/auth/logout` — Destroy session and clear cookie.
- `GET /api/auth/me` — Return current authenticated user profile (`id`, `name`, `email`, `role`).
- `POST /api/auth/forgot` — Request 6-digit password reset code (returns code in demo mode).
- `POST /api/auth/reset` — Verify code (max 5 attempts, 10-minute expiry) and update password.

### Land Verification & Plots
- `POST /api/check` — Execute 5-rule risk engine, generate and save report to database.
- `GET /api/reports` — Retrieve current user's report history.
- `GET /api/reports/:id` — Retrieve specific report (users see only their own; admins see all).
- `GET /api/plots/options` — Get division/district/upazila names for dropdown menus.
- `GET /api/plots/search` — Search plots with server-evaluated setback guidance.
- `GET /api/setback` — Check road authority, width, and setback guidance for a plot.

### Administrator Only (`/api/admin/*`)
- `GET /api/admin/stats` — Summary metrics (users, lands, reports, risk count, plots, rules, status distribution).
- `GET /api/admin/reports` — View all users' generated verification reports.
- `GET /api/admin/lands` | `POST` | `PUT /:id` | `DELETE /:id` — Land records CRUD.
- `GET /api/admin/plots` | `POST` | `PUT /:id` | `DELETE /:id` — Plots and roads CRUD.
- `GET /api/admin/rules` | `POST` | `PUT /:id` | `DELETE /:id` — Setback rules CRUD.

---

## ☁️ Deployment Guide (Render)

### Deploying to Render.com:
1. **Repository**: Push the code to GitHub or GitLab.
2. **Service Type**: Create a **Web Service** on Render.
3. **Build Command**:
   ```bash
   npm install
   ```
4. **Start Command**:
   ```bash
   npm start
   ```
5. **Environment Variables**:
   - `PORT`: `3000` (or leave default, Render sets `PORT`)
   - `NODE_ENV`: `production`
   - `SESSION_SECRET`: Set a secure 64-character random string.
   - `DEMO_MODE`: `true` (or `false` for live production).
   - `DATABASE_PATH`: `/var/data/jomi_chinun.db` (when using a Persistent Disk).
6. **Persistent Disk (Recommended on Render)**:
   - Add a Persistent Disk mounted at `/var/data` (size: 1 GB).
   - Set `DATABASE_PATH=/var/data/jomi_chinun.db`.
   - *If running without a persistent disk on Render free tier, the database file will re-create and seed itself on each container restart.*

### ⚠️ Note on Vercel:
**Vercel is NOT suitable for this application**. Vercel runs stateless serverless functions with a read-only, ephemeral file system. SQLite requires a writable local disk for ACID transactions, WAL mode, and session persistence. Use Render, Railway, Fly.io, or Google Cloud Run with persistent storage instead.

---

## 📝 List of Changes Made to Original app.js

1. **Brand Rename**: Updated all titles, hero headings, and navigation bars from `"Land Buy Checker"` to `"জমি চিনুন"` across both English and Bangla modes.
2. **State & Storage Migration**: Removed local `localStorage.getItem("lbc3")` for app data, user records, and land records. Only the user's language preference (`jomi_lang`) remains in client storage.
3. **API Client Layer (SRC)**: Transformed `SRC` into the single gateway making authenticated `fetch()` calls with `credentials: "same-origin"` to `/api/*`.
4. **Authentication Flow**:
   - `login()` and `reg()` now call `POST /api/auth/login` and `POST /api/auth/register`.
   - `logout()` calls `POST /api/auth/logout`.
   - `init()` queries `GET /api/auth/me` on initial load to maintain persistent sessions across page reloads.
   - `forgot()` and `resetPw()` call backend endpoints with 10-minute expiry and attempt tracking.
5. **Server-Side 5-Rule Engine**: Replaced client-side calculation in `run()` with `POST /api/check`. The server evaluates the rules, computes weights (35/15/40/30/30), determines status, and returns the snapshot.
6. **Server-Side Setback Evaluation**: Setback guidance is computed on the server based on matched road authority and width. The client receives the calculated guidance (`p.guidance`), ensuring normal users cannot dump the internal rules table.
7. **Admin Operations**:
   - Dashboard stats in `dash` tab load via `GET /api/admin/stats`.
   - Land record management (`saveLand`, `delLand`) dispatches REST requests to `/api/admin/lands`.
   - Plot and setback rule management (`plotsAdmin`, `rulesAdmin`) dispatch REST requests to `/api/admin/plots` and `/api/admin/rules`.
8. **Network Error Handling**: Added user-friendly network error notifications for failed requests in both English and Bangla.
