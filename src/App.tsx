import { useCallback, useEffect, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import PriceCard from './components/PriceCard';
import type { Price } from './components/price';
import './App.css';

const SSE_URL = 'http://localhost:3000/prices/stream';
const ALL_SYMBOLS = ['BTC', 'ETH', 'SOL'] as const;

export default function App() {
  const [prices, setPrices] = useState<Record<string, Price>>({});
  const [mode, setMode] = useState<'native' | 'fetch'>('native');
  const [selected, setSelected] = useState<string[]>([...ALL_SYMBOLS]);
  const [connected, setConnected] = useState(false);

  const handleMessage = useCallback((raw: string) => {
    try {
      const data: Price[] = JSON.parse(raw);
      setPrices(prev => {
        const next = { ...prev };
        for (const p of data) next[p.symbol] = p;
        return next;
      });
    } catch {
      /* ignore parse errors */
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();

    if (mode === 'native') {
      const es = new EventSource(SSE_URL);
      es.onopen = () => setConnected(true);
      es.onmessage = (e) => handleMessage(e.data);
      es.onerror = () => setConnected(false);
      return () => es.close();
    }

    fetchEventSource(SSE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: selected }),
      signal: ctrl.signal,
      onopen: async () => { setConnected(true); },
      onmessage: (e) => handleMessage(e.data),
      onerror() {
        setConnected(false);
      },
    });

    return () => ctrl.abort();
  }, [mode, selected, handleMessage]);

  const toggleSymbol = (sym: string) => {
    setSelected(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym],
    );
  };

  return (
    <div className="app">
      <h1 className="app__title">Crypto SSE Ticker</h1>
      <p className="app__subtitle">
        {mode === 'native'
          ? 'GET via native EventSource (no headers, no body)'
          : 'POST via @microsoft/fetch-event-source (headers + body)'}
      </p>

      <div className="controls">
        <button
          className={`controls__btn ${mode === 'native' ? 'controls__btn--active' : ''}`}
          onClick={() => setMode('native')}
        >
          GET (native)
        </button>
        <button
          className={`controls__btn ${mode === 'fetch' ? 'controls__btn--active' : ''}`}
          onClick={() => setMode('fetch')}
        >
          POST (fetch-event-source)
        </button>
      </div>

      <div className="controls">
        <div className="controls__filter">
          {ALL_SYMBOLS.map(sym => (
            <label key={sym}>
              <input
                type="checkbox"
                checked={selected.includes(sym)}
                onChange={() => toggleSymbol(sym)}
              />
              {sym}
            </label>
          ))}
        </div>
      </div>

      <div className={`status ${connected ? 'status--connected' : 'status--disconnected'}`}>
        {connected ? '● Connected' : '○ Disconnected'}
      </div>

      <div className="grid">
        {ALL_SYMBOLS.map(sym => {
          const price = prices[sym];
          if (!price) {
            return (
              <div key={sym} className="price-card">
                <div className="price-card__symbol">{sym}</div>
                <div className="price-card__value">---</div>
                <div className="price-card__change">--%</div>
                <div className="price-card__time">--:--:--</div>
              </div>
            );
          }
          return <PriceCard key={sym} price={price} />;
        })}
      </div>
    </div>
  );
}
