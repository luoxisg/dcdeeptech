// Draft allocation of the supplied reference total, not an approved tariff.
export const defaultUnitRates = Object.freeze({
  page: 200,
  photo: 800,
  audioMinute: 200,
  videoMinute: 1000,
  setup: 120000,
  minimum: 800000,
});
export const unitRateKeys = Object.freeze(Object.keys(defaultUnitRates));
export function validateUnitRates(rates) {
  if (
    !rates ||
    Object.keys(rates).sort().join(",") !==
      [...unitRateKeys].sort().join(",") ||
    unitRateKeys.some(
      (k) =>
        !Number.isSafeInteger(rates[k]) || rates[k] < 0 || rates[k] > 100000000,
    )
  )
    throw Object.assign(new Error("Invalid SGD rates"), {
      code: "dfplan/pricing-format",
    });
  return rates;
}
export function centsFromSGD(value) {
  const text = String(value).trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text))
    throw Object.assign(new Error("Invalid SGD amount"), {
      code: "dfplan/pricing-format",
    });
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function unitPriceSubtotal(input, rates = defaultUnitRates) {
  validateUnitRates(rates);
  return (
    input.pages * rates.page +
    input.photos * rates.photo +
    input.audioMinutes * rates.audioMinute +
    input.video * rates.videoMinute +
    (input.pages + input.photos + input.audioMinutes + input.video > 0
      ? rates.setup
      : 0)
  );
}
export function canEditUnitPricing(session, demo = false) {
  return (
    !demo &&
    session?.phase === "ready" &&
    !session.user?.isGuest &&
    !!session.user?.email &&
    ["owner", "admin"].includes(session.admin?.role)
  );
}
