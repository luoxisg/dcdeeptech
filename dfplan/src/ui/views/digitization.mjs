import { store } from "../../application/store.mjs";
import { captureCatalog } from "../../domain/capture-catalog.mjs";
import { captureMethods } from "../../domain/capture-methods.mjs";
import {
  estimateCatalogue,
  digitizationEconomics,
} from "../../domain/digitization-calc.mjs";
import {
  defaultUnitRates,
  unitRateKeys,
  canEditUnitPricing,
} from "../../domain/unit-pricing.mjs";
import { html, selected, disabled, mount } from "../html.mjs";
import { t, s, money } from "../i18n.mjs";
import { pageTitle } from "../components.mjs";
const rateLabels = {
  page: ["文档每页", "Per document page"],
  photo: ["照片每张 / 帧", "Per photo / frame"],
  audioMinute: ["录音每分钟", "Per audio minute"],
  videoMinute: ["录像每分钟", "Per video minute"],
  setup: ["项目固定费", "Project setup"],
  minimum: ["最低项目收费", "Minimum project total"],
};
function rates() {
  return store.getState().pricing.record?.rates || defaultUnitRates;
}
export function totalsMarkup() {
  const state = store.getState(),
    result = estimateCatalogue(state.capture, rates(), state.team);
  return html`<div class="metric-grid">
      <div class="panel metric">
        <span>${s("按单价测算", "Unit-rate estimate")}</span
        ><strong>${money(result.unitQuoteCents)}</strong
        ><small
          >${s("包含固定费与最低收费", "Includes setup and minimum charge")}</small
        >
      </div>
      <div class="panel metric">
        <span>${s("驻场工作日（估算）", "Estimated on-site workdays")}</span
        ><strong>${result.days}</strong
        ><small>${state.team} ${s("人团队", "people")}</small>
      </div>
      <div class="panel metric">
        <span>${s("母版预计体量", "Estimated master files")}</span
        ><strong>${(result.gb / 1000).toFixed(2)} TB</strong
        ><small
          >${s("三份副本约需", "Three copies need about")}
          ${((result.gb * 3) / 1000).toFixed(2)} TB</small
        >
      </div>
    </div>
    <p>
      ${s("参考套餐预算：", "Reference package budget: ")}${money(result.budget * 100)}
      ·
      ${s("最终以介质勘测与书面报价为准。", "Subject to media assessment and a written quote.")}
    </p>`;
}
export function updateTotals() {
  for (const row of captureCatalog) {
    const input = /** @type {HTMLInputElement|null} */ (
      document.querySelector(`[data-quantity="${row.id}"]`)
    );
    if (input && document.activeElement !== input)
      input.value = String(store.getState().capture[row.id] || 0);
    const subtotal = document.querySelector(`[data-row-total="${row.id}"]`);
    if (subtotal)
      subtotal.textContent = money(
        (store.getState().capture[row.id] || 0) * rates()[row.rate],
      );
  }
  mount(document.querySelector("[data-capture-results]"), totalsMarkup());
}
export function categoryMarkup() {
  const state = store.getState(),
    c = captureMethods[state.captureCategory] || captureMethods[0];
  return html`<div class="card-grid">
    ${[
      [s("介质风险", "Condition"), s(c[2], c[3])],
      [s("候选设备", "Candidate equipment"), s(c[4], c[5])],
      [s("目标输出", "Target output"), s(c[6], c[7])],
      [s("保护方法", "Handling"), s(c[8], c[9])],
    ].map(
      ([title, text]) =>
        html`<article class="panel">
          <h3>${title}</h3>
          <p>${text}</p>
        </article>`,
    )}
  </div>`;
}
export function updateCategory() {
  mount(document.querySelector("[data-capture-method]"), categoryMarkup());
  document
    .querySelectorAll('[data-cmd="capture-category"]')
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(
          button.getAttribute("data-value") ===
            String(store.getState().captureCategory),
        ),
      ),
    );
}
export function render() {
  const state = store.getState(),
    price = rates(),
    editable =
      canEditUnitPricing(state.session, state.mode === "demo") &&
      state.pricing.ready,
    economics = digitizationEconomics();
  return html`${pageTitle(t("digitization"), s("一阶段现场数字化采集 · 新币预算测算", "Phase 1 on-site digitization · SGD planning"))}
    <div class="notice">
      <p>
        ${s("下列 12 项按现有六类参考单价映射。脆化、霉损、特殊格式及修复需另行评估，不代表已获 FADGI 评级或保险承保。", "The twelve lines map to the existing six-rate configuration. Fragility, mould, special formats and restoration require assessment. No FADGI rating or insurance cover is claimed.")}
      </p>
    </div>
    <section class="panel">
      <h2>${s("12 项采集明细", "Twelve capture items")}</h2>
      <div class="capture-items">
        ${captureCatalog.map(
          (row) =>
            html`<article class="capture-item">
              <h3>${s(row.zh, row.en)}</h3>
              <p>${money(price[row.rate])} / ${s(row.unitZh, row.unitEn)}</p>
              <label class="stepper"
                ><span class="sr-only">${s(row.zh, row.en)} ${t("qty")}</span
                ><button
                  class="btn"
                  data-cmd="capture-step"
                  data-id="${row.id}"
                  data-delta="-1"
                  aria-label="${s("减少", "Decrease")} ${s(row.zh, row.en)}"
                >
                  −</button
                ><input
                  type="number"
                  inputmode="numeric"
                  min="0"
                  max="100000"
                  step="1"
                  data-input="capture-quantity"
                  data-quantity="${row.id}"
                  value="${state.capture[row.id] || 0}"
                  aria-label="${s(row.zh, row.en)} ${t("qty")}"
                /><button
                  class="btn"
                  data-cmd="capture-step"
                  data-id="${row.id}"
                  data-delta="1"
                  aria-label="${s("增加", "Increase")} ${s(row.zh, row.en)}"
                >
                  +
                </button></label
              ><strong data-row-total="${row.id}"
                >${money((state.capture[row.id] || 0) * price[row.rate])}</strong
              >
            </article>`,
        )}
      </div>
      <label
        >${s("驻场团队", "On-site team")}<select data-change="capture-team">
          <option value="4" ${selected(state.team === 4)}>
            ${s("四人", "Four people")}
          </option>
          <option value="2" ${selected(state.team === 2)}>
            ${s("双人", "Two people")}
          </option>
        </select></label
      >
      <div data-capture-results role="status" aria-live="polite">
        ${totalsMarkup()}
      </div>
      <details>
        <summary>
          ${s("工期、体量和参考预算假设", "Time, capacity and budget assumptions")}
        </summary>
        <p>
          ${s("四人分阶段轮转：文档 1,250 页/团队日、照片 375 张/团队日；录音三工位、录像一工位，每天八小时、80% 利用率，另计两天准备与质检。每页 60 MB、每张 120 MB、立体声 24-bit/96 kHz WAV 每分钟 34.56 MB，录像每分钟 2 GB，TB 使用十进制。实际规格与带况会改变工期和体量。", "Four-person phased workflow: 1,250 pages or 375 photos per team-day; three audio stations and one video station at eight hours/day, 80% utilization, plus two setup/QA days. Assumes 60 MB/page, 120 MB/photo, 34.56 MB/audio minute and 2 GB/video minute, with decimal TB. Actual specifications and condition change estimates.")}
        </p>
        <p>
          ${s("参考套餐：基础 S$8,000+、标准 S$25,000+、旗舰 S$46,200+，与单价合计分开。口述录音条目仅指音频数字化，不包括采访、OCR 或转写服务。", "Reference packages: Basic S$8,000+, Standard S$25,000+, Flagship S$46,200+, separate from unit totals. Oral-history audio means digitization only, excluding interview, OCR or transcription services.")}
        </p>
      </details>
    </section>
    <section class="panel">
      <h2>${s("新币单价表", "SGD unit rates")}</h2>
      <p>
        ${state.mode === "demo" ? s("演示参考单价，不读取正式报价。", "Demo reference rates; live prices are not read.") : state.pricing.record ? s("管理员已发布，版本 ", "Administrator-published revision ") + state.pricing.record.revision : s("初始参考拆分，待管理员确认。", "Initial reference allocation, pending administrator confirmation.")}
      </p>
      ${state.pricing.error ? html`<p class="notice error">${state.pricing.error}</p>` : ""}${state.pricing.loading ? html`<p>${t("loading")}</p>` : ""}
      <form data-cmd="save-pricing" class="stack">
        <dl class="unit-rates">
          ${unitRateKeys.map(
            (key) =>
              html`<div>
                <dt>${s(rateLabels[key][0], rateLabels[key][1])}</dt>
                <dd>
                  ${editable ? html`<label><span class="sr-only">${s(rateLabels[key][0], rateLabels[key][1])}</span><input type="text" inputmode="decimal" name="${key}" required pattern="[0-9]+([.][0-9]{1,2})?" value="${state.pricing.draft?.[key] ?? (price[key] / 100).toFixed(2)}" /></label>` : money(price[key])}
                </dd>
              </div>`,
          )}
        </dl>
        ${editable ? html`<label>${s("修改原因", "Reason for change")}<input name="reason" required maxlength="500" value="${state.pricing.draft?.reason || ""}" /></label><button class="btn btn-primary" type="submit">${s("保存并发布后台单价", "Publish shared rates")}</button>` : html`<p>${s("仅已启用的 Google 管理员可修改。Patrick、普通成员和演示用户只读。", "Only active Google administrators may edit. Patrick, other members and demo users are read-only.")}</p>`}
      </form>
      ${state.mode === "formal" ? html`<button class="btn" data-cmd="refresh-pricing">${s("刷新后台单价", "Refresh shared rates")}</button>` : ""}
      <details>
        <summary>
          ${s("参考全案的成本口径", "Reference project economics")}
        </summary>
        <p>
          S$46,200 · ${s("直接成本约", "Direct cost about")}
          ${money(economics.directCost * 100)} ·
          ${(economics.margin * 100).toFixed(1)}%
          ${s("毛利（非净利）", "gross margin, not net profit")}
        </p>
        <p>
          ${s("预算汇率：1 新币 =", "Planning rate: SGD 1 = CNY")}
          ${economics.rate.toFixed(4)}
          ${s("人民币；非实时汇率。未计销售、管理、税务与额外修复。", "; not a live FX rate. Excludes sales, administration, tax and extra restoration.")}
        </p>
      </details>
    </section>
    <section class="panel">
      <h2>${s("介质与工艺", "Media and methods")}</h2>
      <div class="capture-tabs">
        ${captureMethods.map((method, index) => html`<button class="btn" data-cmd="capture-category" data-value="${index}" aria-pressed="${state.captureCategory === index}">${s(method[0], method[1])}</button>`)}
      </div>
      <div data-capture-method>${categoryMarkup()}</div>
    </section>
    <section class="panel">
      <h2>${s("四步驻场流程", "Four-step on-site workflow")}</h2>
      ${[
        ["现场鉴定与小样", "Assess condition and agree a sample"],
        ["搭建受控离线工位", "Set up a controlled offline station"],
        [
          "独立备份与 SHA-256 核验",
          "Independent backups and SHA-256 integrity checks",
        ],
        [
          "元数据、加密介质与恢复验收交接",
          "Metadata, encrypted media and recovery acceptance",
        ],
      ].map(
        ([zh, en], index) =>
          html`<details>
            <summary>${index + 1}. ${s(zh, en)}</summary>
            <p>
              ${s("原件交接、人员责任和使用授权需书面确认；发现风险即停工并评估。校验码不代替加密或权限控制。", "Confirm custody, responsibilities and permissions in writing. Stop and assess risks; checksums do not replace encryption or access control.")}
            </p>
          </details>`,
      )}
    </section>
    <section class="panel">
      <h2>${s("常见问题", "Questions")}</h2>
      ${[
        [
          "原件能保证零损伤吗？",
          "Can damage be ruled out?",
          "脆弱介质无法保证零风险，须先勘测、小样测试并确认保险条款。",
          "Fragile media are not risk-free. Assess condition, agree a sample and confirm insurance terms.",
        ],
        [
          "数据是否上传云端？",
          "Will files be uploaded?",
          "拟定采集流程离线、本地加密保存；跨境、远程运维和 AI 处理需另行书面授权。",
          "The proposed capture process is offline with local encrypted storage; cross-border, remote support and AI uses need separate written permission.",
        ],
        [
          "怎样对接下一阶段？",
          "How does Phase 2 connect?",
          "保留唯一编号、来源、人物、时间和授权元数据；不默认包含 OCR、转写、AI 模型或知识图谱。",
          "Keep IDs, provenance, people, dates and permission metadata. OCR, transcription, AI and knowledge graphs are not included by default.",
        ],
      ].map(
        ([zh, en, desc, descEn]) =>
          html`<details>
            <summary>${s(zh, en)}</summary>
            <p>${s(desc, descEn)}</p>
          </details>`,
      )}
    </section>`;
}
