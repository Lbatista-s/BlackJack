import { useState } from 'react';
import PropTypes from 'prop-types';

function DeveloperPanel({
  open,
  onClose,
  players,
  scores,
  onRefreshPlayers,
  onCreatePlayer,
  onClearScores,
}) {
  const [name, setName] = useState('');
  const [bank, setBank] = useState(500);

  if (!open) return null;

  const handleCreate = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreatePlayer(name.trim(), Number(bank) || 0);
    setName('');
    setBank(500);
  };

  return (
    <div className="dev-overlay">
      <div className="dev-panel">
        <div className="dev-header">
          <h3>Developer Controls</h3>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="dev-section">
          <h4>Saved players</h4>
          <button className="ghost" onClick={onRefreshPlayers}>
            Refresh
          </button>
          <ul className="dev-player-list">
            {(players || []).map((player) => (
              <li key={player.id}>
                <strong>{player.name}</strong> — Bank: {player.bank}
              </li>
            ))}
            {!players?.length && <li className="muted">No saved players yet.</li>}
          </ul>
          <form onSubmit={handleCreate} className="dev-form">
            <input
              type="text"
              placeholder="Player name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              type="number"
              min={0}
              value={bank}
              onChange={(event) => setBank(event.target.value)}
            />
            <button type="submit">Create player</button>
          </form>
        </div>
        <div className="dev-section">
          <h4>Leaderboard records</h4>
          <p className="muted">{scores?.length || 0} saved rows</p>
          <button className="ghost danger" onClick={onClearScores}>
            Clear leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}

DeveloperPanel.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  players: PropTypes.array,
  scores: PropTypes.array,
  onRefreshPlayers: PropTypes.func,
  onCreatePlayer: PropTypes.func,
  onClearScores: PropTypes.func,
};

export default DeveloperPanel;
