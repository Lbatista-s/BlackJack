import PropTypes from 'prop-types';
import cardFront from '../assets/card-front.svg';
import cardBack from '../assets/card-back.svg';

const suitColor = {
  '♠': '#0f172a',
  '♣': '#0f172a',
  '♦': '#e11d48',
  '♥': '#e11d48',
};

function Card({ card, hidden = false, order = 0 }) {
  const style = {
    '--deal-index': order,
  };

  if (hidden) {
    return (
      <div
        className="card"
        style={{
          ...style,
          backgroundImage: `url(${cardBack})`,
          backgroundColor: '#0f172a',
        }}
      >
        <div className="card-back-stripes" />
      </div>
    );
  }

  const color = suitColor[card.suit] || '#111827';

  return (
    <div
      className="card"
      style={{
        ...style,
        color,
        backgroundImage: `url(${cardFront})`,
        backgroundColor: '#fff',
      }}
    >
      <div className="card-corner top">
        <span>{card.rank}</span>
        <span>{card.suit}</span>
      </div>
      <div className="card-center">{card.suit}</div>
      <div className="card-corner bottom">
        <span>{card.rank}</span>
        <span>{card.suit}</span>
      </div>
    </div>
  );
}

Card.propTypes = {
  card: PropTypes.shape({
    rank: PropTypes.string,
    suit: PropTypes.string,
    id: PropTypes.string,
  }),
  hidden: PropTypes.bool,
  order: PropTypes.number,
};

export default Card;
