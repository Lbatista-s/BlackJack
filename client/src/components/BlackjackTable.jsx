import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Card from './Card';
import { calculateHandValue, createShoe } from '../utils/cards';

const DEFAULT_BET = 10;
const START_BANK = 500;
const SHOE_DECKS = 6;

const statusCopy = {
  waiting: 'Waiting',
  playing: 'Playing',
  blackjack: 'Blackjack!',
  bust: 'Bust',
  stand: 'Standing',
};

const finishedStatuses = new Set(['blackjack', 'bust', 'stand']);

const createHand = (bet) => ({
  id: Math.random().toString(36).slice(2, 9),
  cards: [],
  bet,
  status: 'waiting',
  result: null,
  payout: 0,
  doubled: false,
  isSplit: false,
});

const createPlayer = (saved, seatId) => ({
  id: seatId,
  userId: saved?.id ?? `seat-${seatId}`,
  name: saved?.name ?? `Player ${seatId}`,
  bank: Number(saved?.bank) ?? START_BANK,
  baseBet: DEFAULT_BET,
  hands: [createHand(DEFAULT_BET)],
  wager: 0,
  roundNet: 0,
});

function BlackjackTable({
  onRecordResult,
  refreshScores,
  onStatus,
  onPlayersChange,
  onChipHandlerReady,
  savedPlayers,
  onRefreshPlayers,
  onBankPersist,
}) {
  const [shoe, setShoe] = useState(() => createShoe(SHOE_DECKS));
  const [players, setPlayers] = useState([]);
  const [dealer, setDealer] = useState({
    hand: [],
    status: 'waiting',
    revealHole: false,
  });
  const [turn, setTurn] = useState({ playerIndex: 0, handIndex: 0 });
  const [roundActive, setRoundActive] = useState(false);
  const [dealCount, setDealCount] = useState(0);
  const [seatCounter, setSeatCounter] = useState(1);
  const [selectedSavedId, setSelectedSavedId] = useState('');

  const remainingDecks = useMemo(() => (shoe.length / 52).toFixed(1), [shoe]);

  useEffect(() => {
    if (!savedPlayers?.length) {
      setSelectedSavedId('');
      return;
    }
    if (!savedPlayers.some((player) => String(player.id) === selectedSavedId)) {
      setSelectedSavedId(String(savedPlayers[0].id));
    }
  }, [savedPlayers, selectedSavedId]);

  const updateStatus = (text) => {
    if (onStatus) onStatus(text);
  };

  const ensureShoe = (currentShoe) => {
    if (currentShoe.length < 40) {
      updateStatus('Shoe reshuffled and freshened up.');
      return createShoe(SHOE_DECKS);
    }
    return currentShoe;
  };

  const pullCard = (currentShoe) => {
    let stack = ensureShoe(currentShoe);
    const [card, ...rest] = stack;
    setDealCount((count) => count + 1);
    return { card, nextShoe: rest };
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

  const removePlayer = (seatId) => {
    setPlayers((prev) => prev.filter((player) => player.id !== seatId));
    setTurn({ playerIndex: 0, handIndex: 0 });
  };

  const updateBet = (playerId, value) => {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId
          ? {
              ...player,
              baseBet: Math.max(1, Number(value) || DEFAULT_BET),
              hands: [createHand(Math.max(1, Number(value) || DEFAULT_BET))],
            }
          : player
      )
    );
  };

  const addFunds = useCallback(
    (userId, amount) => {
      if (!Number.isFinite(amount) || amount <= 0) return null;
      let nextBank = null;
      setPlayers((prev) =>
        prev.map((player) => {
          if (player.userId !== userId) return player;
          nextBank = player.bank + amount;
          return { ...player, bank: nextBank };
        })
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

  const startRound = () => {
    if (!players.length) {
      updateStatus('Add at least one player to deal a round.');
      return;
    }
    const shortStack = players.find(
      (player) => player.bank < player.baseBet || player.baseBet < 1
    );
    if (shortStack) {
      updateStatus(`${shortStack.name} needs more chips to cover the bet.`);
      return;
    }

    let nextShoe = [...shoe];
    const resetPlayers = players.map((player) => {
      const baseBet = player.baseBet || DEFAULT_BET;
      const first = pullCard(nextShoe);
      nextShoe = first.nextShoe;
      const second = pullCard(nextShoe);
      nextShoe = second.nextShoe;
      const cards = [first.card, second.card];
      const hand = {
        ...createHand(baseBet),
        cards,
        status: deriveStatus(cards),
      };
      return {
        ...player,
        hands: [hand],
        wager: baseBet,
        roundNet: 0,
      };
    });

    const dealerHand = [];
    let temp;
    ({ card: temp, nextShoe } = pullCard(nextShoe));
    dealerHand.push(temp);
    ({ card: temp, nextShoe } = pullCard(nextShoe));
    dealerHand.push(temp);

    const firstActive = findNextHand(resetPlayers, 0, -1);

    setPlayers(resetPlayers);
    setDealer({
      hand: dealerHand,
      status: deriveStatus(dealerHand),
      revealHole: false,
    });
    setShoe(nextShoe);
    if (firstActive) {
      setTurn(firstActive);
    } else {
      setTurn({ playerIndex: 0, handIndex: 0 });
    }
    setRoundActive(true);
    updateStatus('Players are live. Dealer waits for actions.');

    if (!firstActive) {
      resolveDealer(resetPlayers);
    }
  };

  const deriveStatus = (handCards) => {
    const total = calculateHandValue(handCards);
    if (!handCards.length) return 'waiting';
    if (total > 21) return 'bust';
    if (total === 21 && handCards.length === 2) return 'blackjack';
    return 'playing';
  };

  const allHandsFinished = (playerList) =>
    playerList.every((player) =>
      player.hands.every((hand) => finishedStatuses.has(hand.status))
    );

  const handleHit = (playerId, handId) => {
    if (!roundActive) return;
    setPlayers((prevPlayers) => {
      let nextShoe = [...shoe];
      const updated = prevPlayers.map((player, pIndex) => {
        if (player.id !== playerId) return player;
        const hands = player.hands.map((hand, hIndex) => {
          if (hand.id !== handId) return hand;
          const draw = pullCard(nextShoe);
          nextShoe = draw.nextShoe;
          const newHand = {
            ...hand,
            cards: [...hand.cards, draw.card],
          };
          newHand.status = deriveStatus(newHand.cards);
          return newHand;
        });
        return { ...player, hands };
      });
      setShoe(nextShoe);
      advanceTurn(updated, playerId, handId);
      return updated;
    });
  };

  const handleStand = (playerId, handId) => {
    if (!roundActive) return;
    setPlayers((prevPlayers) => {
      const updated = prevPlayers.map((player) =>
        player.id === playerId
          ? {
              ...player,
              hands: player.hands.map((hand) =>
                hand.id === handId ? { ...hand, status: 'stand' } : hand
              ),
            }
          : player
      );
      advanceTurn(updated, playerId, handId);
      return updated;
    });
  };

  const handleDouble = (playerId, handId) => {
    if (!roundActive) return;
    setPlayers((prevPlayers) => {
      let nextShoe = [...shoe];
      const updated = prevPlayers.map((player) => {
        if (player.id !== playerId) return player;
        const targetHand = player.hands.find((hand) => hand.id === handId);
        if (
          !targetHand ||
          targetHand.cards.length !== 2 ||
          targetHand.doubled ||
          player.bank < player.wager + targetHand.bet
        ) {
          return player;
        }
        const hands = player.hands.map((hand) => {
          if (hand.id !== handId) return hand;
          const draw = pullCard(nextShoe);
          nextShoe = draw.nextShoe;
          const doubledBet = hand.bet * 2;
          const cards = [...hand.cards, draw.card];
          const status = deriveStatus(cards);
          return {
            ...hand,
            bet: doubledBet,
            cards,
            status: status === 'playing' ? 'stand' : status,
            doubled: true,
          };
        });
        return {
          ...player,
          hands,
          wager: player.wager + targetHand.bet,
        };
      });
      setShoe(nextShoe);
      advanceTurn(updated, playerId, handId);
      return updated;
    });
  };

  const handleSplit = (playerId, handId) => {
    if (!roundActive) return;
    setPlayers((prevPlayers) => {
      let nextShoe = [...shoe];
      let nextTurn = turn;
      const updated = prevPlayers.map((player, pIdx) => {
        if (player.id !== playerId) return player;
        const targetHandIndex = player.hands.findIndex((hand) => hand.id === handId);
        const targetHand = player.hands[targetHandIndex];
        if (
          !targetHand ||
          targetHand.cards.length !== 2 ||
          targetHand.cards[0].rank !== targetHand.cards[1].rank ||
          player.hands.length >= 4 ||
          player.bank < player.wager + targetHand.bet
        ) {
          return player;
        }

        const [firstCard, secondCard] = targetHand.cards;
        const newHandA = {
          ...targetHand,
          id: Math.random().toString(36).slice(2, 9),
          cards: [firstCard],
          status: 'playing',
          isSplit: true,
        };
        const newHandB = {
          ...targetHand,
          id: Math.random().toString(36).slice(2, 9),
          cards: [secondCard],
          status: 'playing',
          isSplit: true,
        };

        [newHandA, newHandB].forEach((hand) => {
          const draw = pullCard(nextShoe);
          nextShoe = draw.nextShoe;
          hand.cards = [...hand.cards, draw.card];
          hand.status = deriveStatus(hand.cards);
        });

        const hands = [];
        player.hands.forEach((hand, index) => {
          if (hand.id === handId) {
            nextTurn = { playerIndex: pIdx, handIndex: hands.length };
            hands.push(newHandA, newHandB);
          } else {
            hands.push(hand);
          }
        });

        return {
          ...player,
          hands,
          wager: player.wager + targetHand.bet,
        };
      });
      setShoe(nextShoe);
      setTurn(nextTurn);
      return updated;
    });
  };

  const advanceTurn = (playerList, playerId, handId) => {
    const playerIndex = playerList.findIndex((player) => player.id === playerId);
    if (playerIndex === -1) return;
    const handIndex = playerList[playerIndex].hands.findIndex(
      (hand) => hand.id === handId
    );
    const currentHand = playerList[playerIndex].hands[handIndex];
    if (!finishedStatuses.has(currentHand.status)) {
      setTurn({ playerIndex, handIndex });
      return;
    }

    const next = findNextHand(playerList, playerIndex, handIndex);
    if (!next) {
      resolveDealer(playerList);
    } else {
      setTurn(next);
    }
  };

  const findNextHand = (playerList, startPlayer = 0, startHand = -1) => {
    for (let p = startPlayer; p < playerList.length; p += 1) {
      const player = playerList[p];
      const start = p === startPlayer ? startHand + 1 : 0;
      for (let h = start; h < player.hands.length; h += 1) {
        if (!finishedStatuses.has(player.hands[h].status)) {
          return { playerIndex: p, handIndex: h };
        }
      }
    }
    return null;
  };

  const resolveDealer = (playerList) => {
    let nextShoe = [...shoe];
    let dealerHand = [...dealer.hand];
    let dealerStatus = deriveStatus(dealerHand);

    while (
      dealerStatus === 'playing' &&
      calculateHandValue(dealerHand) < 17
    ) {
      const draw = pullCard(nextShoe);
      nextShoe = draw.nextShoe;
      dealerHand = [...dealerHand, draw.card];
      dealerStatus = deriveStatus(dealerHand);
    }

    const dealerTotal = calculateHandValue(dealerHand);
    const scorePromises = [];
    const resolvedPlayers = playerList.map((player) => {
      let totalNet = 0;
      const hands = player.hands.map((hand) => {
        const total = calculateHandValue(hand.cards);
        let result = 'push';
        let net = 0;

        if (hand.status === 'bust') {
          result = 'loss';
          net = -hand.bet;
        } else if (hand.status === 'blackjack' && dealerStatus !== 'blackjack') {
          result = 'win';
          net = Math.round(hand.bet * 1.5);
        } else if (dealerStatus === 'bust') {
          result = 'win';
          net = hand.bet;
        } else if (dealerStatus === 'blackjack' && hand.status !== 'blackjack') {
          result = 'loss';
          net = -hand.bet;
        } else if (dealerTotal > total) {
          result = 'loss';
          net = -hand.bet;
        } else if (dealerTotal < total) {
          result = 'win';
          net = hand.bet;
        }

        totalNet += net;
        return {
          ...hand,
          status: finishedStatuses.has(hand.status) ? hand.status : 'stand',
          result,
          payout: net,
        };
      });

      const roundResult = totalNet > 0 ? 'win' : totalNet < 0 ? 'loss' : 'push';
      if (totalNet !== 0 || player.wager > 0) {
        scorePromises.push(
          Promise.resolve(
            onRecordResult({
              playerName: player.name,
              result: roundResult,
              amount: totalNet,
            })
          )
        );
      }

      return {
        ...player,
        hands,
        bank: player.bank + totalNet,
        wager: 0,
        roundNet: totalNet,
      };
    });

    setDealer({ hand: dealerHand, status: dealerStatus, revealHole: true });
    setPlayers(resolvedPlayers);
    resolvedPlayers.forEach((player) => {
      if (player.userId && typeof player.bank === 'number') {
        onBankPersist?.(player.userId, player.bank);
      }
    });
    setShoe(nextShoe);
    setRoundActive(false);
    setTurn({ playerIndex: 0, handIndex: 0 });
    updateStatus('Round settled. Shuffle up again when ready.');
    Promise.allSettled(scorePromises).then(() => refreshScores());
  };

  const resetTable = () => {
    setShoe(createShoe(SHOE_DECKS));
    setPlayers((prev) =>
      prev.map((player) => ({
        ...player,
        hands: [createHand(player.baseBet)],
        wager: 0,
        roundNet: 0,
      }))
    );
    setDealer({ hand: [], status: 'waiting', revealHole: false });
    setRoundActive(false);
    setTurn({ playerIndex: 0, handIndex: 0 });
    updateStatus('Fresh shoe on the felt.');
  };

  return (
    <section className="table-surface">
      <div className="table-header">
        <div>
          <h2>Blackjack</h2>
          <p className="subtitle">
            6-deck shoe, dealer stands on 17. Split and double when the count is right.
          </p>
        </div>
        <div className="shoe-info">
          <span>Decks: {remainingDecks}</span>
          <button className="ghost" onClick={resetTable}>
            Reshuffle
          </button>
        </div>
      </div>

      <div className="controls">
        <button className="primary" onClick={startRound} disabled={roundActive}>
          {roundActive ? 'Round running' : 'Deal blackjack'}
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
      </div>

      <div className="dealer">
        <h3>Dealer</h3>
        <div className="hand overlap">
          {dealer.hand.map((card, idx) => (
            <Card
              key={card.id}
              card={card}
              hidden={idx === 1 && roundActive && !dealer.revealHole}
              order={dealCount + idx}
            />
          ))}
        </div>
        <div className="hand-info">
          <span>
            Total:{' '}
            {dealer.revealHole || !roundActive
              ? calculateHandValue(dealer.hand)
              : '??'}
          </span>
          <span className={`status ${dealer.status}`}>
            {statusCopy[dealer.status] || dealer.status}
          </span>
        </div>
      </div>

      <div className="players-grid players">
        {players.map((player, pIndex) => (
          <div
            key={player.id}
            className={`player ${
              roundActive && turn.playerIndex === pIndex ? 'active' : ''
            }`}
          >
            <div className="player-header">
              <div>
                <h4>{player.name}</h4>
                <p className="muted">Bank: {player.bank}</p>
                {player.roundNet !== 0 && (
                  <p
                    className={`muted ${
                      player.roundNet > 0 ? 'positive' : 'negative'
                    }`}
                  >
                    {player.roundNet > 0 ? '+' : ''}
                    {player.roundNet} this round
                  </p>
                )}
              </div>
              <button className="link" onClick={() => removePlayer(player.id)}>
                Remove
              </button>
            </div>

            <div className="player-money">
              <label>Bet</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={player.baseBet}
                disabled={roundActive}
                onChange={(event) => updateBet(player.id, event.target.value)}
              />
            </div>

            <div className="hands">
              {player.hands.map((hand, hIndex) => {
                const isActive =
                  roundActive &&
                  turn.playerIndex === pIndex &&
                  turn.handIndex === hIndex &&
                  !finishedStatuses.has(hand.status);
                return (
                  <div
                    key={hand.id}
                    className={`hand-wrapper ${isActive ? 'active' : ''}`}
                  >
                <div className="hand overlap">
                      {hand.cards.map((card, idx) => (
                        <Card key={card.id} card={card} order={dealCount + idx} />
                      ))}
                    </div>
                    <div className="hand-info">
                      <span>Total: {calculateHandValue(hand.cards)}</span>
                      <span className={`status ${hand.status}`}>
                        {statusCopy[hand.status] || hand.status}
                      </span>
                      <span>Bet: {hand.bet}</span>
                      {hand.result && (
                        <span className={`result ${hand.result}`}>
                          {hand.result}
                        </span>
                      )}
                      {hand.payout !== 0 && (
                        <span
                          className={`payout ${
                            hand.payout > 0 ? 'win' : 'loss'
                          }`}
                        >
                          {hand.payout > 0 ? '+' : ''}
                          {hand.payout}
                        </span>
                      )}
                    </div>
                    <div className="actions">
                      <button
                        onClick={() => handleHit(player.id, hand.id)}
                        disabled={!isActive}
                      >
                        Hit
                      </button>
                      <button
                        onClick={() => handleStand(player.id, hand.id)}
                        disabled={!isActive}
                      >
                        Stand
                      </button>
                      <button
                        onClick={() => handleDouble(player.id, hand.id)}
                        disabled={
                          !isActive ||
                          hand.cards.length !== 2 ||
                          hand.doubled ||
                          player.bank < player.wager + hand.bet
                        }
                      >
                        Double
                      </button>
                      <button
                        onClick={() => handleSplit(player.id, hand.id)}
                        disabled={
                          !isActive ||
                          hand.cards.length !== 2 ||
                          player.hands.length >= 4 ||
                          hand.cards[0].rank !== hand.cards[1].rank ||
                          player.bank < player.wager + hand.bet
                        }
                      >
                        Split
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

BlackjackTable.propTypes = {
  onRecordResult: PropTypes.func.isRequired,
  refreshScores: PropTypes.func.isRequired,
  onStatus: PropTypes.func,
  onPlayersChange: PropTypes.func,
  onChipHandlerReady: PropTypes.func,
  savedPlayers: PropTypes.array,
  onRefreshPlayers: PropTypes.func,
  onBankPersist: PropTypes.func,
};

export default BlackjackTable;
