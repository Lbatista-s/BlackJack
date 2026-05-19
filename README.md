# Blackjack & Hold'em — React + Node + PostgreSQL

Multi-player Blackjack (6-deck shoe with splits, doubles & bankrolls) plus a Texas Hold'em table. Both games share minimalist SVG cards and post results to a **PostgreSQL-backed leaderboard** through a Node/Express API.

---

## Quickstart (macOS)

Double-click **`launch-blackjack.command`** in the project root.

The launcher will:
1. Verify PostgreSQL is running (and start it via Homebrew if needed).
2. Install missing `node_modules` in both `server/` and `client/`.
3. Start the API on `http://localhost:5174`.
4. Start the Vite dev server on `http://localhost:5173`.
5. Open the app in your default browser automatically.

To shut everything down: double-click **`stop-blackjack.command`**.  
Logs and PID files live in `.launcher/`.

---

## Manual setup

### 1 — PostgreSQL

Make sure PostgreSQL is installed and running, then create the database:

```bash
createdb blackjack
```

### 2 — API server

```bash
cd server
cp .env.example .env        # edit DATABASE_URL to match your local PG user
npm install
npm start                   # http://localhost:5174
```

The server creates the `players` and `scores` tables automatically on first run.

**Optional** — import data from the legacy SQLite file:

```bash
npm run migrate:sqlite      # idempotent, safe to re-run
```

### 3 — Frontend

```bash
cd client
npm install
npm run dev                 # http://localhost:5173
```

Set `VITE_API_URL` if the API is not on the default port:

```bash
VITE_API_URL=http://localhost:5174 npm run dev
```

---

## Database

The project uses **PostgreSQL** (via the `pg` driver) with two tables:

| Table | Description |
|---|---|
| `players` | Saved player profiles with name and chip balance |
| `scores` | Cumulative leaderboard (net chips, wins, losses, pushes, rounds) |

### Inspect with DBeaver

1. Open DBeaver → **New Database Connection** → choose **PostgreSQL**.
2. Fill in the connection details:

| Field | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `blackjack` |
| Username | your local PostgreSQL user |
| Password | *(leave empty for local installs)* |

3. Click **Test Connection** — DBeaver will prompt you to download the driver if needed.
4. Click **Finish**. Your tables appear under `blackjack → Schemas → public → Tables`.

### Inspect from the terminal

```bash
psql -d blackjack

-- useful queries
SELECT * FROM players ORDER BY name;
SELECT * FROM scores ORDER BY net DESC;
\q
```

### Environment variables (`server/.env`)

```env
PORT=5174
DATABASE_URL=postgresql://<your-pg-user>@localhost:5432/blackjack
SQLITE_PATH=./data/blackjack-leaderboard.db   # only used by the migration script
```

Full migration notes are in [`POSTGRESQL_MIGRATION.md`](./POSTGRESQL_MIGRATION.md).

---

## Gameplay

### Blackjack
- 6-deck shoe with automatic reshuffling.
- Full split and double-down support.
- Bankroll tracking tied to saved player profiles.
- Centralized chip deposit via the Scoreboard panel.

### Texas Hold'em
- Automated pre-flop → flop → turn → river dealing.
- 7-card hand evaluation with pot splitting on ties.
- Fold / call / raise / all-in controls.
- Bankroll updates persist to PostgreSQL per player.

### Shared features
- Minimalist SVG card faces and backs (no external image dependencies).
- Floating leaderboard with cumulative net stats across all sessions.
- Developer panel: create/manage player profiles and reset the leaderboard between sessions.

---

## Deployment

| Layer | How |
|---|---|
| **API** | Deploy `server/` to any Node host (Render, Fly, Railway, Heroku). Set `PORT` and `DATABASE_URL` for your hosted PostgreSQL instance. |
| **Frontend** | Build with `npm run build` inside `client/`, then deploy `client/dist/` to a static host (Vercel, Netlify, S3). Set `VITE_API_URL=https://your-api.example.com` at build time if the API is on a different origin. |
