/* TradingView Lightweight Charts™
 * Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/
 */
import { useEffect, useRef, useState } from 'react';
import { CandlestickSeries, HistogramSeries, ColorType, CrosshairMode, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../data/binance';
import { formatCompact, formatPrice } from '../lib/format';

export function PriceChart({ candles, reset, label }: { candles: Candle[]; reset: number; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const fitted = useRef(false);
  const [hovered, setHovered] = useState<Candle>();
  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: '#10141c' }, textColor: '#8490a3', fontSize: 11,
        fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace", attributionLogo: false,
        panes: { separatorColor: '#222a37', separatorHoverColor: '#3b4b59', enableResize: true } },
      grid: { vertLines: { color: '#1c23302e' }, horzLines: { color: '#20283670' } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#66768b', labelBackgroundColor: '#354457' }, horzLine: { color: '#66768b', labelBackgroundColor: '#354457' } },
      rightPriceScale: { borderColor: '#222a37', minimumWidth: 78, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: '#222a37', timeVisible: true, secondsVisible: false, rightOffset: 7, barSpacing: 7 },
      localization: { priceFormatter: formatPrice },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    });
    const series = chart.addSeries(CandlestickSeries, { upColor: '#67d3b1', downColor: '#e7808c', borderVisible: false, wickUpColor: '#67d3b1', wickDownColor: '#e7808c' });
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false }, 1);
    chart.panes()[0].setStretchFactor(4);
    chart.panes()[1].setStretchFactor(1);
    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;
    chart.subscribeCrosshairMove((event) => {
      const item = event.seriesData.get(series);
      const vol = event.seriesData.get(volume);
      if (item && 'open' in item && vol && 'value' in vol) setHovered({ ...item, time: Number(item.time), volume: vol.value });
      else setHovered(undefined);
    });
    return () => { chart.remove(); chartRef.current = null; seriesRef.current = null; volumeRef.current = null; fitted.current = false; };
  }, []);
  useEffect(() => {
    if (!seriesRef.current || !volumeRef.current) return;
    seriesRef.current.setData(candles.map((candle) => ({ ...candle, time: candle.time as UTCTimestamp })));
    volumeRef.current.setData(candles.map((candle) => ({ time: candle.time as UTCTimestamp, value: candle.volume, color: candle.close >= candle.open ? '#67d3b13d' : '#e7808c3d' })));
    if (!fitted.current && candles.length) {
      chartRef.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 100), to: candles.length + 6 });
      fitted.current = true;
    }
  }, [candles]);
  useEffect(() => { if (reset) chartRef.current?.timeScale().fitContent(); }, [reset]);
  const current = hovered ?? candles.at(-1);
  return <div className="chart-body">
    <div className="chart-legend" aria-label="Candle price details"><span className="legend-dot" /><span>{label}</span><span className="ohlc"><span>O <b>{formatPrice(current?.open)}</b></span><span>H <b>{formatPrice(current?.high)}</b></span><span>L <b>{formatPrice(current?.low)}</b></span><span>C <b className={current && current.close >= current.open ? 'text-positive' : 'text-negative'}>{formatPrice(current?.close)}</b></span></span></div>
    <div className="chart-canvas" ref={container} role="img" aria-label={`${label} interactive candlestick and volume chart. Drag to pan, scroll to zoom. Prices in USDT, times in UTC.`} />
    <div className="volume-label">VOLUME <span>{formatCompact(current?.volume)}</span></div>
  </div>;
}
