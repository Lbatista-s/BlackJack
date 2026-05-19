# PostgreSQL Migration Notes

## Summary

This project was migrated from SQLite to PostgreSQL on March 20, 2026.

The active backend now uses PostgreSQL through the `pg` driver. The legacy SQLite file is still kept as a source backup and migration input:

- Legacy SQLite file: `server/data/blackjack-leaderboard.db`
- Active PostgreSQL database: `blackjack`
- Active connection string in local setup: `postgresql://luisbatista@localhost:5432/blackjack`

## What changed

### Backend

- Added `server/db.js` to centralize the PostgreSQL connection and schema initialization.
- Replaced the SQLite implementation in `server/index.js` with PostgreSQL queries.
- Kept the existing REST API shape so the frontend did not need API changes.
- `/health` now reports PostgreSQL as the active engine.

### Migration tooling

- Added `server/scripts/migrate-sqlite-to-postgres.js`.
- Added the npm script:

```bash
cd server
npm run migrate:sqlite
```

This script:

- reads `players` and `scores` from the legacy SQLite database
- upserts them into PostgreSQL
- creates missing saved players from score-only names
- preserves the migration if run multiple times without duplicating rows

### Environment

`server/.env` now uses:

```env
PORT=5174
DATABASE_URL=postgresql://luisbatista@localhost:5432/blackjack
SQLITE_PATH=./data/blackjack-leaderboard.db
```

`SQLITE_PATH` remains only for the migration script.

## Commands used during the migration

### Verify local PostgreSQL

```bash
psql --version
pg_isready
psql -d postgres -c '\l'
```

### Create the project database

```bash
createdb blackjack
```

### Install PostgreSQL driver in the server

```bash
cd server
npm install pg --cache .npm-cache
```

### Run the migration

```bash
cd server
npm run migrate:sqlite
```

## Result after migration

### Scores migrated into PostgreSQL

- `Luis`
- `Maicolpon`

### Saved players available in PostgreSQL

- `Maicolpon`
- `Luis`

This specifically fixes the previous mismatch where some names existed in `scores` but not in `players`, which prevented them from appearing in the saved-player dropdowns.

## Validation performed

### API

Validated:

- `GET /health`
- `GET /api/players`
- `GET /api/scores`

Expected `/health` response now includes:

```json
{
  "status": "ok",
  "storage": "postgresql://luisbatista@localhost:5432/blackjack",
  "engine": "postgresql"
}
```

### Data checks

Validated directly with PostgreSQL:

```bash
psql -d blackjack -c 'select id, name, bank from players order by id;'
psql -d blackjack -c 'select player_name, net, wins, losses, pushes, rounds from scores order by player_name;'
```

The migration script was also re-run to confirm that it is idempotent.

## How to inspect the databases visually

### Active PostgreSQL database

Recommended tool: DBeaver

Connection values:

- Host: `localhost`
- Port: `5432`
- Database: `blackjack`
- User: `luisbatista`

### Legacy SQLite database

File to open:

- `server/data/blackjack-leaderboard.db`

Recommended tools:

- DBeaver
- DB Browser for SQLite

### Azure Data Studio

You may still be able to connect to PostgreSQL with extensions, but it is no longer the recommended path for new setup. DBeaver is the better option here because it lets you inspect both PostgreSQL and SQLite in one place.

## Normal workflow now

### Start the app

```bash
./launch-blackjack.command
```

### Stop the app

```bash
./stop-blackjack.command
```

### Start only the backend manually

```bash
cd server
npm start
```

### Re-run SQLite import

```bash
cd server
npm run migrate:sqlite
```
