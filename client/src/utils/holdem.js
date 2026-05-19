import { RANK_VALUE_MAP, SUITS } from './cards';

const HAND_LABELS = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
];

const valueToLabel = {
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

const sortDesc = (a, b) => b - a;

const getValue = (rank) => RANK_VALUE_MAP[rank] || 0;

const findStraight = (values) => {
  const unique = [...new Set(values)].sort(sortDesc);
  if (unique.includes(14)) {
    unique.push(1);
  }
  for (let i = 0; i <= unique.length - 5; i += 1) {
    const window = unique.slice(i, i + 5);
    let consecutive = true;
    for (let j = 1; j < window.length; j += 1) {
      if (window[j - 1] - 1 !== window[j]) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      return { high: window[0], sequence: window };
    }
  }
  return null;
};

export const compareHands = (a, b) => {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a.rank !== b.rank) return a.rank - b.rank;
  const max = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (a.kickers[i] || 0) - (b.kickers[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

export const evaluateHoldemHand = (cards) => {
  const values = cards.map((card) => getValue(card.rank));
  const suits = SUITS.reduce(
    (acc, suit) => ({ ...acc, [suit]: cards.filter((card) => card.suit === suit) }),
    {}
  );

  const flushSuit = Object.keys(suits).find((suit) => suits[suit].length >= 5);
  const flushCards = flushSuit
    ? suits[flushSuit]
        .slice()
        .sort((a, b) => getValue(b.rank) - getValue(a.rank))
        .slice(0, 5)
    : null;

  const straight = findStraight(values);
  const straightFlush = flushCards
    ? findStraight(flushCards.map((card) => getValue(card.rank)))
    : null;

  const counts = values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  const sortedCounts = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.value - a.value;
    });

  const pairs = sortedCounts.filter((entry) => entry.count === 2);
  const trips = sortedCounts.filter((entry) => entry.count === 3);

  if (straightFlush) {
    return {
      rank: 8,
      label: HAND_LABELS[8],
      kickers: [straightFlush.high],
      text: `Straight Flush (${valueLabel(straightFlush.high)})`,
    };
  }

  const four = sortedCounts.find((entry) => entry.count === 4);
  if (four) {
    const kicker = sortedCounts.find((entry) => entry.value !== four.value);
    return {
      rank: 7,
      label: HAND_LABELS[7],
      kickers: [four.value, kicker ? kicker.value : 0],
      text: `Four of a Kind (${valueLabel(four.value)}s)`,
    };
  }

  if (trips.length && (pairs.length || trips.length > 1)) {
    const tripValue = trips[0].value;
    const pairValue = pairs.length
      ? pairs[0].value
      : trips[1]
      ? trips[1].value
      : 0;
    return {
      rank: 6,
      label: HAND_LABELS[6],
      kickers: [tripValue, pairValue],
      text: `Full House (${valueLabel(tripValue)}s full of ${valueLabel(pairValue)}s)`,
    };
  }

  if (flushCards) {
    return {
      rank: 5,
      label: HAND_LABELS[5],
      kickers: flushCards.map((card) => getValue(card.rank)),
      text: `Flush (${flushCards.map((card) => valueLabel(getValue(card.rank))).join(', ')})`,
    };
  }

  if (straight) {
    return {
      rank: 4,
      label: HAND_LABELS[4],
      kickers: [straight.high],
      text: `Straight (${valueLabel(straight.high)} high)`,
    };
  }

  if (trips.length) {
    const kickers = sortedCounts
      .filter((entry) => entry.value !== trips[0].value)
      .slice(0, 2)
      .map((entry) => entry.value);
    return {
      rank: 3,
      label: HAND_LABELS[3],
      kickers: [trips[0].value, ...kickers],
      text: `Three of a Kind (${valueLabel(trips[0].value)}s)`,
    };
  }

  if (pairs.length >= 2) {
    const [first, second] = pairs;
    const kicker = sortedCounts.find(
      (entry) => entry.value !== first.value && entry.value !== second.value
    );
    return {
      rank: 2,
      label: HAND_LABELS[2],
      kickers: [first.value, second.value, kicker ? kicker.value : 0],
      text: `Two Pair (${valueLabel(first.value)}s & ${valueLabel(second.value)}s)`,
    };
  }

  if (pairs.length === 1) {
    const kickerEntries = sortedCounts
      .filter((entry) => entry.value !== pairs[0].value)
      .slice(0, 3);
    return {
      rank: 1,
      label: HAND_LABELS[1],
      kickers: [pairs[0].value, ...kickerEntries.map((entry) => entry.value)],
      text: `Pair of ${valueLabel(pairs[0].value)}s`,
    };
  }

  const topCards = sortedCounts.slice(0, 5).map((entry) => entry.value);
  return {
    rank: 0,
    label: HAND_LABELS[0],
    kickers: topCards,
    text: `High Card (${topCards.map((value) => valueLabel(value)).join(', ')})`,
  };
};

export const valueLabel = (value) => {
  if (valueToLabel[value]) return valueToLabel[value];
  return value.toString();
};

