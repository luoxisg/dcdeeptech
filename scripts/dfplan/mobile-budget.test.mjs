import test from "node:test";
import assert from "node:assert/strict";
import { store } from "../../dfplan/src/application/store.mjs";
import { budgetSummaryMarkup } from "../../dfplan/src/ui/views/digitization.mjs";
test("budget counts selected catalogue lines, not units, and includes setup/minimum published rates", () => {
  const old = store.getState();
  try {
    const rates = {
      page: 100,
      photo: 200,
      audioMinute: 300,
      videoMinute: 400,
      setup: 500,
      minimum: 0,
    };
    store.update({
      language: "zh",
      capture: { documents: 3, photos: 2 },
      pricing: { ...old.pricing, record: { rates } },
    });
    assert.match(String(budgetSummaryMarkup()), /已选 2 项/);
    assert.match(String(budgetSummaryMarkup()), /S\$12\.00/);
    store.update({
      pricing: {
        ...old.pricing,
        record: { rates: { ...rates, minimum: 5000 } },
      },
    });
    assert.match(String(budgetSummaryMarkup()), /S\$50\.00/);
    store.update({ language: "en", capture: {} });
    assert.match(String(budgetSummaryMarkup()), /Selected 0 items/);
    assert.match(String(budgetSummaryMarkup()), /S\$0\.00/);
  } finally {
    store.update(old);
  }
});
