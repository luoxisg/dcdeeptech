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
export function renderUnitPricing({ s, esc }, state = {}) {
  const rates = state.draft || state.record?.rates || defaultUnitRates;
  const editable = state.canEdit && state.ready && !state.busy;
  const labels = {
    page: [s("古籍 / 文档", "Books / documents"), s("每页", "per page")],
    photo: [
      s("照片 / 胶片", "Photos / film"),
      s("每张 / 帧", "per photo / frame"),
    ],
    audioMinute: [
      s("录音数字化", "Audio capture"),
      s("每分钟；按实际时长", "per minute of actual duration"),
    ],
    videoMinute: [s("录像数字化", "Video capture"), s("每分钟", "per minute")],
    setup: [
      s("准备与质检固定费", "Setup & quality checks"),
      s("每项目", "per project"),
    ],
    minimum: [
      s("最低项目收费", "Minimum project charge"),
      s("项目最低金额，不重复加收", "minimum total, not an extra fee"),
    ],
  };
  return `<section class="capture-section unit-pricing" aria-labelledby="unit-pricing-title"><h2 id="unit-pricing-title">${s("新币单价表", "SGD unit price table")}</h2><p>${state.demo ? s("演示参考单价，不读取正式报价。", "Demo reference rates; live prices are not read.") : state.record ? s("管理员已发布的共享单价，版本 ", "Shared rates published by an administrator, revision ") + state.record.revision : s("初始参考拆分，待管理员确认；不是已批准的历史报价。", "Initial reference allocation, pending administrator confirmation; not a previously approved tariff.")}</p><p>${s("参考拆分：文档 S$2/页、照片 S$8/张、录音 S$2/分钟、录像 S$10/分钟、固定费 S$1,200；按参考数量合计 S$46,200。GST、介质修复与保险承保范围另行确认。", "Reference allocation: S$2/page, S$8/photo, S$2/audio minute, S$10/video minute and S$1,200 setup, totaling S$46,200 at the reference quantities. Confirm GST, restoration and insurance scope separately.")}</p>${state.loading ? `<p role="status">${s("正在读取后台单价…", "Loading shared rates…")}</p>` : ""}${state.error ? `<p class="module-alert" role="alert">${esc(state.error)}</p>` : ""}<form id="unit-pricing-form"><dl class="unit-price-list">${unitRateKeys.map((k) => `<div><dt><strong>${labels[k][0]}</strong><small>${labels[k][1]}</small></dt><dd>${state.canEdit && state.ready ? `<label><span class="unit-price-sgd">S$</span><span class="sr-only">${labels[k][0]}</span><input name="${k}" inputmode="decimal" type="text" pattern="[0-9]+([.][0-9]{1,2})?" required value="${(rates[k] / 100).toFixed(2)}" ${!editable ? "disabled" : ""}></label>` : `S$${(rates[k] / 100).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</dd></div>`).join("")}</dl>${state.canEdit && state.ready ? `<label class="unit-price-reason">${s("修改原因（必填）", "Reason for change (required)")}<input name="reason" required maxlength="500" value="${esc(state.reason || "")}" ${!editable ? "disabled" : ""}></label><button class="module-primary" type="submit" ${!editable ? "disabled" : ""}>${s("保存并发布后台单价", "Save and publish shared rates")}</button><p>${s("仅已启用的 Google 管理员可修改。保存会增加版本记录，不修改家族任务、人员或进度。", "Only active Google administrators may edit rates. Saving creates a version record and does not change family tasks, people or progress.")}</p>` : `<p>${s("Patrick、普通成员及演示用户只读。", "Patrick, other members and demo users have read-only access.")}</p>`}</form>${!state.demo ? `<button type="button" class="module-button" data-action="pricing-refresh" ${state.busy ? "disabled" : ""}>${s("刷新后台单价", "Refresh shared rates")}</button>` : ""}</section>`;
}
