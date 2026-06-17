import type { Price } from './price';

interface PriceCardProps {
  price: Price;
}

export default function PriceCard({ price }: PriceCardProps) {
  const isUp = price.change >= 0;

  return (
    <div className="price-card">
      <div className="price-card__symbol">{price.symbol}</div>
      <div className="price-card__value">
        ${price.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
      <div className={`price-card__change ${isUp ? 'up' : 'down'}`}>
        {isUp ? '+' : ''}{price.change.toFixed(2)}%
      </div>
      <div className="price-card__time">
        {new Date(price.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
