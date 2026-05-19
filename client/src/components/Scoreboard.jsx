import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';

function Scoreboard({ scores, loading, onRefresh, players, onAddChips }) {
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [chipAmount, setChipAmount] = useState('');

  const effectiveSelectedPlayer = useMemo(() => {
    if (!players || players.length === 0) return '';
    return players.some((player) => String(player.id) === selectedPlayer)
      ? selectedPlayer
      : String(players[0].id);
  }, [players, selectedPlayer]);

  const handleTopUp = (event) => {
    event.preventDefault();
    const targetPlayerId = effectiveSelectedPlayer;
    if (!onAddChips || !targetPlayerId) return;
    const numeric = Number(chipAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    const chosen = players?.find((player) => String(player.id) === targetPlayerId);
    const resolvedId = chosen ? chosen.id : targetPlayerId;
    onAddChips(resolvedId, numeric);
    setChipAmount('');
  };

  return (
    <div className="scoreboard-card">
      <div className="chip-topup">
        <div className="chip-topup-header">
          <h4>Add chips</h4>
          {!players?.length && <p className="muted">Add players at the table first.</p>}
        </div>
        <form onSubmit={handleTopUp}>
          <select
            value={effectiveSelectedPlayer}
            onChange={(event) => setSelectedPlayer(event.target.value)}
            disabled={!players || players.length === 0 || !onAddChips}
          >
            {(players || []).map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            placeholder="Amount"
            value={chipAmount}
            onChange={(event) => setChipAmount(event.target.value)}
            disabled={!players || players.length === 0 || !onAddChips}
          />
          <button type="submit" disabled={!onAddChips || !players?.length}>
            Add chips
          </button>
          {!players?.length && (
            <p className="muted">Seat a player at the table to top up chips.</p>
          )}
        </form>
      </div>
      <div className="scoreboard-header">
        <h3>Leaderboard</h3>
        <button className="ghost" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      {(!scores || scores.length === 0) && (
        <p className="muted">Play a round to see standings.</p>
      )}
      <div className="score-list">
        {scores?.map((score) => (
          <div key={score.playerName} className="score-row">
            <div>
              <p className="player-name">{score.playerName}</p>
              <p className="muted">
                Wins: {score.wins || 0} • Losses: {score.losses || 0} • Pushes:{' '}
                {score.pushes || 0}
              </p>
            </div>
            <div className="score-stats">
              <span className={`net ${score.net >= 0 ? 'positive' : 'negative'}`}>
                {score.net >= 0 ? '+' : ''}
                {score.net || 0}
              </span>
              <span className="muted">{score.rounds || 0} rounds</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Scoreboard.propTypes = {
  scores: PropTypes.arrayOf(
    PropTypes.shape({
      playerName: PropTypes.string,
      net: PropTypes.number,
      wins: PropTypes.number,
      losses: PropTypes.number,
      pushes: PropTypes.number,
      rounds: PropTypes.number,
    })
  ),
  loading: PropTypes.bool,
  onRefresh: PropTypes.func,
  players: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
    })
  ),
  onAddChips: PropTypes.func,
};

export default Scoreboard;
