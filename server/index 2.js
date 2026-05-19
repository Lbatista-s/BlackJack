require('dotenv').config();
const cors = require('cors');
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');

const PORT = process.env.PORT || 5174;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/blackjack';
const DB_NAME = process.env.DB_NAME || 'blackjack';
const SCORE_COLLECTION = process.env.SCORE_COLLECTION || 'scores';

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let scoresCollection;
async function getScoresCollection() {
  if (scoresCollection) return scoresCollection;
  await mongoClient.connect();
  const db = mongoClient.db(DB_NAME);
  scoresCollection = db.collection(SCORE_COLLECTION);
  await scoresCollection.createIndex({ playerName: 1 }, { unique: true });
  await scoresCollection.createIndex({ updatedAt: -1 });
  return scoresCollection;
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/scores', async (_req, res) => {
  try {
    const collection = await getScoresCollection();
    const scores = await collection
      .find()
      .sort({ net: -1, wins: -1 })
      .limit(50)
      .toArray();
    res.json(scores);
  } catch (error) {
    console.error('Error fetching scores', error);
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
    rounds: 1,
    net: amount,
    wins: result === 'win' ? 1 : 0,
    losses: result === 'loss' ? 1 : 0,
    pushes: result === 'push' ? 1 : 0,
  };

  try {
    const collection = await getScoresCollection();
    const { value } = await collection.findOneAndUpdate(
      { playerName },
      {
        $inc: increments,
        $set: { updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, returnDocument: 'after' }
    );
    res.json(value);
  } catch (error) {
    console.error('Error saving score', error);
    res.status(500).json({ message: 'Unable to save score' });
  }
});

process.on('SIGINT', async () => {
  try {
    await mongoClient.close();
  } catch (error) {
    console.error('Error closing MongoDB connection', error);
  } finally {
    process.exit(0);
  }
});

app.listen(PORT, () => {
  console.log(`Blackjack API listening on http://localhost:${PORT}`);
});
