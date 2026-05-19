import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Card from './Card';
import { createShoe } from '../utils/cards';
import { compareHands, evaluateHoldemHand } from '../utils/holdem';

const START_BANK = 500;
const DEFAULT_STAKE = 20;

const createPlayer = (saved, seatId) => ({
  id: seatId,
  userId: saved?.id ?? `seat-${seatId}`,
  name: saved?.name ?? `Player ${seatId}`,
  bank: Number(saved?.bank) ?? START_BANK,
  stake: DEFAULT_STAKE,
  cards: [],
  roundStake: 0,
  stageBet: 0,
  bestHand: null,
  status: 'waiting',
  showCards: false,
  folded: false,
  lastWin: null,
});

const HoldemTable = ({
  onRecordResult,
  refreshScores,
  onStatus,
  onPlayersChange,
  onChipHandlerReady,
  savedPlayers,
  onRefreshPlayers,
  onBankPersist,
}) => {
  const [deck, setDeck] = useState(() => createShoe(1));
  const [players, setPlayers] = useState([]);
  const [community, setCommunity] = useState([]);
  const [stage, setStage] = useState('idle');
  const [pot, setPot] = useState(0);
  const [roundActive, setRoundActive] = useState(false);
  const [dealCount, setDealCount] = useState(0);
  const [betInputs, setBetInputs] = useState({});
  const [seatCounter, setSeatCounter] = useState(1);
  const [selectedSavedId, setSelectedSavedId] = useState('');

  const updateStatus = (text) => onStatus && onStatus(text);

  useEffect(() => {
    if (!savedPlayers?.length) {
      setSelectedSavedId('');
      return;
    }
    if (!savedPlayers.some((player) => String(player.id) === selectedSavedId)) {
      setSelectedSavedId(String(savedPlayers[0].id));
    }
  }, [savedPlayers, selectedSavedId]);

  const finalizeRound = (snapshot, winnerIds, summary) => {
    if (!snapshot.length) return;
    const share = winnerIds.length ? pot / winnerIds.length : 0;
    const scorePromises = [];

    const resolved = snapshot.map((player) => {
      if (!player.cards.length && player.roundStake === 0) return player;
      const didWin = winnerIds.includes(player.id);
      const winnings = didWin ? share : 0;
      const net = winnings - player.roundStake;

      if (player.roundStake > 0 || winnings > 0) {
        scorePromises.push(
          Promise.resolve(
            onRecordResult({
              playerName: player.name,
              result: net > 0 ? 'win' : net < 0 ? 'loss' : 'push',
              amount: net,
            })
          )
        );
      }

      return {
        ...player,
        bank: player.bank + winnings,
        roundStake: 0,
        stageBet: 0,
        status: didWin ? 'winner' : player.status === 'folded' ? 'folded' : 'out',
        bestHand: didWin ? player.bestHand : null,
        showCards: false,
        folded: player.status === 'folded',
        lastWin: didWin ? summary || player.bestHand?.text || 'Won the hand' : player.lastWin,
      };
    });

    setPlayers(resolved);
    resolved.forEach((player) => {
      if (player.userId && typeof player.bank === 'number') {
        onBankPersist?.(player.userId, player.bank);
      }
    });
    setStage('showdown');
    setRoundActive(false);
    setPot(0);
    setBetInputs({});
    updateStatus(summary);
    Promise.allSettled(scorePromises).then(() => refreshScores());
  };

  const settleIfSinglePlayer = (snapshot) => {
    if (!roundActive) return;
    const contenders = snapshot.filter((player) => player.status === 'playing');
    if (contenders.length === 1) {
      finalizeRound(snapshot, [contenders[0].id], `${contenders[0].name} wins the pot by fold.`);
    }
  };

  const toggleCards = (playerId) => {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId ? { ...player, showCards: !player.showCards } : player
      )
    );
  };

  const foldHand = (playerId) => {
    setPlayers((prev) => {
      const updated = prev.map((player) =>
        player.id === playerId
          ? { ...player, status: 'folded', folded: true, showCards: false }
          : player
      );
      setTimeout(() => settleIfSinglePlayer(updated), 0);
      return updated;
    });
  };

  const pullCard = (currentDeck) => {
    const stack = currentDeck.length ? currentDeck : createShoe(1);
    const [card, ...rest] = stack;
    setDealCount((count) => count + 1);
    return { card, nextDeck: rest };
  };

  const addPlayer = () => {
    if (!selectedSavedId) {
      updateStatus('Select a saved player first.');
      return;
    }
    const saved = savedPlayers?.find(
      (player) => String(player.id) === selectedSavedId
    );
    if (!saved) {
      updateStatus('Saved player not found.');
      return;
    }
    if (players.some((player) => player.userId === saved.id)) {
      updateStatus('Player already seated.');
      return;
    }
    const seatId = seatCounter;
    setSeatCounter((prev) => prev + 1);
    setPlayers((prev) => [...prev, createPlayer(saved, seatId)]);
  };

  const removePlayer = (id) => {
    setPlayers((prev) => prev.filter((player) => player.id !== id));
  };

  const updateStake = (playerId, value) => {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId
          ? { ...player, stake: Math.max(1, Number(value) || DEFAULT_STAKE) }
          : player
      )
    );
  };

  const addFunds = useCallback(
    (userId, amount) => {
      if (!Number.isFinite(amount) || amount <= 0) return null;
      let nextBank = null;
      setPlayers((prev) =>
        prev.map((player) =>
          player.userId === userId
            ? ((nextBank = player.bank + amount), { ...player, bank: nextBank })
            : player
        )
      );
      if (nextBank !== null) {
        onBankPersist?.(userId, nextBank);
      }
      return nextBank;
    },
    [onBankPersist]
  );

  useEffect(() => {
    onPlayersChange?.(
      players.map((player) => ({ id: player.userId, name: player.name }))
    );
  }, [players, onPlayersChange]);

  useEffect(() => {
    if (!onChipHandlerReady) return undefined;
    onChipHandlerReady((userId, amount) => addFunds(userId, amount));
    return () => onChipHandlerReady(null);
  }, [addFunds, onChipHandlerReady]);

  const placeBet = useCallback(
    (seatId, amount, clearInput = false) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      let invested = 0;
      let userId = null;
      let nextBank = null;
      setPlayers((prev) =>
        prev.map((player) => {
          if (
            player.id !== seatId ||
            player.status !== 'playing' ||
            player.bank < amount
          ) {
            return player;
          }
          invested = amount;
          userId = player.userId;
          nextBank = player.bank - amount;
          return {
            ...player,
            bank: nextBank,
            roundStake: player.roundStake + amount,
            stageBet: player.stageBet + amount,
          };
        })
      );
      if (invested) {
        setPot((prevPot) => prevPot + invested);
        if (userId && typeof nextBank === 'number') {
          onBankPersist?.(userId, nextBank);
        }
        if (clearInput) {
          setBetInputs((prev) => ({ ...prev, [seatId]: '' }));
        }
      }
    },
    [onBankPersist]
  );

  const getStageTarget = () =>
    players.reduce((max, player) => Math.max(max, player.stageBet || 0), 0);

  const handleCall = (playerId) => {
    if (!roundActive) return;
    const player = players.find((entry) => entry.id === playerId);
    if (!player || player.status !== 'playing') return;
    const diff = Math.max(0, getStageTarget() - player.stageBet);
    if (diff <= 0) return;
    const amount = Math.min(diff, player.bank);
    placeBet(playerId, amount);
  };

  const handleRaise = (playerId) => {
    if (!roundActive) return;
    const raiseAmount = Number(betInputs[playerId]) || 0;
    const player = players.find((entry) => entry.id === playerId);
    if (!player || player.status !== 'playing') return;
    const diff = Math.max(0, getStageTarget() - player.stageBet);
    const total = diff + raiseAmount;
    if (total <= 0) return;
    const amount = Math.min(total, player.bank);
    placeBet(playerId, amount, true);
  };

  const handleAllIn = (playerId) => {
    if (!roundActive) return;
    const player = players.find((entry) => entry.id === playerId);
    if (!player || player.status !== 'playing' || player.bank <= 0) return;
    placeBet(playerId, player.bank, true);
  };

  const startRound = () => {
    if (players.length < 2) {
      updateStatus('Need at least two players for Hold’em.');
      return;
    }
    const short = players.find((player) => player.bank < player.stake);
    if (short) {
      updateStatus(`${short.name} needs chips for their stake.`);
      return;
    }

    let nextDeck = createShoe(1);
    const dealt = players.map((player) => {
      const first = pullCard(nextDeck);
      nextDeck = first.nextDeck;
      const second = pullCard(nextDeck);
      nextDeck = second.nextDeck;
      return {
        ...player,
        cards: [first.card, second.card],
        bank: player.bank - player.stake,
        roundStake: player.stake,
        stageBet: player.stake,
        status: 'playing',
        bestHand: null,
        lastWin: null,
        showCards: false,
        folded: false,
      };
    });

    setPlayers(dealt);
    dealt.forEach((player) => {
      if (player.userId && typeof player.bank === 'number') {
        onBankPersist?.(player.userId, player.bank);
      }
    });
    setDeck(nextDeck);
    setCommunity([]);
    setPot(dealt.reduce((sum, player) => sum + player.stake, 0));
    setStage('preflop');
    setRoundActive(true);
    setBetInputs({});
    updateStatus('Blinds posted. Ready for the flop.');
  };

  const dealCommunity = (count, nextStage) => {
    if (!roundActive) return;
    let nextDeck = [...deck];
    const fresh = [];
    for (let i = 0; i < count; i += 1) {
      const draw = pullCard(nextDeck);
      nextDeck = draw.nextDeck;
      fresh.push(draw.card);
    }
    setCommunity((prev) => [...prev, ...fresh]);
    setDeck(nextDeck);
    setStage(nextStage);
    setPlayers((prev) =>
      prev.map((player) =>
        player.status === 'playing' ? { ...player, stageBet: 0 } : player
      )
    );
    setBetInputs({});
    updateStatus(
      nextStage === 'flop'
        ? 'Flop is out.'
        : nextStage === 'turn'
        ? 'Turn card burning.'
        : 'River hits the felt.'
    );
  };

  const showdown = () => {
    if (!roundActive) return;
    const withHands = players.map((player) => {
      if (!player.cards.length || player.status === 'folded') {
        return { ...player, bestHand: null };
      }
      const bestHand = evaluateHoldemHand([...player.cards, ...community]);
      return { ...player, bestHand };
    });

    let bestScore = null;
    let winners = [];
    withHands.forEach((player) => {
      if (!player.bestHand) return;
      if (!bestScore || compareHands(player.bestHand, bestScore) > 0) {
        bestScore = player.bestHand;
        winners = [player.id];
      } else if (compareHands(player.bestHand, bestScore) === 0) {
        winners.push(player.id);
      }
    });

    if (!winners.length) {
      const active = withHands.filter((player) => player.status === 'playing');
      if (active.length) {
        winners = [active[0].id];
      }
    }

    const winnerText =
      winners.length === 1
        ? withHands.find((player) => player.id === winners[0])?.bestHand?.text ||
          'Scooped the pot'
        : `Pot split across ${winners.length} players.`;

    finalizeRound(withHands, winners, winnerText);
  };

  const resetTable = () => {
    setDeck(createShoe(1));
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        cards: [],
        roundStake: 0,
        stageBet: 0,
        bestHand: null,
        status: 'waiting',
        lastWin: null,
        showCards: false,
        folded: false,
      }))
    );
    setCommunity([]);
    setPot(0);
    setStage('idle');
    setRoundActive(false);
    setBetInputs({});
    updateStatus('Fresh deck shuffled for Hold’em.');
  };

  const stageAction = () => {
    if (stage === 'preflop') {
      dealCommunity(3, 'flop');
    } else if (stage === 'flop') {
      dealCommunity(1, 'turn');
    } else if (stage === 'turn') {
      dealCommunity(1, 'river');
    } else if (stage === 'river') {
      showdown();
    }
  };

  const stageLabel =
    stage === 'preflop'
      ? 'Deal flop'
      : stage === 'flop'
      ? 'Deal turn'
      : stage === 'turn'
      ? 'Deal river'
      : stage === 'river'
      ? 'Showdown'
      : 'Waiting';

  const stageDisabled =
    !roundActive || stage === 'idle' || stage === 'showdown';

  return (
    <section className="table-surface holdem">
      <div className="table-header">
        <div>
          <h2>Texas Hold’em</h2>
          <p className="subtitle">
            Two-card starting hands, community board, automatic showdown detection.
          </p>
        </div>
        <button className="ghost" onClick={resetTable}>
          Reset deck
        </button>
      </div>

      <div className="controls">
        <button className="primary" onClick={startRound} disabled={roundActive}>
          {roundActive ? 'Hand in progress' : 'Deal Hold’em'}
        </button>
        <div className="add-player">
          <select
            value={selectedSavedId}
            onChange={(event) => setSelectedSavedId(event.target.value)}
            disabled={!savedPlayers?.length}
          >
            {(savedPlayers || []).map((saved) => (
              <option key={saved.id} value={saved.id}>
                {saved.name} — Bank: {saved.bank}
              </option>
            ))}
            {!savedPlayers?.length && <option value="">No saved players</option>}
          </select>
          <button onClick={addPlayer} disabled={!savedPlayers?.length || roundActive}>
            Seat player
          </button>
          <button className="ghost" onClick={onRefreshPlayers}>
            Refresh list
          </button>
        </div>
        <button className="ghost" onClick={stageAction} disabled={stageDisabled}>
          {stageLabel}
        </button>
      </div>

      <div className="holdem-board">
        <div className="community">
          {community.map((card, idx) => (
            <Card key={card.id} card={card} order={dealCount + idx} />
          ))}
          {community.length === 0 && (
            <p className="muted">Flop, turn, and river will appear here.</p>
          )}
        </div>
        <div className="pot">
          <p>Pot: {pot}</p>
          <p className="muted">Stage: {stage === 'idle' ? 'Waiting' : stage}</p>
        </div>
      </div>

      <div className="players-grid">
        {players.map((player) => (
          <div
            key={player.id}
            className={`player holdem-player ${
              player.status === 'folded' ? 'folded' : ''
            }`}
          >
            <div className="player-header">
              <div>
                <h4>{player.name}</h4>
                <p className="muted">Bank: {player.bank}</p>
                <p className="muted">
                  Status: {player.status === 'folded' ? 'Folded' : player.status}
                </p>
                {player.lastWin && <p className="muted">{player.lastWin}</p>}
              </div>
              <button className="link" onClick={() => removePlayer(player.id)}>
                Remove
              </button>
            </div>
            <div className="player-money">
              <div>
                <label>Stake</label>
                <input
                  type="number"
                  min={1}
                  value={player.stake}
                  disabled={roundActive}
                  onChange={(event) => updateStake(player.id, event.target.value)}
                />
              </div>
            </div>
            <div className="holdem-controls">
              <div className="stage-bet">
                <label className="bank-label">Raise amount</label>
                <input
                  type="number"
                  min={1}
                  value={betInputs[player.id] || ''}
                  onChange={(event) =>
                    setBetInputs((prev) => ({
                      ...prev,
                      [player.id]: event.target.value,
                    }))
                  }
                  placeholder="Raise amount"
                  disabled={!roundActive || player.status !== 'playing'}
                />
                <button
                  onClick={() => handleRaise(player.id)}
                  disabled={!roundActive || player.status !== 'playing'}
                >
                  Raise
                </button>
              </div>
              <div className="holdem-actions">
                <button
                  className="ghost"
                  onClick={() => handleCall(player.id)}
                  disabled={!roundActive || player.status !== 'playing'}
                >
                  Call
                </button>
                <button
                  className="ghost"
                  onClick={() => handleAllIn(player.id)}
                  disabled={!roundActive || player.status !== 'playing'}
                >
                  All in
                </button>
                <button
                  className="ghost"
                  onClick={() => toggleCards(player.id)}
                  disabled={!player.cards.length}
                >
                  {player.showCards ? 'Hide cards' : 'Peek cards'}
                </button>
                <button
                  className="ghost"
                  onClick={() => foldHand(player.id)}
                  disabled={!roundActive || player.status !== 'playing'}
                >
                  Fold
                </button>
              </div>
            </div>
            <div className="hand overlap">
              {player.cards.length ? (
                player.cards.map((card, idx) => (
                  <Card
                    key={card.id}
                    card={card}
                    order={dealCount + idx}
                    hidden={!player.showCards}
                  />
                ))
              ) : (
                <p className="muted">Waiting for cards</p>
              )}
            </div>
            {player.bestHand && (
              <div className="hand-info">
                <span>{player.bestHand.label}</span>
                <span className="muted">{player.bestHand.text}</span>
              </div>
            )}
            {player.stageBet > 0 && player.status === 'playing' && (
              <p className="muted">Stage investment: {player.stageBet}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

HoldemTable.propTypes = {
  onRecordResult: PropTypes.func.isRequired,
  refreshScores: PropTypes.func.isRequired,
  onStatus: PropTypes.func,
  onPlayersChange: PropTypes.func,
  onChipHandlerReady: PropTypes.func,
  savedPlayers: PropTypes.array,
  onRefreshPlayers: PropTypes.func,
  onBankPersist: PropTypes.func,
};

export default HoldemTable;
