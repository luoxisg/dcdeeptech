import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultUnitRates,
  validateUnitRates,
  centsFromSGD,
  unitPriceSubtotal,
  canEditUnitPricing,
  renderUnitPricing,
} from "../../dfplan/unit-pricing.mjs";
import { estimateDigitization } from "../../dfplan/digitization.mjs";
const h = {
  s: (zh, en) => zh,
  esc: (v) => String(v).replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
};
test("reference units reconcile to SGD 46200 and integer-cent parsing has no floating-point rounding", () => {
  assert.equal(
    unitPriceSubtotal({
      pages: 5000,
      photos: 1500,
      audioMinutes: 9000,
      video: 500,
    }),
    4620000,
  );
  assert.equal(centsFromSGD("0.29"), 29);
  assert.equal(centsFromSGD("2.1"), 210);
  for (const s of ["-1", "1.001", "Infinity", "1e3", ""])
    assert.throws(() => centsFromSGD(s));
  for (const rates of [
    { ...defaultUnitRates, page: -1 },
    { ...defaultUnitRates, page: 0.1 },
    { ...defaultUnitRates, extra: 1 },
  ])
    assert.throws(() => validateUnitRates(rates));
});
test("published prices affect estimates while team size only changes time", () => {
  const q = {
    pages: 5000,
    photos: 1500,
    tapes: 150,
    video: 500,
    tapeMinutes: 60,
    team: 4,
  };
  assert.equal(estimateDigitization(q).budget, 46200);
  assert.equal(estimateDigitization(q).unitQuoteCents, 4620000);
  assert.equal(
    estimateDigitization(
      { pages: 1 },
      { ...defaultUnitRates, setup: 0, minimum: 0 },
    ).unitQuoteCents,
    200,
  );
  assert.ok(
    estimateDigitization(q, { ...defaultUnitRates, page: 800 }).budget > 46200,
  );
  assert.equal(estimateDigitization({ ...q, team: 2 }).budget, 46200);
});
test("edit permission never follows a name, demo role or anonymous personnel permission", () => {
  const admin = {
    phase: "ready",
    user: { email: "admin@example.com", isGuest: false },
    admin: { role: "admin" },
  };
  assert.equal(canEditUnitPricing(admin), true);
  assert.equal(canEditUnitPricing(admin, true), false);
  assert.equal(
    canEditUnitPricing({
      ...admin,
      admin: { role: "editor", displayName: "Admin", canManagePeople: true },
    }),
    false,
  );
  assert.equal(
    canEditUnitPricing({ ...admin, user: { isGuest: true, email: "" } }),
    false,
  );
  assert.equal(canEditUnitPricing({ ...admin, phase: "denied" }), false);
  const demo = renderUnitPricing(h, { demo: true });
  assert.doesNotMatch(demo, /name="page"|type="submit"/);
  assert.match(
    renderUnitPricing(h, { ready: true, canEdit: true }),
    /name="page"/,
  );
  assert.doesNotMatch(
    renderUnitPricing(h, {
      ready: false,
      canEdit: true,
      error: "Rules unavailable",
    }),
    /name="page"/,
  );
});
