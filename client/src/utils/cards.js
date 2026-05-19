export const SUITS = ['♠', '♥', '♦', '♣'];

export const RANKS = [
  { rank: 'A', value: 11 },
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 10 },
  { rank: 'Q', value: 10 },
  { rank: 'K', value: 10 },
];

export const RANK_VALUE_MAP = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export function buildDeck() {
  return SUITS.flatMap((suit) =>
    RANK_VALUE_MAP
      ? Object.keys(RANK_VALUE_MAP).map((rank) => ({
          id: `${rank}${suit}-${Math.random().toString(36).slice(2, 7)}`,
          rank,
          suit,
          value: rank === 'A' ? 11 : Math.min(RANK_VALUE_MAP[rank], 10),
        }))
      : []
  );
}

export function shuffleDeck(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createShoe(deckCount = 1) {
  const shoe = [];
  for (let i = 0; i < deckCount; i += 1) {
    shoe.push(...buildDeck());
  }
  return shuffleDeck(shoe);
}

export function calculateHandValue(hand) {
  let total = hand.reduce((sum, card) => sum + (card.value || 0), 0);
  let aces = hand.filter((card) => card.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}
