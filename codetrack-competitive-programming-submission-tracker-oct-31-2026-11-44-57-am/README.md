# CodeTrack - Competitive Programming & Submission Tracker

CodeTrack is a full-stack competitive programming tracking application. It integrates directly with **LeetCode** and **Codeforces** to track problem solving, verify account ownership, sync accepted submissions dynamically, and analyze performance trajectories across contest ratings and difficulty distributions.

---

## 🌟 Key Features

1. **Authentication & Role-Based Access (USER & ADMIN)**
   - Sign up with name, email, password (hashed with BCrypt).
   - Session-based authentication with secure cookies.
   - Initial administrator auto-seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (default: `admin@codetrack.dev` / `Admin@123`).
   - Protected Admin routes (`/admin/**`).
   - Per-user data isolation.

2. **Account Ownership Verification (`/profile`)**
   - User enters their LeetCode username and/or Codeforces handle.
   - Account existence is validated against the platform before continuing.
   - Generates a random cryptographic verification token (e.g. `CT-7F3K9Q`) with a 30-minute expiry.
   - User pastes the code into their public profile:
     - **LeetCode**: `Summary` (aboutMe) or `Real Name` field.
     - **Codeforces**: `Organization`, `First Name`, or `City` field.
   - CodeTrack fetches the public profile and confirms presence of the code before marking `verified=true`.
   - Prevents account impersonation via a partial unique index on `(platform, lower(username)) WHERE verified = true`.
   - Unlinking and relinking supported.

3. **Practice Catalog & Dynamic Solve / Sync Engine (`/practice`)**
   - 20 seeded starter problems (10 LeetCode, 10 Codeforces).
   - Filtering by platform, difficulty (Easy, Medium, Hard), topic, and status (Unsolved vs Solved).
   - **Solve**: Opens problem directly in a new tab (`target="_blank" rel="noopener noreferrer"`) and records a `started_at` timestamp.
   - **Sync (Individual & Sync All)**: Dynamically queries the platforms for accepted submissions by the user's verified accounts and marks problems `SOLVED` with timestamps. Past submissions count!

4. **Sync Rate Limiting & Quota Protection**
   - **45-second Cooldown**: Enforced per user with live countdown timer in the UI. Returns HTTP 429 with remaining seconds if triggered early.
   - **50 Daily Sync Cap**: Tracks sync requests per user per day.
   - **Single Platform Fetch**: One external API call per platform per sync request; checks all pending problems in-memory.
   - **90-Second Submission Cache**: Avoids spamming external APIs on rapid clicks.
   - **Global Throttling**: Codeforces requests spaced $\ge 2.1$s apart; LeetCode requests spaced $\ge 1.0$s apart.
   - **Single-Flight Lock**: Concurrent double-clicks for the same user are safely rejected.

5. **Analytical Dashboard (`/dashboard`)**
   - **365-Day Activity Heatmap**: Interactive GitHub-style calendar grid tracking daily accepted submissions.
   - **Difficulty Breakdown**: Visual segmented bar & percentage distribution (Easy / Medium / Hard).
   - **Contest Rating Progress**: Trajectory chart plotting ratings across contest participation.
   - **Problems Solved Over Time**: Cumulative snapshot progress history.
   - **Streaks**: Current active streak (consecutive days) and longest streak.
   - **Codeforces Tag-Wise Strengths**: Solved problems broken down by topic.

6. **Admin Management Console (`/admin`)**
   - **Add by URL**: Auto-detects platform, extracts slug / contest ID + index, auto-fetches title, difficulty, and topics from the platform, and allows manual overrides.
   - **Bulk Import**: Textarea accepting multiple URLs with a detailed report (added, duplicates, errors).
   - **Problem Management**: Search, toggle active/inactive, delete.
   - **User Management**: View registered users, linked accounts, and trigger global snapshot jobs.

---

## 🛠️ Tech Stack

- **Runtime & Backend**: Node.js 22, Express, TypeScript, BCrypt, Cookie-Parser.
- **Frontend**: React 19, Tailwind CSS v4, Lucide React, Chart.js / SVG Canvas analytics.
- **Database**: Persistent relational store / PostgreSQL with Flyway migration (`V1__init.sql`).
- **External Connectors**:
  - LeetCode unofficial GraphQL API (`https://leetcode.com/graphql`) with timeouts, browser User-Agent & Referer headers, and error mapping.
  - Codeforces official REST API (`https://codeforces.com/api/`).

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 20+ and npm
- (Optional) Docker & Docker Compose for PostgreSQL 16

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `PORT` | Application HTTP port | `3000` |
| `ADMIN_EMAIL` | Initial Admin Email | `admin@codetrack.dev` |
| `ADMIN_PASSWORD` | Initial Admin Password | `Admin@123` |
| `DB_URL` | PostgreSQL JDBC / Connection URL | `jdbc:postgresql://localhost:5432/codetrack` |
| `DB_USERNAME` | PostgreSQL User | `codetrack` |
| `DB_PASSWORD` | PostgreSQL Password | `codetrack` |

### 3. Start PostgreSQL (Optional Docker)
```bash
docker compose up -d
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Supabase Free Tier Profile

When connecting to Supabase:
- Use `application-supabase.yml`.
- Set `sslmode=require`.
- HikariCP pool configuration: `maximum-pool-size: 5`, `minimum-idle: 1`, `connection-timeout: 20000`.
- **Note on Supabase Pooler**: When using the Supabase transaction pooler (port `6543`), you **must** append `prepareThreshold=0` to the JDBC URL:
  ```
  jdbc:postgresql://aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0
  ```

---

## 🔐 How Verification Works

1. Open `/profile`.
2. Enter your LeetCode username or Codeforces handle.
3. CodeTrack sends an initial query to verify the account actually exists.
4. If found, a 6-character code like `CT-7F3K9Q` is generated with a 30-minute expiration.
5. Paste this code into your profile:
   - **LeetCode**: Profile Settings -> "Summary" (aboutMe) or "Real Name".
   - **Codeforces**: Settings -> Social -> "Organization", "First Name", or "City".
6. Return to CodeTrack and click **Verify Account**.
7. CodeTrack queries the platform, scans the profile fields, and locks in the verified state. Once verified, you may remove the code from your profile.

---

## ⚠️ Known Limits of LeetCode's Unofficial API

- LeetCode's public GraphQL endpoint exposes the **last 20 accepted submissions** (`recentAcSubmissionList`).
- If you solved a problem a long time ago, it might not be in the recent 20 list.
- **Tip**: Simply resubmit your accepted solution on LeetCode. It will immediately appear in your recent submissions and sync into CodeTrack!
