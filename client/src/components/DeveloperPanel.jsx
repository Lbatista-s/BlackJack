import { useEffect, useRef, useState } from 'react';
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
  const dialogRef = useRef(null);

  // Sync native dialog state with open prop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [open]);

  // Sync onClose callback when native ESC is pressed or dialog closes
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  // Handle click outside dialog (light dismiss fallback)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleBackdropClick = (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isInside) {
        dialog.close();
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, []);

  const handleCreate = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreatePlayer(name.trim(), Number(bank) || 0);
    setName('');
    setBank(500);
  };

  return (
    <dialog
      ref={dialogRef}
      className="dev-panel"
      aria-labelledby="dev-title"
    >
      <div className="dev-header">
        <h3 id="dev-title">Developer Controls</h3>
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
    </dialog>
  );
}

DeveloperPanel.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  players: PropTypes.array,
  scores: PropTypes.array,
  onRefreshPlayers: PropTypes.func.isRequired,
  onCreatePlayer: PropTypes.func.isRequired,
  onClearScores: PropTypes.func.isRequired,
};

export default DeveloperPanel;
