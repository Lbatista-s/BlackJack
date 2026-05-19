import { useEffect, useState } from 'react';
import './App.css';
import BlackjackTable from './components/BlackjackTable';
import HoldemTable from './components/HoldemTable';
import Scoreboard from './components/Scoreboard';
import DeveloperPanel from './components/DeveloperPanel';

const apiBase =
  (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) ||
  'http://localhost:5174';

function App() {
  const [scores, setScores] = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [banner, setBanner] = useState('');
  const [gameMode, setGameMode] = useState('blackjack');
  const [playerOptions, setPlayerOptions] = useState([]);
  const [chipHandler, setChipHandler] = useState(null);
  const [savedPlayers, setSavedPlayers] = useState([]);
  const [showDeveloper, setShowDeveloper] = useState(false);

  useEffect(() => {
    fetchScores();
    fetchPlayers();
  }, []);

  const fetchScores = async () => {
    try {
      setLoadingScores(true);
      const res = await fetch(`${apiBase}/api/scores`);
      if (!res.ok) throw new Error('Unable to fetch scores');
      const data = await res.json();
      setScores(data);
    } catch (error) {
      console.error(error);
      setBanner('Scoreboard offline—check API connection.');
    } finally {
      setLoadingScores(false);
    }
  };

  const recordResult = async ({ playerName, result, amount }) => {
    try {
      await fetch(`${apiBase}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, result, amount }),
      });
    } catch (error) {
      console.error('Unable to persist score', error);
      setBanner('Unable to persist score—API unreachable.');
    }
  };

  const handleStatus = (text) => setBanner(text);

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`${apiBase}/api/players`);
      if (!res.ok) throw new Error('Unable to fetch players');
      const data = await res.json();
      setSavedPlayers(data);
    } catch (error) {
      console.error(error);
      setBanner('Unable to fetch saved players.');
    }
  };

  const createSavedPlayer = async (name, bank) => {
    try {
      const res = await fetch(`${apiBase}/api/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, bank }),
      });
      if (!res.ok) throw new Error('Unable to create player');
      await fetchPlayers();
    } catch (error) {
      console.error(error);
      setBanner('Could not create player.');
    }
  };

  const persistPlayerBank = async (playerId, bank) => {
    try {
      await fetch(`${apiBase}/api/players/${playerId}/bank`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank }),
      });
      fetchPlayers();
    } catch (error) {
      console.error(error);
      setBanner('Unable to persist bank value.');
    }
  };

  const clearScores = async () => {
    try {
      const res = await fetch(`${apiBase}/api/scores`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Unable to clear scores');
      fetchScores();
    } catch (error) {
      console.error(error);
      setBanner('Unable to clear scores.');
    }
  };

  const handlePlayersChange = (list = []) => {
    setPlayerOptions(list);
  };

  const registerChipHandler = (handler) => {
    setChipHandler(() => handler);
  };

  const handleGlobalTopUp = async (playerId, amount) => {
    if (!chipHandler) {
      setBanner('Select a table and add a player before topping up chips.');
      return;
    }
    const nextBank = chipHandler(playerId, amount);
    if (typeof nextBank === 'number') {
      persistPlayerBank(playerId, nextBank);
    } else {
      setBanner('Unable to add chips to that player right now.');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Felt Room</h1>
          <p className="subtitle">
            Jump between Blackjack and Texas Hold’em with a shared leaderboard.
          </p>
        </div>
        <div className="game-switch">
          <button
            className={gameMode === 'blackjack' ? 'primary' : 'ghost'}
            onClick={() => setGameMode('blackjack')}
          >
            Blackjack
          </button>
          <button
            className={gameMode === 'holdem' ? 'primary' : 'ghost'}
            onClick={() => setGameMode('holdem')}
          >
            Hold’em
          </button>
          <button className="ghost" onClick={() => setShowDeveloper(true)}>
            Developer
          </button>
        </div>
      </header>

      {banner && <div className="banner">{banner}</div>}

      <div className="play-area">
        <main className="stage">
          {gameMode === 'blackjack' ? (
            <BlackjackTable
              onRecordResult={recordResult}
              refreshScores={fetchScores}
              onStatus={handleStatus}
              onPlayersChange={handlePlayersChange}
              onChipHandlerReady={registerChipHandler}
              savedPlayers={savedPlayers}
              onRefreshPlayers={fetchPlayers}
              onBankPersist={persistPlayerBank}
            />
          ) : (
            <HoldemTable
              onRecordResult={recordResult}
              refreshScores={fetchScores}
              onStatus={handleStatus}
              onPlayersChange={handlePlayersChange}
              onChipHandlerReady={registerChipHandler}
              savedPlayers={savedPlayers}
              onRefreshPlayers={fetchPlayers}
              onBankPersist={persistPlayerBank}
            />
          )}
        </main>

        <aside className="scoreboard-floating">
          <Scoreboard
            scores={scores}
            loading={loadingScores}
            onRefresh={fetchScores}
            players={playerOptions}
            onAddChips={handleGlobalTopUp}
          />
        </aside>
      </div>

      <DeveloperPanel
        open={showDeveloper}
        onClose={() => setShowDeveloper(false)}
        players={savedPlayers}
        scores={scores}
        onRefreshPlayers={fetchPlayers}
        onCreatePlayer={createSavedPlayer}
        onClearScores={clearScores}
      />
    </div>
  );
}

export default App;
