# Polymarket price forecasts

`main.ts` reads every `.in` case from `MAKEFUN_INPUT_DIR` (or `/input`) and writes deterministic five-quantile forecasts to `MAKEFUN_OUTPUT_DIR` (or `/output`). It estimates horizon spreads from historical price moves in the latest 720 prices and scales them using recent versus long-run volatility.

Forecasts are centered on the latest price. A small center adjustment is applied only when the sum of the case's market prices is between 0.7 and 1.4, where the markets are likely mutually exclusive and the sum can reflect overround. Independent FAA questions have a much smaller total, so they receive no such adjustment.
