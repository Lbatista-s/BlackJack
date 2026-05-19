require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const { pool, initDb, DATABASE_URL } = require('../db');

const sqlitePath =
  process.env.SQLITE_PATH ||
  path.join(__dirname, '..', 'data', 'blackjack-leaderboard.db');

async function migrate() {
  const sqlite = new Database(sqlitePath, { readonly: true });

  try {
    await initDb();

    const players = sqlite
      .prepare('SELECT id, name, bank, createdAt, updatedAt FROM players ORDER BY id')
      .all();
    const scores = sqlite
      .prepare(
        'SELECT playerName, net, wins, losses, pushes, rounds, createdAt, updatedAt FROM scores ORDER BY playerName'
      )
      .all();

    await pool.query('BEGIN');

    for (const player of players) {
      await pool.query(
        `INSERT INTO players (id, name, bank, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET
           bank = EXCLUDED.bank,
           created_at = LEAST(players.created_at, EXCLUDED.created_at),
           updated_at = GREATEST(players.updated_at, EXCLUDED.updated_at)`,
        [
          player.id,
          player.name,
          Number(player.bank) || 0,
          player.createdAt || new Date().toISOString(),
          player.updatedAt || player.createdAt || new Date().toISOString(),
        ]
      );
    }

    for (const score of scores) {
      await pool.query(
        `INSERT INTO scores (
           player_name, net, wins, losses, pushes, rounds, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (player_name) DO UPDATE SET
           net = EXCLUDED.net,
           wins = EXCLUDED.wins,
           losses = EXCLUDED.losses,
           pushes = EXCLUDED.pushes,
           rounds = EXCLUDED.rounds,
           created_at = LEAST(scores.created_at, EXCLUDED.created_at),
           updated_at = GREATEST(scores.updated_at, EXCLUDED.updated_at)`,
        [
          score.playerName,
          Number(score.net) || 0,
          Number(score.wins) || 0,
          Number(score.losses) || 0,
          Number(score.pushes) || 0,
          Number(score.rounds) || 0,
          score.createdAt || new Date().toISOString(),
          score.updatedAt || score.createdAt || new Date().toISOString(),
        ]
      );
    }

    await pool.query(
      `SELECT setval(
         pg_get_serial_sequence('players', 'id'),
         GREATEST(COALESCE((SELECT MAX(id) FROM players), 1), 1),
         true
       )`
    );

    await pool.query(
      `INSERT INTO players (name, bank)
       SELECT s.player_name, 500
       FROM scores s
       LEFT JOIN players p ON p.name = s.player_name
       WHERE p.id IS NULL
       ON CONFLICT (name) DO NOTHING`
    );

    await pool.query('COMMIT');

    console.log(`Migrated SQLite data from ${sqlitePath} to ${DATABASE_URL}`);
    console.log(`Players migrated: ${players.length}`);
    console.log(`Scores migrated: ${scores.length}`);
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    sqlite.close();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('SQLite to PostgreSQL migration failed:', error);
  process.exit(1);
});
