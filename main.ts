import * as fs from 'node:fs';
import * as path from 'node:path';

type Market = { id: string; prices: number[] };
type CaseData = { case: string; horizon_minutes: number; markets: Market[] };

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function spread(values: number[]): number | null {
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  const q25 = percentile(values, 0.25);
  const q75 = percentile(values, 0.75);
  return q25 === null || q75 === null ? null : (q75 - q25) / 1.349;
}

function recentSpread(diffs: number[], count: number): number | null {
  return spread(diffs.slice(Math.max(0, diffs.length - count)));
}

function round6(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return rounded === 0 ? 0 : rounded;
}

function forecast(data: CaseData): object {
  const lastPrices = data.markets.map((m) => m.prices[m.prices.length - 1]);
  const sum = lastPrices.reduce((a, b) => a + b, 0);
  const adjustment = sum >= 0.7 && sum <= 1.4
    ? 1 + Math.max(-0.05, Math.min(0.05, 1 / sum - 1))
    : 1;
  const z = [-1.644854, -0.67449, 0, 0.67449, 1.644854];
  const widths = [0.9, 0.45, 0, 0.45, 0.9];

  const forecasts = data.markets.map((market, marketIndex) => {
    const prices = market.prices;
    const diffs = prices.slice(1).map((v, i) => v - prices[i]);
    const recent = recentSpread(diffs, 60);
    const long = recentSpread(diffs, 1440);
    const regime = recent === null || long === null || long === 0
      ? 1
      : Math.max(0.5, Math.min(2, recent / long));
    const windowStart = Math.max(0, prices.length - 720);
    const window = prices.slice(windowStart);
    const sigmas: number[] = [];
    let running = 0;

    for (let h = 1; h <= data.horizon_minutes; h++) {
      const moves: number[] = [];
      for (let i = h; i < window.length; i++) moves.push(window[i] - window[i - h]);
      let sigma: number;
      if (moves.length < 100) {
        sigma = 0.0025 * Math.sqrt(h);
      } else {
        sigma = spread(moves) ?? 0.0025 * Math.sqrt(h);
      }
      running = Math.max(running, sigma);
      sigmas.push(Math.max(running, 0.0005 * Math.sqrt(h)));
    }

    const center = lastPrices[marketIndex] * adjustment;
    const q = sigmas.map((sigma) => z.map((quantileZ, i) => {
      const value = Math.max(0, Math.min(1, center + quantileZ * widths[i] * sigma * regime));
      return round6(value);
    }));
    return { id: market.id, q };
  });
  return { forecasts };
}

const inputDir = process.env.MAKEFUN_INPUT_DIR || '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
fs.mkdirSync(outputDir, { recursive: true });
const files = fs.readdirSync(inputDir).filter((name) => name.endsWith('.in')).sort();
for (const name of files) {
  const data = JSON.parse(fs.readFileSync(path.join(inputDir, name), 'utf8')) as CaseData;
  const output = JSON.stringify(forecast(data)) + '\n';
  fs.writeFileSync(path.join(outputDir, `${data.case}.out`), output, 'utf8');
}
