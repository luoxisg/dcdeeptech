// Internal planning assumptions supplied for the Phase 1 reference case.
export const digitizationReference = Object.freeze({
  quote: 46200,
  cnyEquivalent: 247822,
  laborCny: 43200,
  depreciationCny: 15000,
  otherCny: 38000,
});
export function digitizationEconomics() {
  const r = digitizationReference,
    rate = r.cnyEquivalent / r.quote;
  const labor = r.laborCny / rate,
    depreciation = r.depreciationCny / rate,
    other = r.otherCny / rate;
  const directCost = labor + depreciation + other;
  return {
    rate,
    labor,
    depreciation,
    other,
    directCost,
    contribution: r.quote - directCost,
    margin: (r.quote - directCost) / r.quote,
  };
}
const bounded = (value, max, fallback = 0) =>
  Number.isFinite(Number(value))
    ? Math.min(max, Math.max(0, Number(value)))
    : fallback;
export function estimateDigitization(input = {}) {
  const pages = bounded(input.pages, 15000),
    photos = bounded(input.photos, 5000),
    tapes = bounded(input.tapes, 300);
  const video = bounded(input.video, 10000),
    tapeMinutes = Math.max(1, bounded(input.tapeMinutes, 240, 60)),
    team = Number(input.team) === 2 ? 2 : 4;
  const audioMinutes = tapes * tapeMinutes;
  const work =
    pages / 1250 +
    photos / 375 +
    audioMinutes / (3 * 8 * 60 * 0.8) +
    video / (8 * 60 * 0.8);
  const referenceWork =
    5000 / 1250 +
    1500 / 375 +
    (150 * 60) / (3 * 8 * 60 * 0.8) +
    500 / (8 * 60 * 0.8);
  const empty = pages + photos + tapes + video === 0;
  const scaledBudget = empty
    ? 0
    : Math.ceil((46200 * work) / referenceWork / 100) * 100;
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
let estimatorDraft = {
  pages: 5000,
  photos: 1500,
  tapes: 150,
  video: 500,
  tapeMinutes: 60,
  team: 4,
};
const money = (amount, decimals = 0) =>
  "S$" +
  amount.toLocaleString("en-SG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
const categories = [
  [
    "族谱古籍",
    "Books & genealogies",
    "纸张酸化、装订脆化，先评估可翻页程度。",
    "Acidic paper and fragile bindings require a handling assessment.",
    "拟选 Zeutschel / CZUR 顶置扫描设备；依原件配 V 型承稿台，按实际设备确认规格。",
    "Candidate Zeutschel / CZUR overhead systems, with a suitable book cradle. Confirm specifications for the selected equipment.",
    "TIFF 母版；按尺寸和用途评估 600 dpi，细节需求另测。",
    "TIFF masters; evaluate 600 dpi against dimensions and intended use, with testing for finer detail.",
    "不强压书脊、不强行展平；按材质采用清洁干燥双手或适当手套，限制光照与翻页次数。",
    "Do not force bindings or flatten pages. Use clean, dry hands or appropriate gloves for the material, limiting light and handling.",
  ],
  [
    "老照片与胶片",
    "Photos & film",
    "褪色、粘连、划痕和霉损需分类，严重损伤先交专业人员评估。",
    "Sort fading, adhesion, scratches and mould; refer severe damage for specialist assessment.",
    "拟选 Epson 等可支持目标尺寸的透扫设备，测试色彩与密度表现。",
    "Consider Epson or equivalent film-capable equipment; test colour and density performance.",
    "TIFF 母版与便览副本；照片可评估 600/1200 dpi，胶片分辨率另按片幅确定。",
    "TIFF masters and access copies; evaluate 600/1200 dpi for prints and select film resolution by format.",
    "防静电除尘；Digital ICE 红外处理仅用于兼容胶片，黑白银盐等材料须另测。保留未经修复的母版。",
    "Use antistatic cleaning. Infrared Digital ICE requires compatible film; silver-based black-and-white materials need separate testing. Preserve unretouched masters.",
  ],
  [
    "磁带与口述历史",
    "Audio & oral history",
    "磁粉脱落、粘带、霉变与设备老化可能导致播放损伤。",
    "Shedding, sticky tape, mould and ageing decks can cause playback damage.",
    "拟选经保养校准的 Nakamichi / Tascam 等匹配制式设备，按介质状态试播。",
    "Consider serviced, calibrated Nakamichi / Tascam or equivalent decks matching the format, following a condition check.",
    "WAV / BWF 无损母版，目标 24-bit / 96 kHz；保留原始采样及处理记录。",
    "WAV / BWF lossless masters, targeting 24-bit / 96 kHz, with capture and processing logs.",
    "不反复试播、不自行加热处理；录制前确认当事人同意，保留原始音轨。",
    "Avoid repeated playback or improvised baking. Obtain interview consent and preserve original captured audio.",
  ],
  [
    "家用录像带",
    "Home video",
    "VHS、Hi8、Betamax 等制式和带况各异，先核对播放设备与可读性。",
    "VHS, Hi8 and Betamax require matching playback equipment and condition checks.",
    "拟选匹配制式播放机、采集接口及适用的 TBC 时基校正设备。",
    "Use format-matched decks, capture interfaces and a suitable time-base corrector where needed.",
    "可评估 ProRes 422 高质量中间格式，属有损编码；如要求严格无损，另测 FFV1。保留原帧率与画幅。",
    "ProRes 422 is a high-quality lossy intermediate. Assess FFV1 for strict lossless needs. Preserve original frame rate and aspect ratio.",
    "控制播放次数，记录掉帧和音画同步；保持原始采集母版，修复版另存。",
    "Limit playback, log dropped frames and audio sync, and keep restored versions separate from capture masters.",
  ],
];
export function digitizationCategory(index, { s }) {
  const c = categories[bounded(index, 3) | 0];
  return `<div class="capture-detail-grid">${[
    ["先看介质状态", "Condition first", c[2], c[3]],
    ["候选设备", "Candidate equipment", c[4], c[5]],
    ["目标输出", "Target output", c[6], c[7]],
    ["保护与复核", "Handling & review", c[8], c[9]],
  ]
    .map(
      ([zh, en, desc, descEn]) =>
        `<article><h3>${s(zh, en)}</h3><p>${s(desc, descEn)}</p></article>`,
    )
    .join("")}</div>`;
}
function estimatorResults(r, { s }) {
  const label = {
    none: s("等待数量输入", "Enter quantities"),
    basic: s("基础敏捷包", "Basic"),
    standard: s("标准典藏包", "Standard"),
    flagship: s("旗舰全案包", "Flagship"),
    expanded: s("全案扩展测算", "Extended scope"),
  }[r.package];
  return `<div><span>${s("母版预计体量", "Estimated master files")}</span><strong>${r.gb >= 1000 ? (r.gb / 1000).toFixed(2) + " TB" : r.gb.toFixed(1) + " GB"}</strong><small>${s("三份副本需约 ", "Three copies need about ")}${((r.gb * 3) / 1000).toFixed(2)} TB${s("，另留工作余量", ", plus working headroom")}</small></div><div><span>${s("预计驻场工作日", "Estimated on-site workdays")}</span><strong>${r.days}<small>${s(" 天", " days")}</small></strong><small>${r.team}${s(" 人团队 · 含准备与质检假设", " people · includes setup and QA assumptions")}</small></div><div><span>${s("建议预算级别", "Indicative budget tier")}</span><strong>${money(r.budget)}${r.budget ? "+" : ""}</strong><small>${label} · ${s("待勘测确认", "subject to assessment")}</small></div>`;
}
export function updateDigitizationEstimator(root, h) {
  const form = root.querySelector("#digitization-estimator");
  if (!form) return;
  const input = Object.fromEntries(
    [...form.elements].filter((el) => el.name).map((el) => [el.name, el.value]),
  );
  estimatorDraft = estimateDigitization(input);
  for (const output of form.querySelectorAll("output[data-for]"))
    output.textContent = Number(
      form.elements.namedItem(output.dataset.for).value,
    ).toLocaleString("en-SG");
  root.querySelector("#digitization-results").innerHTML = estimatorResults(
    estimateDigitization(input),
    h,
  );
}
export function switchDigitizationCategory(button, h) {
  const root = button.closest(".df-digitization");
  const index = bounded(button.dataset.captureTab, 3) | 0;
  root.querySelectorAll("[data-capture-tab]").forEach((b, i) => {
    b.setAttribute("aria-pressed", String(i === index));
  });
  root.querySelector("#capture-category").innerHTML = digitizationCategory(
    index,
    h,
  );
}
export function renderDigitization(h) {
  const { s, icon } = h,
    e = digitizationEconomics();
  const steps = [
    [
      "现场勘测与介质鉴定",
      "Survey & condition assessment",
      "清点数量、时长、制式、权属与使用授权；霉损资料隔离，消毒或修复由专业人员评估。先做小样并确认验收方法。",
      "Inventory counts, durations, formats, ownership and permissions. Isolate mould-damaged items; seek specialist advice for cleaning or conservation. Agree a sample and acceptance method.",
    ],
    [
      "搭建受控驻场工位",
      "Set up controlled on-site stations",
      "约定原件不出户的作业范围；控制灰尘、温湿度、照明和翻页方式。登记设备、操作人及交接，确认离线采集和本地存储流程。",
      "Agree on-site custody boundaries. Control dust, temperature, humidity, lighting and handling. Register equipment, operators and handovers; confirm offline capture and local storage.",
    ],
    [
      "独立备份与完整性验证",
      "Independent backups & integrity checks",
      "保留母版和操作日志，创建独立副本并使用 SHA-256 核对完整性。校验码只能帮助发现变化，不能代替加密、授权和来源证明。",
      "Preserve masters and logs, create independent copies and verify integrity with SHA-256. Checksums help detect change; they do not replace encryption, authorization or provenance.",
    ],
    [
      "分层归档与验收交接",
      "Archive, accept & hand over",
      "交付母版、便览副本、元数据与 P### / R### 等唯一编号；移交加密介质，另行交接密钥。抽样恢复并由家族指定人员确认接收。",
      "Deliver masters, access copies, metadata and unique IDs such as P### / R###. Hand over encrypted storage and transfer keys separately. Test recovery and obtain acceptance from the family’s designated reviewer.",
    ],
  ];
  const slider = (name, zh, en, max, value, step) =>
    `<label class="capture-slider" for="capture-${name}"><span>${s(zh, en)}<output data-for="${name}" for="capture-${name}">${value.toLocaleString("en-SG")}</output></span><input id="capture-${name}" name="${name}" type="range" min="0" max="${max}" step="${step}" value="${value}"></label>`;
  return `<section class="df-digitization" aria-labelledby="page-title"><header class="capture-hero"><span class="capture-eyebrow">PHASE 1 · PHYSICAL DIGITIZATION</span><h1 id="page-title" tabindex="-1">${s("一阶段数字化采集", "Phase 1 digitization")}</h1><p>${s("让珍贵原件得到妥善照护，让家族记忆有序归档。", "Care for treasured originals. Build an orderly family archive.")}</p><div class="capture-badges"><span>${s("新加坡及亚太家族 / 机构", "Singapore & Asia-Pacific families / institutions")}</span><span>${s("驻场采集方案", "On-site capture plan")}</span><span>${s("新币预算测算", "SGD budget planning")}</span></div><div class="capture-hero-actions"><button type="button" data-capture-jump="capture-sop" class="module-primary">${s("准备现场介质勘测", "Prepare a media assessment")}</button><button type="button" data-capture-jump="capture-calculator" class="module-button">${s("测算数量、工期与预算", "Estimate scope, time & budget")}</button></div></header><p class="capture-notice">${s("内部实施与预算方案：设备、产能、保险和质量目标均待勘测及书面确认；本页不代表已获得 FADGI 评级、认证或保险承保。", "Internal implementation and budget proposal: equipment, capacity, insurance and quality targets require assessment and written confirmation. This page does not claim a FADGI rating, certification or insurance cover.")}</p><section class="capture-section"><h2>${s("参考全案 · 四人驻场二十个工作日", "Reference project · four people, twenty workdays")}</h2><div class="capture-reference"><strong>S$46,200</strong><p>${s("5,000 页文档 · 1,500 张照片 · 150 盘录音带 · 500 分钟录像；目标母版约 1.8 TB。录像与录音按独立工作量核算。", "5,000 document pages · 1,500 photos · 150 audio tapes · 500 video minutes; approximately 1.8 TB of target masters. Audio and video are counted separately.")}</p></div><div class="capture-budget"><dl>${[
    ["人工", "Labour", e.labor],
    ["硬件折旧", "Hardware depreciation", e.depreciation],
    [
      "耗材 / 差旅 / 保险预算",
      "Supplies / travel / insurance allowance",
      e.other,
    ],
    ["直接成本合计", "Total direct cost", e.directCost],
  ]
    .map(
      ([zh, en, cost]) =>
        `<div><dt>${s(zh, en)}</dt><dd>${money(cost, 2)}</dd></div>`,
    )
    .join(
      "",
    )}</dl><p>${s("直接成本口径毛利约 ", "Indicative gross margin on direct costs: ")}${(e.margin * 100).toFixed(1)}% · ${s("未计销售、管理、税务及额外修复成本，非净利。", "before sales, administration, tax and additional restoration costs; not net profit.")}</p><details><summary>${s("换算与报价口径", "Conversion and pricing basis")}</summary><p>${s("沿用所提供的人民币预算，以参考报价隐含汇率换算：1 新币 = ", "Original budget costs are converted at the supplied quote’s implied rate: SGD 1 = CNY ")}${e.rate.toFixed(4)}${s(" 人民币。此为预算假设，不是实时汇率。报价的 GST、特殊修复、保险条款和二阶段服务范围须另行确认。", ". This is a planning assumption, not a live exchange rate. Confirm GST, specialist restoration, insurance terms and Phase 2 scope separately.")}</p></details></div></section><section class="capture-section"><h2>${s("四类介质，各有保护工艺", "Four media types, tailored handling")}</h2><div class="capture-tabs" role="group" aria-label="${s("采集介质", "Capture media")}">${categories.map((c, i) => `<button type="button" data-capture-tab="${i}" aria-controls="capture-category" aria-pressed="${i === 0}">${icon(["tree", "photo", "mic", "play"][i])}${s(c[0], c[1])}</button>`).join("")}</div><div id="capture-category">${digitizationCategory(0, h)}</div></section><section id="capture-calculator" class="capture-section"><h2>${s("数量、工期与预算测算", "Scope, time & budget estimator")}</h2><p>${s("调节数量即可比较方案。结果用于立项讨论，最终以介质勘测、小样测试和书面报价为准。", "Adjust quantities to compare plans. Results support planning discussions; final scope and pricing follow an assessment, sample test and written quote.")}</p><form id="digitization-estimator">${slider("pages", "文档 / 古籍页数", "Document / book pages", 15000, estimatorDraft.pages, 100)}${slider("photos", "照片 / 胶片数量", "Photos / film frames", 5000, estimatorDraft.photos, 50)}${slider("tapes", "录音磁带盘数", "Audio tapes", 300, estimatorDraft.tapes, 1)}<div class="capture-extra"><label>${s("额外录像时长（分钟）", "Additional video minutes")}<input name="video" type="number" min="0" max="10000" value="${estimatorDraft.video}"></label><label>${s("每盘录音带平均分钟", "Average minutes per audio tape")}<input name="tapeMinutes" type="number" min="1" max="240" value="${estimatorDraft.tapeMinutes}"></label><label>${s("驻场团队", "On-site team")}<select name="team"><option value="4" ${estimatorDraft.team === 4 ? "selected" : ""}>${s("四人", "Four people")}</option><option value="2" ${estimatorDraft.team === 2 ? "selected" : ""}>${s("双人", "Two people")}</option></select></label></div></form><div id="digitization-results" class="capture-results" role="status" aria-live="polite">${estimatorResults(estimateDigitization(estimatorDraft), h)}</div><details class="capture-assumptions"><summary>${s("查看产能、体量与套餐假设", "Capacity, file size & package assumptions")}</summary><p>${s("四人分阶段轮转：文档 1,250 页/团队日、照片 375 张/团队日；录音按三工位并行、每天 8 小时、80% 利用率，录像按一工位；另计两天准备和质检。双人按处理阶段用时加倍估算。脆化、霉损、特殊制式、逐件修复会改变工期。", "Four-person phased workflow: 1,250 pages or 375 photos per team-day; three parallel audio stations and one video station, with eight-hour days at 80% utilization, plus two setup/QA days. A two-person team doubles processing time in this model. Fragility, mould, formats and item-level restoration change the schedule.")}</p><p>${s("按每页 60 MB、每张照片 120 MB、立体声 24-bit/96 kHz WAV 每分钟 34.56 MB、录像每分钟 2 GB 估算。TB 使用十进制；体量随规格和实际文件变化。三份副本另需约三倍容量。", "Assumes 60 MB/page, 120 MB/photo, 34.56 MB/minute for stereo 24-bit/96 kHz WAV and 2 GB/video minute. TB is decimal; actual size depends on specifications and files. Three copies require about three times the master-file capacity.")}</p><p>${s("基础敏捷包 S$8,000+；标准典藏包 S$25,000+；旗舰全案包 S$46,200+。按参考全案的处理工作量比例匹配套餐最低预算；两人团队不自动降低总工作量成本。超参考数量按扩展预算讨论。", "Proposed tiers: Basic S$8,000+, Standard S$25,000+, Flagship S$46,200+. The estimator matches the reference workload ratio to a package minimum. A smaller team does not automatically reduce total labour cost. Larger scope requires an extended budget.")}</p></details></section><section id="capture-sop" class="capture-section"><h2>${s("四步驻场作业流程", "Four-step on-site workflow")}</h2><div class="capture-sop">${steps.map(([zh, en, desc, descEn], i) => `<details ${i === 0 ? "open" : ""}><summary><b>0${i + 1}</b>${s(zh, en)}</summary><p>${s(desc, descEn)}</p></details>`).join("")}</div></section><section class="capture-section"><h2>${s("常见问题与交付边界", "Questions & delivery boundaries")}</h2><div class="capture-faq">${[
    [
      "原件一定不会损坏吗？",
      "Can damage be ruled out?",
      "任何脆弱介质操作都无法承诺零风险。先鉴定和小样测试，选择承稿台、适当照明和最低必要操作；发现风险即停工，并确认保险是否承保及除外责任。",
      "No handling of fragile materials is risk-free. Assess condition, test a sample, select suitable cradles and lighting, and minimize handling. Stop when risks arise and confirm insurance cover and exclusions.",
    ],
    [
      "FADGI 四星和 PDPA 如何确认？",
      "How are FADGI and PDPA addressed?",
      "FADGI 质量目标须按适用规范、测试标靶及实际采集结果验证，不能仅凭品牌或 dpi 声称达标。新加坡 PDPA 义务依参与主体和处理情境判断；本地存储本身不等于全面合规。",
      "FADGI targets require applicable guidelines, test targets and measured capture results; brand or dpi alone is insufficient. Singapore PDPA duties depend on the parties and processing context. Local storage alone does not establish compliance.",
    ],
    [
      "资料会不会上传公网？",
      "Will files be uploaded?",
      "拟定流程采用离线采集、本地加密存储，原件与采集资料留在约定场地；具体部署、运维、远程访问及跨境安排须由家族书面确认。PM 网页只记录实施信息，不上传原始资料或密钥。",
      "The proposed workflow uses offline capture and local encrypted storage, keeping originals and captured materials within the agreed site. Confirm deployment, maintenance, remote access and any cross-border arrangements in writing. PM records implementation information, not source materials or keys.",
    ],
    [
      "以后如何接入 AI 或知识图谱？",
      "How can Phase 2 use AI or a knowledge graph?",
      "一阶段交付唯一编号、来源、时间、人物及权限等元数据，便于后续评估。OCR、转写、AI 训练或外部模型调用均须另行确认质量、用途与授权；不默认包含在一阶段报价中。",
      "Deliver unique IDs and metadata for provenance, dates, people and permissions to support later assessment. OCR, transcription, AI training and external models need separate quality, purpose and permission checks; they are not included by default in Phase 1 pricing.",
    ],
  ]
    .map(
      ([zh, en, desc, descEn]) =>
        `<details><summary>${s(zh, en)}</summary><p>${s(desc, descEn)}</p></details>`,
    )
    .join(
      "",
    )}</div><div class="security-actions"><button class="module-button" data-view="security">${icon("shield")}${s("查看资料与安全", "Materials & safety")}</button><button class="module-button" data-view="people">${icon("people")}${s("确认人员与分工", "People & responsibilities")}</button></div></section></section>`;
}
