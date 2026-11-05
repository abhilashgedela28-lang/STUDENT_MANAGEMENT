# CodeTrack 🚀

**CodeTrack** is a full-stack developer progress and problem-solving tracker built on the **MERN stack** (MongoDB, Express, React, Node.js). It enables competitive programmers and software engineers to sync solved problems from **LeetCode** and **Codeforces**, verify account ownership using temporary cryptographic challenge codes, practice curated problems with live status synchronization, and monitor progress via interactive Chart.js analytics.

---

## 🛠 Tech Stack

- **Backend**: Node.js 20+, Express 4.x, Mongoose 8.x
- **Frontend**: React 18, Vite 6, Chart.js / `react-chartjs-2`, Lucide Icons, Modern Responsive CSS
- **Database**: MongoDB (Atlas Cloud Cluster or local MongoDB instance)
- **Security & Auth**: BCrypt password hashing, JWT session authentication, HTTP-only cookie support, Helmet security headers, Express-validator
- **External Connectors**:
  - **LeetCode**: GraphQL client (`https://leetcode.com/graphql`) with browser headers and typed error mapping
  - **Codeforces**: Official REST API (`https://codeforces.com/api/`) with global rate limiting (2.1s spacing)
- **Rate Limiting & Caching**:
  - In-memory 90-second submission cache (`node-cache`)
  - Outgoing API throttle (`bottleneck`): Codeforces ≥ 2.1s, LeetCode ≥ 1.0s
  - 45-second per-user sync cooldown with live countdown timer
  - 50 syncs per-user daily quota
  - In-memory lock preventing concurrent double-click sync races
- **Automation & Scheduling**: `node-cron` scheduled batch snapshot jobs (configurable cron, default `0 2 * * *`)
- **Testing**: End-to-end integration test suite and isolated platform connectors unit test suite

---

## 📋 Features

### 1. Authentication & Role-Based Access Control
- Sign up with name, email, and password (BCrypt hashed).
- Form-based login with JWT session tokens and cookie support.
- Two user roles: `USER` and `ADMIN`.
- Protected `/api/admin/*` and `/admin` routes require the `ADMIN` role.
- **Admin Seeding**: On initial startup, if no admin exists, CodeTrack automatically seeds an administrator account from `ADMIN_EMAIL` and `ADMIN_PASSWORD` defined in `.env`.
- Data isolation: Every user views only their own data.

### 2. Profile Linking with Ownership Verification (`/profile`)
- Supports linking **LeetCode** and **Codeforces** accounts.
- **Pre-check**: Verifies that the entered handle actually exists on the external platform before issuing a challenge.
- **Verification Code**: Generates a random cryptographic verification code (e.g., `CT-7F3K9Q`) stored in MongoDB with a 30-minute expiry.
- **Challenge Placement**:
  - **LeetCode**: User pastes the code into their profile "Summary" (`aboutMe`) or "Real Name" field.
  - **Codeforces**: User pastes the code into their profile "Organization", "First name", or "City" field.
- **Verify Action**: CodeTrack fetches the public profile and confirms the code appears before marking `verified: true`.
- **Anti-Claiming Constraint**: A username already verified by another user cannot be claimed by anyone else.
- Unverified accounts cannot sync or alter problem statuses.
- Supports unlinking and relinking.

### 3. Practice Section & One-Click Sync (`/practice`)
- 20 pre-seeded starter problems (10 LeetCode, 10 Codeforces) across various difficulties (Easy, Medium, Hard) and topics.
- Filters by platform, difficulty, topic tag, status (`Unsolved`, `Started`, `Solved`), and search query.
- **Solve Button**: Opens the canonical problem URL on LeetCode/Codeforces in a new tab (`target="_blank" rel="noopener noreferrer"`) and records a `STARTED` status with timestamp.
- **Sync Button (Per-Problem & Sync All)**:
  - Fetches the user's external accepted submissions once and evaluates all pending problems against it.
  - Any accepted submission ever found counts as solved.
  - Transitions status to `SOLVED` and records the exact solved timestamp.

### 4. Sync Rate Limiting & Protection
- **Cooldown**: 45 seconds between sync requests per user. Returns HTTP 429 with remaining seconds; the UI shows a live countdown and disables the sync button.
- **Daily Quota**: 50 sync requests per user per day.
- **Single-Fetch Rule**: One network fetch per platform per sync request; never makes one external HTTP call per problem.
- **90-Second Cache**: External submission responses are cached in memory for 90 seconds to prevent hitting external sites on rapid button clicks.
- **Outgoing Throttling**: Bottleneck limiter enforces at least 2.1 seconds between consecutive Codeforces calls application-wide and 1.0 second between LeetCode calls.

### 5. Interactive Dashboard & Analytics (`/dashboard`)
- Status badges for linked and verified accounts.
- Metrics summary: Total solved, Easy / Medium / Hard breakdown, current daily streak, longest streak, contest ratings, and last synced timestamp.
- **Visualizations (Chart.js)**:
  1. Cumulative problems solved over time (from snapshots).
  2. Contest rating progression (from Codeforces contest rating history).
  3. Difficulty breakdown doughnut chart.
  4. Codeforces topic strengths and weaknesses bar chart.
  5. 365-day activity chart.

### 6. Admin Control Panel (`/admin`)
- **Add by URL**: Paste a LeetCode or Codeforces URL. Automatically parses external IDs (`two-sum`, `4A`), auto-fetches title, difficulty, and topics, allows manual review/edit, and saves.
- **Bulk Add**: Textarea supporting one URL per line with a detailed result report (Added, Duplicate, Failed).
- **Duplicate Prevention**: Unique index on `(platform, externalId)` strictly prevents duplicate problems.
- **Problem Management**: Search, edit metadata, activate/deactivate, and delete problems.
- **User Directory**: View registered users, roles, linked accounts, and verification statuses.
- **Manual Snapshot Trigger**: Trigger the batch snapshot job on demand.

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (see `.env.example`):

