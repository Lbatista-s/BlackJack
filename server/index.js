const cors = require('cors');
const express = require('express');
const { DATABASE_URL, PORT, pool, initDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', storage: DATABASE_URL, engine: 'postgresql' });
});

app.get('/api/scores', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         player_name AS "playerName",
         net,
         wins,
         losses,
         pushes,
         rounds,
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM scores
       ORDER BY net DESC, wins DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error listing scores', error);
    res.status(500).json({ message: 'Unable to fetch scores' });
  }
});

app.post('/api/scores', async (req, res) => {
  const { playerName, result, amount = 0 } = req.body || {};
  if (!playerName || !result) {
    return res
      .status(400)
      .json({ message: 'playerName and result are required' });
  }

  const increments = {
    playerName,
    netDelta: Number(amount) || 0,
    winsDelta: result === 'win' ? 1 : 0,
    lossesDelta: result === 'loss' ? 1 : 0,
    pushesDelta: result === 'push' ? 1 : 0,
    roundsDelta: 1,
    timestamp: new Date().toISOString(),
  };

  try {
    const { rows } = await pool.query(
      `INSERT INTO scores (
         player_name, net, wins, losses, pushes, rounds, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (player_name) DO UPDATE SET
         net = scores.net + EXCLUDED.net,
         wins = scores.wins + EXCLUDED.wins,
         losses = scores.losses + EXCLUDED.losses,
         pushes = scores.pushes + EXCLUDED.pushes,
         rounds = scores.rounds + EXCLUDED.rounds,
         updated_at = EXCLUDED.updated_at
       RETURNING
         player_name AS "playerName",
         net,
         wins,
         losses,
         pushes,
         rounds,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [
        increments.playerName,
        increments.netDelta,
        increments.winsDelta,
        increments.lossesDelta,
        increments.pushesDelta,
        increments.roundsDelta,
        increments.timestamp,
      ]
    );
    res.json(rows[0]);
  } catch (error) {
    console.error('Error saving score', error);
    res.status(500).json({ message: 'Unable to save score' });
  }
});

app.delete('/api/scores', async (_req, res) => {
  try {
    await pool.query('DELETE FROM scores');
    res.json({ cleared: true });
  } catch (error) {
    console.error('Error clearing scores', error);
    res.status(500).json({ message: 'Unable to clear scores' });
  }
});

app.get('/api/players', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         id,
         name,
         bank,
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM players
       ORDER BY name ASC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching players', error);
    res.status(500).json({ message: 'Unable to fetch players' });
  }
});

app.post('/api/players', async (req, res) => {
  const { name, bank = 500 } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'name is required' });
  }

  const timestamp = new Date().toISOString();

  try {
    const { rows } = await pool.query(
      `INSERT INTO players (name, bank, created_at, updated_at)
       VALUES ($1, $2, $3, $3)
       RETURNING
         id,
         name,
         bank,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [name.trim(), Number(bank) || 0, timestamp]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error creating player', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Player already exists' });
    }
    res.status(500).json({ message: 'Unable to create player' });
  }
});

app.patch('/api/players/:id/bank', async (req, res) => {
  const { id } = req.params;
  const { bank } = req.body || {};
  if (typeof bank !== 'number' || Number.isNaN(bank)) {
    return res.status(400).json({ message: 'bank must be a number' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE players
       SET bank = $1, updated_at = $2
       WHERE id = $3
       RETURNING
         id,
         name,
         bank,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [bank, new Date().toISOString(), Number(id)]
    );

    if (!rows[0]) {
      return res.status(404).json({ message: 'Player not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error updating bank', error);
    res.status(500).json({ message: 'Unable to update player bank' });
  }
});

async function shutdown() {
  try {
    await pool.end();
  } catch (error) {
    console.error('Error closing PostgreSQL pool', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`API ready on http://localhost:${PORT} (PostgreSQL: ${DATABASE_URL})`);
  });
}

start().catch((error) => {
  console.error('Unable to start API', error);
  process.exit(1);
});
