/** @type {Array<[string,string,string,string,number?]>} */
export const stewardshipFields = [
  [
    "reviewer",
    "验收人（待本人确认）",
    "Reviewer (subject to confirmation)",
    "text",
    120,
  ],
  [
    "backup",
    "执行替补（待本人确认）",
    "Backup person (subject to confirmation)",
    "text",
    120,
  ],
  ["claimedOn", "认领日期", "Claimed on", "date"],
  [
    "effort",
    "预计投入 / 每周可用时间",
    "Estimated effort / weekly availability",
    "text",
    500,
  ],
  [
    "blockers",
    "阻碍 / 需谁决定 / 升级路径",
    "Blockers / decision needed / escalation",
    "textarea",
    12000,
  ],
  [
    "outcomes",
    "已保全 / 已核对成果及受控记录编号",
    "Preserved / verified outcomes and controlled references",
    "textarea",
    12000,
  ],
  [
    "recovery",
    "原始资料恢复记录（日期、范围、结果、复核人）",
    "Original-material recovery record (date, scope, result, reviewer)",
    "textarea",
    12000,
  ],
];

export function stewardshipSummary(tasks) {
  const has = (t, key) => !!t[key]?.trim();
  return {
    reviewer: tasks.filter((t) => has(t, "reviewer")).length,
    backup: tasks.filter((t) => has(t, "backup")).length,
    claimed: tasks.filter((t) => has(t, "claimedOn")).length,
    outcomes: tasks.filter((t) => has(t, "outcomes")).length,
    recovery: tasks.filter((t) => has(t, "recovery")).length,
  };
}

const assertionMarker = "\n\n[DeepFamily assertions v1]\n";
/** Reads legacy free text without interpreting it as an independently verified fact. */
export function readAssertions(outcomes = "") {
  const index = outcomes.lastIndexOf(assertionMarker);
  if (index < 0) return { text: outcomes, assertions: [] };
  try {
    const data = JSON.parse(outcomes.slice(index + assertionMarker.length));
    if (
      data.version !== 1 ||
      !Array.isArray(data.assertions) ||
      data.assertions.some(
        (a) =>
          !a ||
          typeof a.id !== "string" ||
          typeof a.text !== "string" ||
          !["unverified", "confirmed", "conflict"].includes(a.status) ||
          ["note", "source", "updatedAt"].some((k) => typeof a[k] !== "string"),
      )
    )
      throw Error("format");
    return { text: outcomes.slice(0, index), assertions: data.assertions };
  } catch {
    return { text: outcomes, assertions: [] };
  }
}
/** Stores optional assertion metadata inside the existing outcomes string field. */
export function writeAssertions(text, assertions) {
  const result = assertions.length
    ? text + assertionMarker + JSON.stringify({ version: 1, assertions })
    : text;
  if (result.length > 12000)
    throw Error(
      "Assertion records exceed this task’s existing outcomes limit.",
    );
  return result;
}
export function replaceOutcomeText(outcomes, text) {
  return writeAssertions(text, readAssertions(outcomes).assertions);
}

export const stewardshipProposals = [
  [
    "确认执行、验收、替补和实际投入；区分内部留存与公开展示。",
    "Confirm execution, review, backup and available time; separate internal archives from public display.",
  ],
  [
    "分批登记原件位置、来源、用途和备份；可与已获同意的访谈并行。",
    "Inventory originals, sources, uses and backups in batches, alongside interviews with agreed consent.",
  ],
  [
    "W1先保全，让授权替补从独立副本恢复实际照片或录音；计划JSON不等于原始资料备份。",
    "Safeguard in W1; have an authorized backup person restore real photos or audio from an independent copy. Plan JSON does not back up original materials.",
  ],
  [
    "按资料分别确认录制、家族分享、AI处理、公开及供应商用途；版权另核对。",
    "Record recording, family sharing, AI, public and vendor uses separately for each material; check copyright separately.",
  ],
  [
    "首周先联络、确认具体访谈者、语言和陪同；明确同意后按本人舒适度做小试点，不必等技术完善。",
    "Contact elders and confirm an interviewer, language and companion in week one. With clear consent, run a small, comfortable pilot without waiting for technical upgrades.",
  ],
  [
    "首两周以小批资料测试工时与质量，保留母版、来源、编号和原件交接。",
    "Pilot a small batch in the first two weeks to measure effort and quality; retain masters, sources, IDs and original handover records.",
  ],
  [
    "保留原始叙述与不同说法，注明异写、日期体系、来源及核实状态。",
    "Keep original accounts and differing views, with spelling variants, calendar systems, sources and verification status.",
  ],
  [
    "先支持试点所需操作；分别记录源码检查、测试、后端读回和真实用户验收。",
    "Support pilot needs first; record source review, tests, backend readback and actual user acceptance separately.",
  ],
  [
    "随资料分批审阅，记录意见来源、修改理由、限制范围和验收日。",
    "Review in batches, recording feedback sources, reasons for changes, access restrictions and acceptance dates.",
  ],
  [
    "W1先确认SGD预算上限、付款/批准角色与主备保管；W10–12交接，交接后30/90天复查。",
    "Agree SGD budget limits, payer, approver and primary/backup custodians in W1; hand over in W10–12 and review 30/90 days later.",
  ],
];
