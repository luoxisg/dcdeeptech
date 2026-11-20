import { captureTotals } from "./capture-catalog.mjs";
import { defaultUnitRates, unitPriceSubtotal } from "./unit-pricing.mjs";
const bounded = (value, max, fallback = 0) =>
  Number.isFinite(Number(value))
    ? Math.min(max, Math.max(0, Number(value)))
    : fallback;
/** @param {import("./types.mjs").UnitRates} [rates] */
export function estimateDigitization(
  input = {},
  rates = defaultUnitRates,
  limits = { pages: 15000, photos: 5000, tapes: 300, video: 10000 },
) {
  const pages = bounded(input.pages, limits.pages),
    photos = bounded(input.photos, limits.photos),
    tapes = bounded(input.tapes, limits.tapes);
  const video = bounded(input.video, limits.video),
    tapeMinutes = Math.max(1, bounded(input.tapeMinutes, 240, 60)),
    team = Number(input.team) === 2 ? 2 : 4;
  const audioMinutes = tapes * tapeMinutes;
  const work =
    pages / 1250 +
    photos / 375 +
    audioMinutes / (3 * 8 * 60 * 0.8) +
    video / (8 * 60 * 0.8);
  const empty = pages + photos + tapes + video === 0;
  const subtotalCents = unitPriceSubtotal(
    { pages, photos, audioMinutes, video },
    rates,
  );
  const scaledBudget = empty
    ? 0
    : Math.ceil(Math.max(subtotalCents, rates.minimum) / 10000) * 100;
  const budget = empty
    ? 0
    : scaledBudget <= 8000
      ? 8000
      : scaledBudget <= 25000
        ? 25000
        : scaledBudget <= 46200
          ? 46200
          : scaledBudget;
  return {
    pages,
    photos,
    tapes,
    video,
    tapeMinutes,
    team,
    audioMinutes,
    budget,
    unitQuoteCents: empty
      ? 0
      : Math.round(Math.max(subtotalCents, rates.minimum)),
    days: empty ? 0 : Math.ceil(2 + (work * 4) / team),
    gb: pages * 0.06 + photos * 0.12 + audioMinutes * 0.03456 + video * 2,
    package: empty
      ? "none"
      : budget <= 8000
        ? "basic"
        : budget <= 25000
          ? "standard"
          : budget <= 46200
            ? "flagship"
            : "expanded",
  };
}

/** @param {import("./types.mjs").UnitRates} [rates] */
export function estimateCatalogue(
  quantities,
  rates = defaultUnitRates,
  team = 4,
) {
  return estimateDigitization({ ...captureTotals(quantities), team }, rates, {
    pages: 300000,
    photos: 300000,
    tapes: 5000,
    video: 300000,
  });
}
