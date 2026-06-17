import { useCallback, useEffect, useState } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import PriceCard from './components/PriceCard';
import type { Price } from './components/price';
import './App.css';

const SSE_URL = 'http://localhost:3000/prices/stream';
const SSE_MANUAL_URL = 'http://localhost:3000/prices/stream-manual';
const SSE_STOP_URL = 'http://localhost:3000/prices/stop';
const ALL_SYMBOLS = ['BTC', 'ETH', 'SOL'] as const;

type Status = 'disconnected' | 'connected' | 'ended';

export default function App() {
  const [prices, setPrices] = useState<Record<string, Price>>({});
  const [mode, setMode] = useState<'native' | 'fetch' | 'manual'>('native');
  const [selected, setSelected] = useState<string[]>([...ALL_SYMBOLS]);
  const [status, setStatus] = useState<Status>('disconnected');
  const [reconnectKey, setReconnectKey] = useState(0);

  const handleMessage = useCallback((raw: string) => {
    try {
      const data: Price[] = JSON.parse(raw);
      setPrices((prev) => {
        const next = { ...prev };
        for (const p of data) next[p.symbol] = p;
        return next;
      });
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    setStatus('disconnected');

    if (mode === 'native' || mode === 'manual') {
      const url = mode === 'manual' ? SSE_MANUAL_URL : SSE_URL;
      const es = new EventSource(url);
      es.onopen = () => setStatus('connected');
      es.onmessage = (e) => handleMessage(e.data);
      es.onerror = () => {
        es.close();
        setStatus('ended');
      };
      return () => es.close();
    }

    const ctrl = new AbortController();

    fetchEventSource(SSE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: selected }),
      signal: ctrl.signal,
      onopen: async () => {
        setStatus('connected');
      },
      onmessage: (e) => handleMessage(e.data),
      onclose: () => {
        setStatus('ended');
      },
      onerror() {
        setStatus('ended');
      },
    });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selected, handleMessage, reconnectKey]);

  const stopStreams = async () => {
    try {
      await fetch(SSE_STOP_URL, { method: 'POST' });
    } catch {
      // ignore
    }
  };

  const toggleSymbol = (sym: string) => {
    setSelected((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym],
    );
  };

  const reconnect = () => {
    setPrices({});
    setStatus('disconnected');
    setReconnectKey((k) => k + 1);
  };

  const statusLabel =
    status === 'connected'
      ? '● Connected'
      : status === 'ended'
        ? '■ Ended'
        : '○ Disconnected';

  return (
    <div className="app">
      <h1 className="app__title">Crypto SSE Ticker</h1>
      <p className="app__subtitle">
        {mode === 'native' &&
          'GET via native EventSource | take(10) auto-close'}
        {mode === 'fetch' &&
          'POST via @microsoft/fetch-event-source | take(10) + filter + headers'}
        {mode === 'manual' &&
          'GET via raw SSE (manual headers, res.end) | 30s timeout'}
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
          POST (fetch)
        </button>
        <button
          className={`controls__btn ${mode === 'manual' ? 'controls__btn--active' : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual (raw SSE)
        </button>
      </div>

      {mode === 'fetch' && (
        <div className="controls">
          <div className="controls__filter">
            {ALL_SYMBOLS.map((sym) => (
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
      )}

      <div className="controls">
        <button
          className="controls__btn controls__btn--danger"
          onClick={stopStreams}
        >
          Stop All Streams (POST /stop)
        </button>
      </div>

      <div className={`status status--${status}`}>{statusLabel}</div>

      {status === 'ended' && (
        <div className="controls">
          <button
            className="controls__btn controls__btn--reconnect"
            onClick={reconnect}
          >
            ↻ Reconnect
          </button>
        </div>
      )}

      <div className="grid">
        {ALL_SYMBOLS.map((sym) => {
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
