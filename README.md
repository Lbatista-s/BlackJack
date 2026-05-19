# Blackjack & Hold’em web app (React + Node + PostgreSQL)

Multi-player blackjack (6-deck shoe with splits/doubles/bankrolls) plus a table for Texas Hold’em. Both games share minimalist SVG cards and post results to a PostgreSQL-backed leaderboard through the Node/Express API.

## Easiest way to launch on macOS

- Double-click `launch-blackjack.command`.
- The launcher checks that PostgreSQL is available, launches the API and frontend for you, and opens the app in your browser at `http://127.0.0.1:5173`.
- To stop both services later, double-click `stop-blackjack.command`.
- Logs and PID files are stored in `.launcher/`.

## Run locally

1) PostgreSQL
```bash
createdb blackjack
```

2) API
```bash
cd server
cp .env.example .env   # set DATABASE_URL for your local PostgreSQL user
npm install
npm run migrate:sqlite # optional: import legacy SQLite data
npm start              # defaults to http://localhost:5174
```

3) Frontend
```bash
cd client
npm install
npm run dev            # http://localhost:5173
```

The UI expects `VITE_API_URL` (optional) to point at the API (defaults to `http://localhost:5174`).

## Legacy SQLite data

- The previous SQLite file still exists at `server/data/blackjack-leaderboard.db`.
- Use `cd server && npm run migrate:sqlite` to re-import data from SQLite into PostgreSQL.
- The migration is idempotent, so you can run it again without duplicating rows.

## Migration notes

- Full migration notes are documented in `POSTGRESQL_MIGRATION.md`.

## Deployment notes

- Deploy the `server` folder to your Node host (Render/Fly/Heroku/etc.) with `npm start`. Set `PORT` and `DATABASE_URL` for your PostgreSQL instance.
- Deploy the built frontend (`client/dist`) to a static host (Vercel/Netlify/S3). If the API is not on the same origin, set `VITE_API_URL` at build time: `VITE_API_URL=https://your-api.example.com npm run build`.

## Gameplay highlights

- Blackjack: 6-deck shoe, hand-based turn order, double-down & split handling, bankroll tracking tied to saved user profiles, and centralized chip deposits.
- Hold’em: automated pre-flop/flop/turn/river dealing, 7-card hand evaluation, fold/call/raise/all-in controls, pot splitting, and bankroll updates that persist per user.
- Saved player roster: create/manage chip stacks in the Developer panel and seat any saved user via dropdowns in each game (no passwords needed).
- Developer controls: lightweight admin overlay lets you add players and clear the leaderboard between sessions.
- Minimalist SVG card faces/backs shipped in `client/src/assets`; cards overlap/animate like a real shoe while a floating leaderboard keeps cumulative net stats in SQLite.
