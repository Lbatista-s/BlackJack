require('dotenv').config();
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 5174;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.USER || process.env.LOGNAME || 'postgres'}@localhost:5432/blackjack`;

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const createTablesSql = `
  CREATE TABLE IF NOT EXISTS scores (
    player_name TEXT PRIMARY KEY,
    net INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    pushes INTEGER NOT NULL DEFAULT 0,
    rounds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    bank INTEGER NOT NULL DEFAULT 500,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function initDb() {
  await pool.query(createTablesSql);
}

module.exports = {
  DATABASE_URL,
  PORT,
  pool,
  initDb,
};