```ini
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/codetrack?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key_here
ADMIN_EMAIL=admin@codetrack.dev
ADMIN_PASSWORD=your_admin_secure_password
NODE_ENV=development
SYNC_COOLDOWN_SECONDS=45
SYNC_DAILY_CAP=50
SNAPSHOT_CRON="0 2 * * *"
```

---

## 🚀 Running Locally

### 1. Prerequisites
- **Node.js**: v18+ (v20+ or v24 recommended)
- **npm**: v9+
- A running **MongoDB** database (e.g. MongoDB Atlas connection string or local MongoDB)

### 2. Installation
Run from the root directory:
```bash
# Install dependencies for both server and client
npm run install:all
```

### 3. Build Client & Start App (Single Command)
```bash
# Build React client bundle
npm run build

# Start the full-stack server (serves API + React frontend)
npm start
```
The application will be live at **http://localhost:5000**!

### 4. Running in Development Mode (Hot Reload)
To run backend and frontend with live reloading:
```bash
# Terminal 1: Backend API
npm run server

# Terminal 2: React Vite Client
npm run client
```
The frontend dev server runs at **http://localhost:3000** (with automatic `/api` proxying to `http://localhost:5000`).

---

## 🐳 Running with Docker

Run the entire stack (including local MongoDB) with Docker Compose:
```bash
docker compose up -d --build
```
Access the application at **http://localhost:5000**.

---

## 🧪 Testing

CodeTrack includes a comprehensive automated test suite testing platform connectors, rate limits, verification challenge flows, and end-to-end syncs:

```bash
# Run both Connector Unit Tests and End-to-End System Tests
npm test
```

### Test Suite Results:
- **Platform Connectors**: 9 Passed, 0 Failed
  - Codeforces user existence, profile verification fields, accepted submissions, problem metadata
  - LeetCode question metadata GraphQL query, user existence, 404 handling
- **End-to-End Flow**: 48 Passed, 0 Failed
  - `/actuator/health` check
  - User sign up & role validation
  - Admin login & 403 Forbidden verification
  - URL parsing & duplicate problem 409 rejection
  - 20 starter problems listing
  - Solve button state transition to `STARTED`
  - Profile linking, 30-min code generation (`CT-XXXXXX`), unverified sync block
  - Ownership verification via `/api/profile/verify`
  - Synchronized submission matching & transition to `SOLVED`
  - 45-second sync cooldown with live HTTP 429 countdown
  - Dashboard analytics & chart generation
  - Admin user directory & manual snapshot execution

---

## ☁️ Deployment Guide

CodeTrack is configured for zero-friction production deployment with multiple options:

### Option 1: Full-Stack Deployment on Render (Recommended)
CodeTrack includes a pre-configured `render.yaml` Blueprint:
1. Push your repository to GitHub or GitLab.
2. Go to [Render Dashboard](https://dashboard.render.com/) -> **New** -> **Blueprint**.
3. Connect your repository. Render automatically reads `render.yaml`, configures the build and health checks.
4. Fill in secret environment variables (`MONGODB_URI`, `ADMIN_PASSWORD`).
5. Click **Apply**. Render will run:
   - **Build Command**: `npm run build` (installs both packages and builds client assets)
   - **Start Command**: `npm start` (starts the Express server serving API + React app)
   - **Health Check Path**: `/actuator/health`

### Option 2: Full-Stack Deployment on Railway
1. Go to [Railway](https://railway.app/) and create a **New Project** from GitHub repo.
2. Add your environment variables (`MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NODE_ENV=production`).
3. Railway automatically detects the root `package.json` (`npm run build` + `npm start`) or the `Dockerfile`.
4. Deploy!

### Option 3: Docker Container Deployment
CodeTrack has a production-hardened multi-stage `Dockerfile` with non-root security and actuator healthchecks:
```bash
# Build the production image
docker build -t codetrack:latest .

# Run the container
docker run -d \
  -p 5000:5000 \
  -e MONGODB_URI="mongodb+srv://..." \
  -e JWT_SECRET="your_jwt_secret" \
  -e ADMIN_EMAIL="admin@codetrack.dev" \
  -e ADMIN_PASSWORD="AdminSecurePassword123" \
  -e NODE_ENV="production" \
  --name codetrack \
  codetrack:latest
```

### Option 4: Split Deployment (Vercel Frontend + Render/Railway Backend)
- **Backend**:
  - Deploy `/server` on Render/Railway.
  - Set `ALLOWED_ORIGINS=https://your-frontend.vercel.app`.
- **Frontend**:
  - Deploy repository on [Vercel](https://vercel.com/) with **Root Directory** set to `client` or root.
  - Set Environment Variable: `VITE_API_BASE_URL=https://your-backend.onrender.com/api`.
  - Client includes `client/vercel.json` for seamless client-side SPA routing.

---

## ⚠️ Known Notes & Platform Limits

1. **LeetCode Unofficial API**:
   - LeetCode does not provide an official public REST API. CodeTrack queries LeetCode's public GraphQL endpoint (`https://leetcode.com/graphql`) using browser headers (`Referer`, `User-Agent`).
   - LeetCode only exposes the latest ~20 accepted submissions publicly via GraphQL. If a user solved a problem long ago, CodeTrack notifies the user to re-submit or touch the problem on LeetCode before syncing.
2. **Codeforces API**:
   - Codeforces enforces an official rate limit of 5 requests per second per IP. CodeTrack's global `bottleneck` limiter spaces all Codeforces calls by at least 2.1 seconds to guarantee that CodeTrack never gets rate limited.
